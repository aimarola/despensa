import { ArrowLeft, ScanBarcode, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BarcodeScanner from '../components/BarcodeScanner'
import { CategoryPicker, PhotoPicker, Spinner, Stepper } from '../components/ui'
import { addToList, findProductByBarcode } from '../lib/actions'
import { guessCategoryFromName } from '../lib/categories'
import { parsePrice } from '../lib/format'
import { deleteProductImage, uploadProductImage } from '../lib/images'
import { errorText, supabase } from '../lib/supabase'
import { enrichBarcode, type NewProductState } from '../lib/useBarcodeAdd'
import { useAuth, useData, useToast } from '../store'

export default function ProductForm() {
  const { id } = useParams()
  const isNew = !id
  const location = useLocation()
  const navState = (location.state ?? {}) as NewProductState
  const pre = navState.prefill ?? {}
  const navigate = useNavigate()
  const toast = useToast()
  const { household, session } = useAuth()
  const { productsById, supermarkets, ready, refresh, list, pricesOf } = useData()
  const existing = id ? productsById.get(id) : undefined

  const [name, setName] = useState(pre.name ?? '')
  const [brand, setBrand] = useState(pre.brand ?? '')
  const [barcode, setBarcode] = useState(pre.barcode ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(pre.image_url ?? null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(pre.image_url ?? null)
  const [category, setCategory] = useState<string>(pre.category ?? (pre.name ? guessCategoryFromName(pre.name) : null) ?? 'otros')
  const [categoryTouched, setCategoryTouched] = useState(Boolean(pre.category))
  const [sms, setSms] = useState<string[]>(pre.supermarkets ?? [])
  const [smReason, setSmReason] = useState<string | null>(pre.supermarketReason ?? null)
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(pre.prices ?? {}).map(([k, v]) => [k, String(v).replace('.', ',')])),
  )
  const [autoPrices, setAutoPrices] = useState<Record<string, number>>(pre.prices ?? {})
  const [refPrice, setRefPrice] = useState<number | null>(pre.refPrice ?? null)
  const [alsoAdd, setAlsoAdd] = useState(navState.addToList ?? isNew)
  const [qty, setQty] = useState(1)
  const [scanning, setScanning] = useState(false)
  const [looking, setLooking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(isNew)

  // Cargar datos al editar
  useEffect(() => {
    if (isNew || loaded || !existing) return
    setName(existing.name)
    setBrand(existing.brand ?? '')
    setBarcode(existing.barcode ?? '')
    setImageUrl(existing.image_url)
    setPreview(existing.image_url)
    setCategory(existing.category || 'otros')
    setCategoryTouched(true)
    setRefPrice(existing.ref_price)
    setSms(existing.product_supermarkets?.map((x) => x.supermarket_id) ?? [])
    setPrices(Object.fromEntries(pricesOf(existing.id).map((p) => [p.supermarket_id, String(p.price).replace('.', ',')])))
    setLoaded(true)
  }, [isNew, loaded, existing, pricesOf])

  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview) }, [preview])

  function onName(v: string) {
    setName(v)
    if (!categoryTouched) {
      const g = guessCategoryFromName(v)
      if (g) setCategory(g)
    }
  }

  async function onScanned(code: string) {
    setScanning(false)
    setBarcode(code)
    if (!household) return
    const known = await findProductByBarcode(household.id, code)
    if (known && known.id !== id) {
      toast(`Ese código ya es de «${known.name}»`, 'error')
      return
    }
    setLooking(true)
    const info = await enrichBarcode(code, supermarkets)
    setLooking(false)
    if (!info.found && !info.supermarkets?.length) {
      toast('No aparece en las bases de datos: complétalo tú')
      return
    }
    if (!name.trim() && info.name) setName(info.name)
    if (!brand.trim() && info.brand) setBrand(info.brand)
    if (!preview && info.image_url) { setImageUrl(info.image_url); setPreview(info.image_url) }
    if (!categoryTouched && info.category) setCategory(info.category)
    if (sms.length === 0 && info.supermarkets?.length) { setSms(info.supermarkets); setSmReason(info.supermarketReason ?? null) }
    if (info.prices) {
      setAutoPrices(info.prices)
      setPrices((p) => ({ ...Object.fromEntries(Object.entries(info.prices!).map(([k, v]) => [k, String(v).replace('.', ',')])), ...Object.fromEntries(Object.entries(p).filter(([, v]) => v)) }))
    }
    if (info.refPrice != null) setRefPrice(info.refPrice)
    toast('Producto encontrado')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!household || !name.trim()) return
    setSaving(true)
    try {
      let finalUrl = preview ? imageUrl : null
      if (file) finalUrl = await uploadProductImage(household.id, file)

      const row = {
        household_id: household.id,
        name: name.trim(),
        brand: brand.trim() || null,
        barcode: barcode.trim() || null,
        image_url: finalUrl,
        category,
        ref_price: refPrice,
      }
      let productId = id
      if (isNew) {
        const { data, error } = await supabase.from('products').insert({ ...row, created_by: session?.user.id }).select('id').single()
        if (error) throw error
        productId = data.id as string
      } else {
        const { error } = await supabase.from('products').update(row).eq('id', id!)
        if (error) throw error
        if (existing?.image_url && existing.image_url !== finalUrl) deleteProductImage(existing.image_url)
        await supabase.from('product_supermarkets').delete().eq('product_id', id!)
      }
      if (sms.length) {
        const { error } = await supabase.from('product_supermarkets').insert(sms.map((s) => ({ product_id: productId, supermarket_id: s })))
        if (error) throw error
      }
      // Precios
      const upserts = Object.entries(prices)
        .map(([smId, txt]) => ({ smId, price: parsePrice(txt) }))
        .filter((x) => x.price != null)
        .map((x) => ({
          product_id: productId, supermarket_id: x.smId, price: x.price,
          source: autoPrices[x.smId] === x.price ? 'openprices' : 'manual', updated_at: new Date().toISOString(),
        }))
      if (upserts.length) {
        const { error } = await supabase.from('product_prices').upsert(upserts)
        if (error) throw error
      }
      const cleared = Object.entries(prices).filter(([, t]) => !t.trim()).map(([k]) => k)
      if (!isNew && cleared.length) await supabase.from('product_prices').delete().eq('product_id', productId!).in('supermarket_id', cleared)

      if (alsoAdd && productId) await addToList(productId, qty)
      await refresh()
      toast(alsoAdd ? `Apuntado: ${row.name}` : 'Guardado')
      if (navState.returnTo) navigate(navState.returnTo, { replace: true, state: { checkProduct: productId } })
      else if (isNew && alsoAdd) navigate('/', { replace: true })
      else navigate(`/productos/${productId}`, { replace: true })
    } catch (err) {
      toast(errorText(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!isNew && !ready) return <Spinner />
  if (!isNew && !existing) return <div className="page"><p>Producto no encontrado.</p></div>

  const alreadyPending = !isNew && list.some((l) => l.product_id === id)
  const priceTargets = supermarkets.filter((s) => sms.length === 0 || sms.includes(s.id))

  return (
    <div className="page">
      <header className="page-header">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver"><ArrowLeft /></button>
        <h1>{isNew ? 'Nuevo producto' : 'Editar producto'}</h1>
      </header>

      <form className="form" onSubmit={save}>
        <PhotoPicker preview={preview} onFile={(f) => { setFile(f); setPreview(URL.createObjectURL(f)) }} onClear={() => { setFile(null); setPreview(null); setImageUrl(null) }} />

        <label>Nombre
          <input required value={name} onChange={(e) => onName(e.target.value)} placeholder="Leche semidesnatada 1 L" />
        </label>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="grow">Marca
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Opcional" />
          </label>
          <label className="grow">Código de barras
            <div className="row">
              <input inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="—" />
              <button type="button" className="scan-btn" style={{ width: 50, minWidth: 50, height: 50 }} onClick={() => setScanning(true)} aria-label="Escanear código">
                {looking ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : <ScanBarcode size={22} />}
              </button>
            </div>
          </label>
        </div>

        <div className="field-group">
          <div className="legend">Categoría</div>
          <CategoryPicker value={category} onChange={(c) => { setCategory(c); setCategoryTouched(true) }} />
        </div>

        <div className="field-group">
          <div className="legend">¿Dónde se compra?</div>
          {supermarkets.length === 0 ? (
            <p className="hint">Añade supermercados en Ajustes para poder elegir.</p>
          ) : (
            <div className="chips wrap">
              {supermarkets.map((s) => {
                const on = sms.includes(s.id)
                return (
                  <button
                    type="button" key={s.id}
                    className={`chip ${on ? 'active' : ''}`}
                    onClick={() => { setSms(on ? sms.filter((x) => x !== s.id) : [...sms, s.id]); setSmReason(null) }}
                  >
                    <span className="dot" style={{ background: s.color }} />{s.name}
                  </button>
                )
              })}
            </div>
          )}
          {smReason
            ? <span className="hint auto"><Sparkles size={14} /> Elegido automáticamente por {smReason}</span>
            : <span className="hint">Sin marcar ninguno, aparecerá en todos.</span>}
        </div>

        {supermarkets.length > 0 && (
          <div className="field-group">
            <div className="legend">Precio</div>
            {priceTargets.map((s) => (
              <div className="row" key={s.id}>
                <span className="swatch-dot" style={{ background: s.color }} />
                <span className="grow">{s.name}</span>
                <input
                  inputMode="decimal" placeholder="0,00 €" style={{ width: 110, textAlign: 'right' }}
                  value={prices[s.id] ?? ''}
                  onChange={(e) => setPrices({ ...prices, [s.id]: e.target.value })}
                  aria-label={`Precio en ${s.name}`}
                />
              </div>
            ))}
            {Object.keys(autoPrices).length > 0
              ? <span className="hint auto"><Sparkles size={14} /> Precio tomado de Open Prices; se actualiza solo cada vez que lo compréis</span>
              : <span className="hint">Opcional. Se rellena solo con lo que pagáis en cada compra.</span>}
          </div>
        )}

        {!alreadyPending && (
          <div className="field-group">
            <label className="check">
              <input type="checkbox" checked={alsoAdd} onChange={(e) => setAlsoAdd(e.target.checked)} />
              <span className="grow">Apuntar en la lista</span>
              {alsoAdd && <Stepper value={qty} onChange={setQty} />}
            </label>
          </div>
        )}

        <button className="btn primary big" disabled={saving}>{saving ? 'Guardando…' : 'Guardar producto'}</button>
      </form>

      {scanning && <BarcodeScanner onClose={() => setScanning(false)} onDetected={onScanned} />}
    </div>
  )
}
