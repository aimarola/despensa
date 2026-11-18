import { ShoppingCart, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BarcodeScanner from '../components/BarcodeScanner'
import QuickAdd from '../components/QuickAdd'
import { Empty, GroupHead, PriceTag, ProductImage, Spinner, Stepper, SupermarketChips } from '../components/ui'
import { addToList, removeFromList, setQuantity } from '../lib/actions'
import { CATEGORY_ORDER } from '../lib/categories'
import { euro, firstName, timeAgo } from '../lib/format'
import { errorText } from '../lib/supabase'
import type { ListItem } from '../lib/types'
import { useBarcodeAdd, type NewProductState } from '../lib/useBarcodeAdd'
import { soldAt, useAuth, useData, useToast } from '../store'

export default function ListPage() {
  const { household } = useAuth()
  const { ready, list, productsById, supermarkets, memberName, refresh, priceOf } = useData()
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
  const groups = useMemo(() => {
    const g = new Map<string, ListItem[]>()
    for (const li of visible) {
      const cat = productsById.get(li.product_id)?.category || 'otros'
      g.set(cat, [...(g.get(cat) ?? []), li])
    }
    return [...g.entries()].sort((a, b) => (CATEGORY_ORDER.get(a[0]) ?? 99) - (CATEGORY_ORDER.get(b[0]) ?? 99))
  }, [visible, productsById])

  let estimate = 0
  let priced = 0
  for (const li of visible) {
    const p = priceOf(li.product_id, filter)
    if (p) { estimate += p.price * li.quantity; priced++ }
  }
  const pendingIds = new Set(list.map((l) => l.product_id))

  async function run(fn: () => Promise<void>, ok?: string, undo?: () => Promise<void>) {
    try {
      await fn(); await refresh()
      if (ok) toast(ok, 'ok', undo ? { label: 'Deshacer', onClick: () => { undo().then(refresh) } } : undefined)
    } catch (e) { toast(errorText(e), 'error') }
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <h1>La lista</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>{household?.name}</p>
        </div>
        {list.length > 0 && (
          <div>
            <div className="count-big">{list.length}</div>
            <div className="count-label">{list.length === 1 ? 'cosa por comprar' : 'cosas por comprar'}</div>
          </div>
        )}
      </header>

      <QuickAdd
        onPick={(p) => run(() => addToList(p.id), `Apuntado: ${p.name}`)}
        onCreate={(name) => navigate('/productos/nuevo', { state: { prefill: { name }, addToList: true } satisfies NewProductState })}
        onScan={() => setScanning(true)}
        badge={(p) => (pendingIds.has(p.id) ? 'En la lista' : null)}
      />

      <SupermarketChips supermarkets={supermarkets} value={filter} onChange={setFilter} counts={counts} />

      {!ready ? <Spinner /> : visible.length === 0 ? (
        <Empty icon={list.length === 0 ? '🧺' : '🛒'} title={list.length === 0 ? 'No falta nada' : 'Nada que comprar aquí'}>
          {list.length === 0 ? 'Cuando algo se acabe, escríbelo arriba o escanea su código de barras.' : 'Prueba con otro supermercado.'}
        </Empty>
      ) : (
        groups.map(([cat, items]) => (
          <section className="group" key={cat}>
            <GroupHead categoryId={cat} count={items.length} />
            <ul className="items">
              {items.map((li) => {
                const p = productsById.get(li.product_id)
                const price = priceOf(li.product_id, filter)
                const sms = filter ? [] : (p?.product_supermarkets?.map((x) => smById.get(x.supermarket_id)).filter(Boolean) ?? [])
                return (
                  <li key={li.id} className="item">
                    <Link to={`/productos/${li.product_id}`} className="item-main">
                      <ProductImage product={p} />
                      <div className="item-text">
                        <strong>{p?.name ?? '…'}</strong>
                        {li.note && <span className="note">“{li.note}”</span>}
                        <span className="meta">
                          <span>{firstName(memberName(li.added_by))}, {timeAgo(li.added_at)}</span>
                          {price && <PriceTag value={price.price * li.quantity} approx={!price.exact} />}
                        </span>
                        {sms.length > 0 && (
                          <span className="tags">
                            {sms.map((s) => <span key={s!.id} className="tag" style={{ color: s!.color }}>{s!.name}</span>)}
                          </span>
                        )}
                      </div>
                    </Link>
                    <div className="item-side">
                      <Stepper value={li.quantity} onChange={(n) => run(() => setQuantity(li.id, n))} />
                      <button
                        className="icon-btn" aria-label={`Quitar ${p?.name} de la lista`}
                        onClick={() => run(() => removeFromList(li.id), `Quitado: ${p?.name}`, () => addToList(li.product_id, li.quantity, li.note ?? undefined))}
                      ><X size={20} /></button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}

      {list.length > 0 && (
        <div className="bottom-cta">
          <button className="btn primary big" onClick={() => navigate('/comprar')}>
            <ShoppingCart size={20} /> Ir a comprar
            {priced > 0 && <span style={{ opacity: .85, fontWeight: 600 }}>· ≈ {euro(estimate)}</span>}
          </button>
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
