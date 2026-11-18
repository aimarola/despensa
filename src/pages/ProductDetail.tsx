import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ProductImage, Spinner } from '../components/ui'
import { addToList } from '../lib/actions'
import { formatDate, formatDateTime, timeAgo } from '../lib/format'
import { deleteProductImage } from '../lib/images'
import { errorText, supabase } from '../lib/supabase'
import { useData, useToast } from '../store'

interface HistoryRow {
  id: string
  quantity: number
  purchased_at: string
  trip_id: string
  trips: { supermarket_id: string | null; done_by: string | null } | null
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { ready, productsById, supermarkets, stats, list, memberName, refresh } = useData()
  const [history, setHistory] = useState<HistoryRow[] | null>(null)
  const p = id ? productsById.get(id) : undefined
  const st = id ? stats.get(id) : undefined
  const pending = list.find((l) => l.product_id === id)
  const smById = new Map(supermarkets.map((s) => [s.id, s]))

  useEffect(() => {
    if (!id) return
    supabase
      .from('purchases')
      .select('id, quantity, purchased_at, trip_id, trips(supermarket_id, done_by)')
      .eq('product_id', id)
      .order('purchased_at', { ascending: false })
      .limit(100)
      .then(({ data }) => setHistory((data ?? []) as unknown as HistoryRow[]))
  }, [id, st?.times_bought])

  if (!ready) return <Spinner />
  if (!p) return <div className="page"><p>Producto no encontrado.</p><Link to="/productos">Volver</Link></div>

  // Estimación: ¿toca comprarlo pronto?
  let nextHint: string | null = null
  if (st?.avg_days_between && st.last_bought) {
    const due = new Date(st.last_bought).getTime() + st.avg_days_between * 86400000
    const days = Math.round((due - Date.now()) / 86400000)
    nextHint = days <= 0 ? 'Por lo habitual, ya debería tocar comprarlo' : `Por lo habitual, tocará en unos ${days} días`
  }

  async function onAdd() {
    try { await addToList(p!.id); await refresh(); toast(`Apuntado: ${p!.name}`) } catch (e) { toast(errorText(e), 'error') }
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
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver">←</button>
        <h1 className="ellipsis">{p.name}</h1>
        <Link className="icon-btn" to={`/productos/${p.id}/editar`} aria-label="Editar">✏️</Link>
      </header>

      <div className="detail-hero">
        <ProductImage product={p} size={120} />
        <div>
          <h2>{p.name}</h2>
          {p.brand && <p className="muted">{p.brand}</p>}
          {p.barcode && <p className="muted small">Código: {p.barcode}</p>}
          <div className="tags">
            {sms.length === 0 ? <span className="tag">Cualquier supermercado</span> :
              sms.map((s) => <span key={s!.id} className="tag" style={{ color: s!.color, borderColor: s!.color }}>{s!.name}</span>)}
          </div>
        </div>
      </div>

      {pending ? (
        <p className="notice">En la lista ×{pending.quantity} · apuntado por {memberName(pending.added_by)} {timeAgo(pending.added_at)}</p>
      ) : (
        <button className="btn primary big" onClick={onAdd}>＋ Apuntar en la lista</button>
      )}

      <section className="stats">
        <div className="stat"><b>{st?.times_bought ?? 0}</b><span>veces comprado</span></div>
        <div className="stat"><b>{st?.total_quantity ?? 0}</b><span>unidades</span></div>
        <div className="stat"><b>{st?.last_bought ? timeAgo(st.last_bought) : '—'}</b><span>última compra</span></div>
        <div className="stat"><b>{st?.avg_days_between ? `${Math.round(st.avg_days_between)} días` : '—'}</b><span>cada (media)</span></div>
      </section>
      {nextHint && <p className="muted small center-text">{nextHint}</p>}

      <h3 className="section-title">Historial de compras</h3>
      {history === null ? <Spinner /> : history.length === 0 ? (
        <p className="muted">Aún no se ha comprado nunca.</p>
      ) : (
        <ul className="history">
          {history.map((h) => {
            const s = h.trips?.supermarket_id ? smById.get(h.trips.supermarket_id) : undefined
            return (
              <li key={h.id}>
                <Link to={`/historial/${h.trip_id}`}>
                  <span>{formatDateTime(h.purchased_at)}</span>
                  <span className="muted">{s?.name ?? 'Sin supermercado'} · {memberName(h.trips?.done_by ?? null)}</span>
                  <b>×{h.quantity}</b>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {st?.first_bought && <p className="muted small">Primera compra registrada: {formatDate(st.first_bought)}</p>}

      <button className="btn ghost danger" onClick={onDelete}>Eliminar producto</button>
    </div>
  )
}
