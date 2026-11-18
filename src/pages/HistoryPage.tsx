import { ArrowLeft, Pencil } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar, Empty, PriceTag, ProductImage, Sheet, Spinner } from '../components/ui'
import { euro, firstName, formatDateTime, parsePrice, timeAgo } from '../lib/format'
import { errorText, supabase } from '../lib/supabase'
import type { Purchase, Trip } from '../lib/types'
import { useAuth, useData, useToast } from '../store'

const tripAmount = (t: Trip) => t.total_amount ?? t.estimated_total
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function Shoppers({ ids }: { ids: string[] }) {
  const { memberName } = useData()
  return <span className="avatars">{ids.map((id) => <Avatar key={id} name={memberName(id)} />)}</span>
}

export function HistoryPage() {
  const { household } = useAuth()
  const { supermarkets, memberName, stats, productsById } = useData()
  const [trips, setTrips] = useState<Trip[] | null>(null)
  const smById = new Map(supermarkets.map((s) => [s.id, s]))
  const statsKey = stats.size + [...stats.values()].reduce((a, s) => a + s.times_bought, 0)

  useEffect(() => {
    supabase
      .from('trips').select('*')
      .eq('household_id', household!.id)
      .order('done_at', { ascending: false })
      .limit(500)
      .then(({ data }) => setTrips((data ?? []) as Trip[]))
  }, [household, statsKey])

  // Gasto de los últimos 6 meses
  const months = useMemo(() => {
    const now = new Date()
    const res: { key: string; label: string; total: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      res.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS[d.getMonth()], total: 0 })
    }
    for (const t of trips ?? []) {
      const d = new Date(t.done_at)
      const m = res.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`)
      if (m) m.total += Number(tripAmount(t) ?? 0)
    }
    return res
  }, [trips])
  const thisMonth = months[months.length - 1]
  const maxMonth = Math.max(1, ...months.map((m) => m.total))
  const tripsThisMonth = (trips ?? []).filter((t) => { const d = new Date(t.done_at), n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() }).length

  const top = [...stats.values()].sort((a, b) => b.times_bought - a.times_bought).slice(0, 5)

  return (
    <div className="page">
      <header className="page-header"><div><h1>Historial</h1><p className="sub">Qué se ha comprado, cuándo y cuánto ha costado</p></div></header>

      {trips && trips.length > 0 && (
        <section className="spend">
          <div className="row">
            <div>
              <small>Gastado en {new Date().toLocaleDateString('es-ES', { month: 'long' })}</small>
              <div className="amount">{euro(thisMonth.total)}</div>
            </div>
            <small>{tripsThisMonth} {tripsThisMonth === 1 ? 'compra' : 'compras'}</small>
          </div>
          <div className="bars" aria-label="Gasto de los últimos seis meses">
            {months.map((m, i) => (
              <div key={m.key} className={i === months.length - 1 ? 'now' : ''} title={`${m.label}: ${euro(m.total)}`}>
                <i style={{ height: `${(m.total / maxMonth) * 44}px` }} />{m.label}
              </div>
            ))}
          </div>
        </section>
      )}

      {top.length > 0 && (
        <>
          <h3 className="section-title">Lo que más compráis</h3>
          <ul className="top">
            {top.map((s) => {
              const p = productsById.get(s.product_id)
              return (
                <li key={s.product_id}>
                  <Link to={`/productos/${s.product_id}`}>
                    <ProductImage product={p} size={40} />
                    <span className="grow">{p?.name}</span>
                    <b className="num">{s.times_bought} {s.times_bought === 1 ? 'vez' : 'veces'}</b>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <h3 className="section-title">Compras</h3>
      {trips === null ? <Spinner /> : trips.length === 0 ? (
        <Empty icon="🧾" title="Todavía no hay compras">Cuando termines una compra con «Finalizar compra», aparecerá aquí con su ticket.</Empty>
      ) : (
        <ul className="tickets">
          {trips.map((t) => {
            const s = t.supermarket_id ? smById.get(t.supermarket_id) : undefined
            const who = t.shoppers?.length ? t.shoppers : t.done_by ? [t.done_by] : []
            const amount = tripAmount(t)
            return (
              <li key={t.id}>
                <Link to={`/historial/${t.id}`} className="ticket" style={{ '--c': s?.color ?? 'var(--line)' } as React.CSSProperties}>
                  <div className="grow">
                    <strong>{s?.name ?? 'Compra'}</strong>
                    <div className="when">{formatDateTime(t.done_at)} · {t.item_count} {t.item_count === 1 ? 'producto' : 'productos'}</div>
                    <div className="when">{who.map((id) => firstName(memberName(id))).join(' y ')}</div>
                  </div>
                  <Shoppers ids={who} />
                  {amount != null ? <PriceTag value={Number(amount)} approx={t.total_amount == null} /> : <span className="muted small">sin total</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function TripDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { supermarkets, memberName, members, productsById } = useData()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [items, setItems] = useState<Purchase[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [shoppers, setShoppers] = useState<string[]>([])
  const [total, setTotal] = useState('')

  useEffect(() => {
    supabase.from('trips').select('*').eq('id', id!).maybeSingle().then(({ data }) => setTrip(data as Trip | null))
    supabase.from('purchases').select('*').eq('trip_id', id!).then(({ data }) => setItems((data ?? []) as Purchase[]))
  }, [id])

  if (!trip || !items) return <Spinner />
  const s = supermarkets.find((x) => x.id === trip.supermarket_id)
  const who = trip.shoppers?.length ? trip.shoppers : trip.done_by ? [trip.done_by] : []
  const sorted = [...items].sort((a, b) => (productsById.get(a.product_id)?.name ?? '').localeCompare(productsById.get(b.product_id)?.name ?? ''))

  async function save() {
    const patch = { shoppers, total_amount: parsePrice(total) }
    const { error } = await supabase.from('trips').update(patch).eq('id', trip!.id)
    if (error) return toast(errorText(error), 'error')
    setTrip({ ...trip!, ...patch })
    setEditing(false)
    toast('Compra actualizada')
  }

  return (
    <div className="page">
      <header className="page-header">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver"><ArrowLeft /></button>
        <h1 className="ellipsis">Ticket</h1>
        <button className="icon-btn" aria-label="Editar compra" onClick={() => {
          setShoppers(who); setTotal(trip.total_amount != null ? String(trip.total_amount).replace('.', ',') : ''); setEditing(true)
        }}><Pencil size={20} /></button>
      </header>

      <article className="receipt">
        <div className="head">
          <h2>{s?.name ?? 'Compra'}</h2>
          <div className="muted small">{formatDateTime(trip.done_at)} ({timeAgo(trip.done_at)})</div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <Shoppers ids={who} />
            <span className="small">{who.map((x) => firstName(memberName(x))).join(' y ') || 'Sin indicar'}</span>
          </div>
        </div>
        {sorted.map((it) => {
          const p = productsById.get(it.product_id)
          return (
            <div className="line" key={it.id}>
              <ProductImage product={p} size={36} />
              <Link to={`/productos/${it.product_id}`} className="grow">
                <div>{p?.name ?? 'Producto eliminado'}</div>
                {it.unit_price != null && it.quantity > 1 && <div className="muted small">{it.quantity} × {euro(Number(it.unit_price))}</div>}
                {it.unit_price == null && it.quantity > 1 && <div className="muted small">×{it.quantity}</div>}
              </Link>
              <span className="num">{it.unit_price != null ? euro(Number(it.unit_price) * it.quantity) : '—'}</span>
            </div>
          )
        })}
        <div className="total">
          <span>Total</span>
          <span>{trip.total_amount != null ? euro(Number(trip.total_amount)) : trip.estimated_total != null ? `≈ ${euro(Number(trip.estimated_total))}` : '—'}</span>
        </div>
        {trip.total_amount != null && trip.estimated_total != null && Number(trip.total_amount) !== Number(trip.estimated_total) && (
          <p className="muted small" style={{ textAlign: 'right', margin: '6px 0 0' }}>Suma de precios conocidos: {euro(Number(trip.estimated_total))}</p>
        )}
      </article>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Editar compra">
        <div className="legend" style={{ fontWeight: 700 }}>¿Quién fue a comprar?</div>
        <div className="member-pick">
          {members.map((m) => {
            const on = shoppers.includes(m.user_id)
            return (
              <button key={m.user_id} type="button" className={`member-chip ${on ? 'on' : ''}`}
                onClick={() => setShoppers(on ? shoppers.filter((x) => x !== m.user_id) : [...shoppers, m.user_id])}>
                <Avatar name={m.display_name} />{firstName(m.display_name)}
              </button>
            )
          })}
        </div>
        <label>Total del ticket
          <input inputMode="decimal" className="amount-input" placeholder="0,00 €" value={total} onChange={(e) => setTotal(e.target.value)} />
        </label>
        <button className="btn primary big" onClick={save} disabled={shoppers.length === 0}>Guardar cambios</button>
      </Sheet>
    </div>
  )
}
