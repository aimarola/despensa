import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BarcodeScanner from '../components/BarcodeScanner'
import { PhotoPicker, Spinner } from '../components/ui'
import { addToList, findProductByBarcode } from '../lib/actions'
import { deleteProductImage, uploadProductImage } from '../lib/images'
import { lookupBarcode } from '../lib/openfoodfacts'
import { errorText, supabase } from '../lib/supabase'
import type { NewProductState } from '../lib/useBarcodeAdd'
import { useAuth, useData, useToast } from '../store'

export default function ProductForm() {
  const { id } = useParams()
  const isNew = !id
  const location = useLocation()
  const navState = (location.state ?? {}) as NewProductState
  const navigate = useNavigate()
  const toast = useToast()
  const { household, session } = useAuth()
  const { productsById, supermarkets, ready, refresh, list } = useData()
  const existing = id ? productsById.get(id) : undefined

  const [name, setName] = useState(navState.prefill?.name ?? '')
  const [brand, setBrand] = useState(navState.prefill?.brand ?? '')
  const [barcode, setBarcode] = useState(navState.prefill?.barcode ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(navState.prefill?.image_url ?? null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(navState.prefill?.image_url ?? null)
  const [sms, setSms] = useState<string[]>([])
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
    setSms(existing.product_supermarkets?.map((x) => x.supermarket_id) ?? [])
    setLoaded(true)
  }, [isNew, loaded, existing])

  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview) }, [preview])

  function onFile(f: File) {
    setFile(f)
    setPreview(URL.createObjectURL(f))
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
    if (!name.trim() || !preview) {
      setLooking(true)
      const info = await lookupBarcode(code)
      setLooking(false)
      if (info) {
        if (!name.trim()) setName(info.quantity ? `${info.name} ${info.quantity}` : info.name)
        if (!brand.trim() && info.brand) setBrand(info.brand)
        if (!preview && info.imageUrl) { setImageUrl(info.imageUrl); setPreview(info.imageUrl) }
        toast('Producto encontrado ✔')
      } else toast('No aparece en Open Food Facts: complétalo tú', 'ok')
    }
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
      }
      let productId = id
      if (isNew) {
        const { data, error } = await supabase
          .from('products')
          .insert({ ...row, created_by: session?.user.id })
          .select('id')
          .single()
        if (error) throw error
        productId = data.id as string
      } else {
        const { error } = await supabase.from('products').update(row).eq('id', id!)
        if (error) throw error
        if (existing?.image_url && existing.image_url !== finalUrl) deleteProductImage(existing.image_url)
        await supabase.from('product_supermarkets').delete().eq('product_id', id!)
      }
      if (sms.length) {
        const { error } = await supabase
          .from('product_supermarkets')
          .insert(sms.map((s) => ({ product_id: productId, supermarket_id: s })))
        if (error) throw error
      }
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

  return (
    <div className="page">
      <header className="page-header">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver">←</button>
        <h1>{isNew ? 'Nuevo producto' : 'Editar producto'}</h1>
        <span />
      </header>

      <form className="form" onSubmit={save}>
        <PhotoPicker preview={preview} onFile={onFile} onClear={() => { setFile(null); setPreview(null); setImageUrl(null) }} />

        <label>Nombre
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Leche semidesnatada 1L" />
        </label>
        <label>Marca (opcional)
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ej. Hacendado" />
        </label>
        <label>Código de barras
          <div className="row">
            <input inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Escanéalo →" />
            <button type="button" className="btn" onClick={() => setScanning(true)}>{looking ? '…' : 'Escanear'}</button>
          </div>
        </label>

        <fieldset>
          <legend>¿Dónde se compra?</legend>
          {supermarkets.length === 0 ? (
            <p className="muted small">Añade supermercados en Ajustes para poder elegir.</p>
          ) : (
            <div className="chips wrap">
              {supermarkets.map((s) => {
                const on = sms.includes(s.id)
                return (
                  <button
                    type="button" key={s.id}
                    className={`chip ${on ? 'active' : ''}`}
                    style={on ? { background: s.color, borderColor: s.color } : { borderColor: s.color }}
                    onClick={() => setSms(on ? sms.filter((x) => x !== s.id) : [...sms, s.id])}
                  >{on ? '✓ ' : ''}{s.name}</button>
                )
              })}
            </div>
          )}
          <p className="muted small">Si no marcas ninguno, aparecerá en todos.</p>
        </fieldset>

        {!alreadyPending && (
          <label className="check">
            <input type="checkbox" checked={alsoAdd} onChange={(e) => setAlsoAdd(e.target.checked)} />
            Apuntar en la lista ahora
            {alsoAdd && (
              <span className="row inline">
                × <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="qty-input" />
              </span>
            )}
          </label>
        )}

        <button className="btn primary big" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </form>

      {scanning && <BarcodeScanner onClose={() => setScanning(false)} onDetected={onScanned} />}
    </div>
  )
}
