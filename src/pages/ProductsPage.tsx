import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BarcodeScanner from '../components/BarcodeScanner'
import { Empty, ProductImage, ScanIcon, Spinner, SupermarketChips } from '../components/ui'
import { addToList } from '../lib/actions'
import { normalize, timeAgo } from '../lib/format'
import { errorText } from '../lib/supabase'
import { useBarcodeAdd } from '../lib/useBarcodeAdd'
import { soldAt, useData, useToast } from '../store'

type Sort = 'name' | 'most' | 'recent'

export default function ProductsPage() {
  const { ready, products, supermarkets, stats, list, refresh } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('name')
  const [scanning, setScanning] = useState(false)
  // Escanear aquí abre la ficha si existe; si no, la crea (sin apuntarla)
  const { handle } = useBarcodeAdd({
    onKnown: (pid) => { navigate(`/productos/${pid}`) },
  })
  const pending = new Map(list.map((l) => [l.product_id, l]))

  const visible = useMemo(() => {
    const nq = normalize(q)
    const res = products.filter(
      (p) => soldAt(p, filter) && (!nq || normalize(`${p.name} ${p.brand ?? ''} ${p.barcode ?? ''}`).includes(nq)),
    )
    if (sort === 'most') res.sort((a, b) => (stats.get(b.id)?.times_bought ?? 0) - (stats.get(a.id)?.times_bought ?? 0))
    if (sort === 'recent') res.sort((a, b) => (stats.get(b.id)?.last_bought ?? '').localeCompare(stats.get(a.id)?.last_bought ?? ''))
    return res
  }, [products, q, filter, sort, stats])

  async function add(pid: string, name: string) {
    try { await addToList(pid); await refresh(); toast(`Apuntado: ${name}`) } catch (e) { toast(errorText(e), 'error') }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Productos</h1>
          <p className="muted">{products.length} en vuestro catálogo</p>
        </div>
        <Link className="btn primary" to="/productos/nuevo" state={{ addToList: false }}>＋ Nuevo</Link>
      </header>

      <div className="quickadd-bar">
        <input type="search" placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="scan-btn" onClick={() => setScanning(true)} aria-label="Buscar por código de barras"><ScanIcon /></button>
      </div>
      <SupermarketChips supermarkets={supermarkets} value={filter} onChange={setFilter} />
      <div className="segmented small">
        <button className={sort === 'name' ? 'active' : ''} onClick={() => setSort('name')}>A-Z</button>
        <button className={sort === 'most' ? 'active' : ''} onClick={() => setSort('most')}>Top</button>
        <button className={sort === 'recent' ? 'active' : ''} onClick={() => setSort('recent')}>Recientes</button>
      </div>

      {!ready ? <Spinner /> : visible.length === 0 ? (
        <Empty icon="📦" title={products.length ? 'Sin resultados' : 'Aún no hay productos'}>
          {products.length ? 'Prueba con otra búsqueda.' : 'Se crean solos al apuntar cosas en la lista, o pulsa «Nuevo».'}
        </Empty>
      ) : (
        <ul className="items">
          {visible.map((p) => {
            const st = stats.get(p.id)
            const li = pending.get(p.id)
            return (
              <li key={p.id} className="item">
                <Link to={`/productos/${p.id}`} className="item-main">
                  <ProductImage product={p} />
                  <div className="item-text">
                    <strong>{p.name}</strong>
                    {p.brand && <small className="muted"> {p.brand}</small>}
                    <div className="meta">
                      {st ? `Comprado ${st.times_bought} ${st.times_bought === 1 ? 'vez' : 'veces'} · última ${timeAgo(st.last_bought)}` : 'Nunca comprado'}
                    </div>
                  </div>
                </Link>
                <div className="item-side">
                  {li ? <span className="badge">En lista ×{li.quantity}</span> : (
                    <button className="btn small" onClick={() => add(p.id, p.name)}>＋ Lista</button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {scanning && (
        <BarcodeScanner
          title="Buscar por código"
          onClose={() => setScanning(false)}
          onDetected={(code) => { setScanning(false); handle(code) }}
        />
      )}
    </div>
  )
}
