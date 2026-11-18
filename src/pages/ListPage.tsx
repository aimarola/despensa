import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BarcodeScanner from '../components/BarcodeScanner'
import QuickAdd from '../components/QuickAdd'
import { Empty, ProductImage, Spinner, Stepper, SupermarketChips } from '../components/ui'
import { addToList, removeFromList, setQuantity } from '../lib/actions'
import { timeAgo } from '../lib/format'
import { errorText } from '../lib/supabase'
import type { NewProductState } from '../lib/useBarcodeAdd'
import { useBarcodeAdd } from '../lib/useBarcodeAdd'
import { soldAt, useAuth, useData, useToast } from '../store'

export default function ListPage() {
  const { household } = useAuth()
  const { ready, list, productsById, supermarkets, memberName, refresh } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const { handle, busy } = useBarcodeAdd()
  const smById = useMemo(() => new Map(supermarkets.map((s) => [s.id, s])), [supermarkets])

  const counts = useMemo(() => {
    const m = new Map<string | null, number>([[null, list.length]])
    for (const s of supermarkets) m.set(s.id, list.filter((li) => soldAt(productsById.get(li.product_id), s.id)).length)
    return m
  }, [list, supermarkets, productsById])

  const visible = list.filter((li) => soldAt(productsById.get(li.product_id), filter))
  const pendingIds = new Set(list.map((l) => l.product_id))

  async function run(fn: () => Promise<void>, ok?: string) {
    try { await fn(); await refresh(); if (ok) toast(ok) } catch (e) { toast(errorText(e), 'error') }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Lista</h1>
          <p className="muted">{household?.name} · {list.length === 0 ? 'no falta nada' : `faltan ${list.length}`}</p>
        </div>
      </header>

      <QuickAdd
        onPick={(p) => run(() => addToList(p.id), `Apuntado: ${p.name}`)}
        onCreate={(name) => navigate('/productos/nuevo', { state: { prefill: { name }, addToList: true } satisfies NewProductState })}
        onScan={() => setScanning(true)}
        badge={(p) => (pendingIds.has(p.id) ? 'En la lista' : null)}
      />

      <SupermarketChips supermarkets={supermarkets} value={filter} onChange={setFilter} counts={counts} />

      {!ready ? <Spinner /> : visible.length === 0 ? (
        <Empty icon="✅" title={list.length === 0 ? 'La lista está vacía' : 'Nada pendiente aquí'}>
          {list.length === 0 ? 'Cuando veas que algo se acaba, apúntalo arriba o escanea su código.' : 'Prueba con otro supermercado.'}
        </Empty>
      ) : (
        <ul className="items">
          {visible.map((li) => {
            const p = productsById.get(li.product_id)
            const sms = p?.product_supermarkets?.map((x) => smById.get(x.supermarket_id)).filter(Boolean) ?? []
            return (
              <li key={li.id} className="item">
                <Link to={`/productos/${li.product_id}`} className="item-main">
                  <ProductImage product={p} />
                  <div className="item-text">
                    <strong>{p?.name ?? '…'}</strong>
                    {p?.brand && <small className="muted"> {p.brand}</small>}
                    <div className="meta">
                      {memberName(li.added_by)} · {timeAgo(li.added_at)}
                    </div>
                    {sms.length > 0 && (
                      <div className="tags">
                        {sms.map((s) => <span key={s!.id} className="tag" style={{ color: s!.color, borderColor: s!.color }}>{s!.name}</span>)}
                      </div>
                    )}
                    {li.note && <div className="note">“{li.note}”</div>}
                  </div>
                </Link>
                <div className="item-side">
                  <Stepper value={li.quantity} onChange={(n) => run(() => setQuantity(li.id, n))} />
                  <button className="icon-btn" aria-label="Quitar de la lista" onClick={() => run(() => removeFromList(li.id), `Quitado: ${p?.name}`)}>🗑️</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {list.length > 0 && (
        <div className="bottom-cta">
          <button className="btn primary big" onClick={() => navigate('/comprar')}>🛒 Ir a comprar ({list.length})</button>
        </div>
      )}

      {busy && <div className="overlay-busy"><div className="spinner" /><p>Buscando el producto…</p></div>}
      {scanning && (
        <BarcodeScanner
          onClose={() => setScanning(false)}
          onDetected={(code) => { setScanning(false); handle(code) }}
        />
      )}
    </div>
  )
}
