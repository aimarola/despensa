import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Empty, ProductImage, Spinner } from '../components/ui'
import { formatDateTime, timeAgo } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Purchase, Trip } from '../lib/types'
import { useAuth, useData } from '../store'

export function HistoryPage() {
  const { household } = useAuth()
  const { supermarkets, memberName, stats, productsById, list } = useData()
  const [trips, setTrips] = useState<Trip[] | null>(null)
  const smById = new Map(supermarkets.map((s) => [s.id, s]))

  useEffect(() => {
    supabase
      .from('trips').select('*')
      .eq('household_id', household!.id)
      .order('done_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setTrips((data ?? []) as Trip[]))
  }, [household, list.length])

  const top = [...stats.values()].sort((a, b) => b.times_bought - a.times_bought).slice(0, 5)

  return (
    <div className="page">
      <header className="page-header"><div><h1>Historial</h1><p className="muted">Cuándo y qué se ha comprado</p></div></header>

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
                    <b>{s.times_bought}×</b>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <h3 className="section-title">Compras</h3>
      {trips === null ? <Spinner /> : trips.length === 0 ? (
        <Empty icon="🧾" title="Todavía no hay compras">Cuando termines una compra con «He hecho la compra», aparecerá aquí.</Empty>
      ) : (
        <ul className="trips">
          {trips.map((t) => {
            const s = t.supermarket_id ? smById.get(t.supermarket_id) : undefined
            return (
              <li key={t.id}>
                <Link to={`/historial/${t.id}`}>
                  <span className="dot" style={{ background: s?.color ?? '#adb5bd' }} />
                  <div className="grow">
                    <strong>{s?.name ?? 'Compra'}</strong>
                    <div className="meta">{formatDateTime(t.done_at)} · {memberName(t.done_by)}</div>
                  </div>
                  <span className="badge">{t.item_count} prod.</span>
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
  const { supermarkets, memberName, productsById } = useData()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [items, setItems] = useState<Purchase[] | null>(null)

  useEffect(() => {
    supabase.from('trips').select('*').eq('id', id!).maybeSingle().then(({ data }) => setTrip(data as Trip | null))
    supabase.from('purchases').select('*').eq('trip_id', id!).then(({ data }) => setItems((data ?? []) as Purchase[]))
  }, [id])

  if (!trip || !items) return <Spinner />
  const s = supermarkets.find((x) => x.id === trip.supermarket_id)
  const sorted = [...items].sort((a, b) =>
    (productsById.get(a.product_id)?.name ?? '').localeCompare(productsById.get(b.product_id)?.name ?? ''))

  return (
    <div className="page">
      <header className="page-header">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver">←</button>
        <h1>{s?.name ?? 'Compra'}</h1>
        <span />
      </header>
      <p className="muted">{formatDateTime(trip.done_at)} ({timeAgo(trip.done_at)}) · hecha por {memberName(trip.done_by)}</p>
      <ul className="items">
        {sorted.map((it) => {
          const p = productsById.get(it.product_id)
          return (
            <li key={it.id} className="item">
              <Link to={`/productos/${it.product_id}`} className="item-main">
                <ProductImage product={p} />
                <div className="item-text"><strong>{p?.name ?? 'Producto eliminado'}</strong></div>
              </Link>
              <b className="qty">×{it.quantity}</b>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
