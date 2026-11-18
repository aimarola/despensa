import { Check, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BarcodeScanner from '../components/BarcodeScanner'
import { Empty, GroupHead, PriceTag, ProductImage, ScanIcon, Spinner, SupermarketChips } from '../components/ui'
import { addToList } from '../lib/actions'
import { CATEGORIES, CATEGORY_ORDER } from '../lib/categories'
import { normalize, timeAgo } from '../lib/format'
import { errorText } from '../lib/supabase'
import type { Product } from '../lib/types'
import { useBarcodeAdd } from '../lib/useBarcodeAdd'
import { soldAt, useData, useToast } from '../store'

type Sort = 'cat' | 'name' | 'most' | 'recent'

export default function ProductsPage() {
  const { ready, products, supermarkets, stats, list, refresh, priceOf } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [store, setStore] = useState<string | null>(null)
  const [cat, setCat] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('cat')
  const [scanning, setScanning] = useState(false)
  const { handle } = useBarcodeAdd({ onKnown: (pid) => { navigate(`/productos/${pid}`) } })
  const pending = new Map(list.map((l) => [l.product_id, l]))

  const catCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) if (soldAt(p, store)) m.set(p.category || 'otros', (m.get(p.category || 'otros') ?? 0) + 1)
    return m
  }, [products, store])

  const visible = useMemo(() => {
    const nq = normalize(q)
    const res = products.filter((p) =>
      soldAt(p, store) && (!cat || (p.category || 'otros') === cat) &&
      (!nq || normalize(`${p.name} ${p.brand ?? ''} ${p.barcode ?? ''}`).includes(nq)))
    if (sort === 'most') res.sort((a, b) => (stats.get(b.id)?.times_bought ?? 0) - (stats.get(a.id)?.times_bought ?? 0))
    if (sort === 'recent') res.sort((a, b) => (stats.get(b.id)?.last_bought ?? '').localeCompare(stats.get(a.id)?.last_bought ?? ''))
    return res
  }, [products, q, store, cat, sort, stats])

  const groups = useMemo(() => {
    if (sort !== 'cat') return [['', visible] as [string, Product[]]]
    const g = new Map<string, Product[]>()
    for (const p of visible) g.set(p.category || 'otros', [...(g.get(p.category || 'otros') ?? []), p])
    return [...g.entries()].sort((a, b) => (CATEGORY_ORDER.get(a[0]) ?? 99) - (CATEGORY_ORDER.get(b[0]) ?? 99))
  }, [visible, sort])

  async function add(p: Product) {
    try { await addToList(p.id); await refresh(); toast(`Apuntado: ${p.name}`) } catch (e) { toast(errorText(e), 'error') }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Productos</h1>
          <p className="sub">{products.length} en vuestro catálogo</p>
        </div>
        <Link className="btn primary" to="/productos/nuevo" state={{ addToList: false, prefill: cat ? { category: cat } : undefined }}><Plus size={18} /> Nuevo</Link>
      </header>

      <div className="quickadd-bar search">
        <input type="search" placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="scan-btn" onClick={() => setScanning(true)} aria-label="Buscar por código de barras"><ScanIcon /></button>
      </div>

      <div className="chips" aria-label="Categorías">
        <button className={`chip cat ${cat === null ? 'active' : ''}`} onClick={() => setCat(null)}><span className="emo">🛒</span>Todo</button>
        {CATEGORIES.filter((c) => catCounts.get(c.id)).map((c) => (
          <button key={c.id} className={`chip cat ${cat === c.id ? 'active' : ''}`} onClick={() => setCat(cat === c.id ? null : c.id)}>
            <span className="emo">{c.emoji}</span>{c.name}<b>{catCounts.get(c.id)}</b>
          </button>
        ))}
      </div>
      <SupermarketChips supermarkets={supermarkets} value={store} onChange={setStore} />
      <div className="segmented small">
        <button className={sort === 'cat' ? 'active' : ''} onClick={() => setSort('cat')}>Categorías</button>
        <button className={sort === 'name' ? 'active' : ''} onClick={() => setSort('name')}>A-Z</button>
        <button className={sort === 'most' ? 'active' : ''} onClick={() => setSort('most')}>Top</button>
        <button className={sort === 'recent' ? 'active' : ''} onClick={() => setSort('recent')}>Recientes</button>
      </div>

      {!ready ? <Spinner /> : visible.length === 0 ? (
        <Empty icon="📦" title={products.length ? 'Sin resultados' : 'Aún no hay productos'}>
          {products.length ? 'Prueba con otra búsqueda o categoría.' : 'Se crean solos al apuntar cosas en la lista, o pulsa «Nuevo».'}
        </Empty>
      ) : groups.map(([g, items]) => (
        <section className="group" key={g || 'all'}>
          {g && <GroupHead categoryId={g} count={items.length} />}
          <ul className="items">
            {items.map((p) => {
              const st = stats.get(p.id)
              const li = pending.get(p.id)
              const price = priceOf(p.id, store)
              return (
                <li key={p.id} className="item">
                  <Link to={`/productos/${p.id}`} className="item-main">
                    <ProductImage product={p} />
                    <div className="item-text">
                      <strong>{p.name}</strong>
                      {p.brand && <span className="brand">{p.brand}</span>}
                      <span className="meta">
                        <span>{st ? `${st.times_bought} ${st.times_bought === 1 ? 'vez' : 'veces'}, la última ${timeAgo(st.last_bought)}` : 'Nunca comprado'}</span>
                        {price && <PriceTag value={price.price} approx={!price.exact} />}
                      </span>
                    </div>
                  </Link>
                  <div className="item-side">
                    {li ? <span className="badge"><Check size={13} style={{ verticalAlign: '-2px' }} /> En la lista</span> : (
                      <button className="btn small" onClick={() => add(p)} aria-label={`Apuntar ${p.name}`}><Plus size={16} /> Lista</button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {scanning && (
        <BarcodeScanner title="Buscar por código" onClose={() => setScanning(false)} onDetected={(code) => { setScanning(false); handle(code) }} />
      )}
    </div>
  )
}
