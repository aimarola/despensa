import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PriceTag, ProductImage, Sheet, Spinner } from '../components/ui'
import { addToList } from '../lib/actions'
import { categoryOf } from '../lib/categories'
import { firstName, formatDate, formatDateTime, parsePrice, timeAgo } from '../lib/format'
import { deleteProductImage } from '../lib/images'
import { errorText, supabase } from '../lib/supabase'
import { useData, useToast } from '../store'

interface HistoryRow {
  id: string
  quantity: number
  unit_price: number | null
  purchased_at: string
  trip_id: string
  trips: { supermarket_id: string | null; done_by: string | null; shoppers: string[] | null } | null
}

const SOURCE: Record<string, string> = { compra: 'pagado en la última compra', manual: 'puesto a mano', openprices: 'de Open Prices' }

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { ready, productsById, supermarkets, stats, list, memberName, refresh, pricesOf } = useData()
  const [history, setHistory] = useState<HistoryRow[] | null>(null)
  const [editPrice, setEditPrice] = useState<{ smId: string; value: string } | null>(null)
  const p = id ? productsById.get(id) : undefined
  const st = id ? stats.get(id) : undefined
  const pending = list.find((l) => l.product_id === id)
  const smById = new Map(supermarkets.map((s) => [s.id, s]))

  useEffect(() => {
    if (!id) return
    supabase
      .from('purchases')
      .select('id, quantity, unit_price, purchased_at, trip_id, trips(supermarket_id, done_by, shoppers)')
      .eq('product_id', id)
      .order('purchased_at', { ascending: false })
      .limit(100)
      .then(({ data }) => setHistory((data ?? []) as unknown as HistoryRow[]))
  }, [id, st?.times_bought])

  if (!ready) return <Spinner />
  if (!p) return <div className="page"><p>Producto no encontrado.</p><Link to="/productos">Volver</Link></div>

  const cat = categoryOf(p.category)
  const prices = pricesOf(p.id)
  const priceBySm = new Map(prices.map((x) => [x.supermarket_id, x]))
  const priceRows = supermarkets.filter((s) => priceBySm.has(s.id) || !p.product_supermarkets?.length || p.product_supermarkets.some((x) => x.supermarket_id === s.id))

  let nextHint: string | null = null
  if (st?.avg_days_between && st.last_bought) {
    const due = new Date(st.last_bought).getTime() + st.avg_days_between * 86400000
    const days = Math.round((due - new Date().getTime()) / 86400000)
    nextHint = days <= 0 ? 'Por lo habitual, ya debería tocar comprarlo.' : `Por lo habitual, tocará dentro de unos ${days} días.`
  }

  async function onAdd() {
    try { await addToList(p!.id); await refresh(); toast(`Apuntado: ${p!.name}`) } catch (e) { toast(errorText(e), 'error') }
  }

  async function savePrice() {
    if (!editPrice) return
    const v = parsePrice(editPrice.value)
    const q = v == null
      ? supabase.from('product_prices').delete().eq('product_id', p!.id).eq('supermarket_id', editPrice.smId)
      : supabase.from('product_prices').upsert({ product_id: p!.id, supermarket_id: editPrice.smId, price: v, source: 'manual', updated_at: new Date().toISOString() })
    const { error } = await q
    if (error) return toast(errorText(error), 'error')
    await refresh()
    setEditPrice(null)
    toast('Precio guardado')
  }

  async function onDelete() {
    if (!confirm(`¿Eliminar «${p!.name}»? Se borrará también su historial de compras.`)) return
    const { error } = await supabase.from('products').delete().eq('id', p!.id)
    if (error) return toast(errorText(error), 'error')
    deleteProductImage(p!.image_url)
    await refresh()
    toast('Producto eliminado')
    navigate('/productos', { replace: true })
  }

  const sms = p.product_supermarkets?.map((x) => smById.get(x.supermarket_id)).filter(Boolean) ?? []

  return (
    <div className="page">
      <header className="page-header">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver"><ArrowLeft /></button>
        <span className="grow" />
        <Link className="icon-btn" to={`/productos/${p.id}/editar`} aria-label="Editar"><Pencil size={20} /></Link>
      </header>

      <div className="detail-hero">
        <ProductImage product={p} size={112} />
        <div className="grow">
          <span className="tag" style={{ color: cat.color }}>{cat.emoji} {cat.name}</span>
          <h1 style={{ fontSize: '1.6rem', marginTop: 6 }}>{p.name}</h1>
          {p.brand && <p className="muted" style={{ margin: '4px 0 0' }}>{p.brand}</p>}
          <div className="tags" style={{ marginTop: 6 }}>
            {sms.length === 0 ? <span className="tag" style={{ color: 'var(--muted)' }}>Cualquier supermercado</span> :
              sms.map((s) => <span key={s!.id} className="tag" style={{ color: s!.color }}>{s!.name}</span>)}
          </div>
        </div>
      </div>

      {pending ? (
        <p className="notice">En la lista ×{pending.quantity}, lo apuntó {firstName(memberName(pending.added_by))} {timeAgo(pending.added_at)}</p>
      ) : (
        <button className="btn primary big" onClick={onAdd}><Plus size={20} /> Apuntar en la lista</button>
      )}

      {supermarkets.length > 0 && (
        <>
          <h3 className="section-title">Precio</h3>
          <ul className="price-list">
            {priceRows.map((s) => {
              const pr = priceBySm.get(s.id)
              return (
                <li key={s.id} onClick={() => setEditPrice({ smId: s.id, value: pr ? String(pr.price).replace('.', ',') : '' })}>
                  <span className="swatch-dot" style={{ background: s.color }} />
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    {pr && <div className="muted small">{SOURCE[pr.source] ?? pr.source}, {timeAgo(pr.updated_at)}</div>}
                  </div>
                  <PriceTag value={pr ? Number(pr.price) : null} onClick={() => setEditPrice({ smId: s.id, value: pr ? String(pr.price).replace('.', ',') : '' })} />
                </li>
              )
            })}
          </ul>
        </>
      )}

      <section className="stats">
        <div className="stat"><b>{st?.times_bought ?? 0}</b><span>veces comprado</span></div>
        <div className="stat"><b>{st?.total_quantity ?? 0}</b><span>unidades en total</span></div>
        <div className="stat"><b>{st?.last_bought ? timeAgo(st.last_bought) : '—'}</b><span>última compra</span></div>
        <div className="stat"><b>{st?.avg_days_between ? `${Math.round(st.avg_days_between)} días` : '—'}</b><span>se compra cada</span></div>
      </section>
      {nextHint && <p className="muted small center-text" style={{ margin: 0 }}>{nextHint}</p>}

      <h3 className="section-title">Historial de compras</h3>
      {history === null ? <Spinner /> : history.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>Aún no se ha comprado nunca.</p>
      ) : (
        <ul className="history">
          {history.map((h) => {
            const s = h.trips?.supermarket_id ? smById.get(h.trips.supermarket_id) : undefined
            const who = h.trips?.shoppers?.length ? h.trips.shoppers : h.trips?.done_by ? [h.trips.done_by] : []
            return (
              <li key={h.id}>
                <Link to={`/historial/${h.trip_id}`}>
                  <span style={{ fontWeight: 600 }}>{formatDateTime(h.purchased_at)}</span>
                  <span className="muted">{s?.name ?? 'Sin supermercado'}, {who.map((x) => firstName(memberName(x))).join(' y ')}</span>
                  <span className="num">×{h.quantity}</span>
                  {h.unit_price != null && <PriceTag value={Number(h.unit_price)} />}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {st?.first_bought && <p className="muted small" style={{ margin: 0 }}>Primera compra registrada: {formatDate(st.first_bought)}</p>}

      <button className="btn ghost danger" onClick={onDelete}><Trash2 size={18} /> Eliminar producto</button>

      <Sheet open={editPrice !== null} onClose={() => setEditPrice(null)} title={`Precio en ${smById.get(editPrice?.smId ?? '')?.name ?? ''}`}>
        {editPrice && (
          <>
            <input inputMode="decimal" className="amount-input" placeholder="0,00 €" autoFocus value={editPrice.value}
              onChange={(e) => setEditPrice({ ...editPrice, value: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && savePrice()} />
            <p className="hint" style={{ margin: 0 }}>Déjalo vacío para borrarlo. Se actualiza solo cada vez que lo compráis.</p>
            <button className="btn primary big" onClick={savePrice}>Guardar precio</button>
          </>
        )}
      </Sheet>
    </div>
  )
}
