import { useMemo, useState } from 'react'
import { normalize } from '../lib/format'
import type { Product } from '../lib/types'
import { useData } from '../store'
import { ProductImage, ScanIcon } from './ui'

interface Props {
  placeholder?: string
  onPick: (p: Product) => void
  onCreate: (name: string) => void
  onScan: () => void
  /** Etiqueta opcional junto a cada sugerencia (p.ej. "En la lista") */
  badge?: (p: Product) => string | null
}

/** Buscador para apuntar rápido: escribe, toca la sugerencia y listo */
export default function QuickAdd({ placeholder = 'Apuntar lo que falta…', onPick, onCreate, onScan, badge }: Props) {
  const { products, stats } = useData()
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)

  const suggestions = useMemo(() => {
    const nq = normalize(q)
    if (!nq) {
      // Sin texto: los que más se compran
      return [...products]
        .sort((a, b) => (stats.get(b.id)?.times_bought ?? 0) - (stats.get(a.id)?.times_bought ?? 0))
        .slice(0, 8)
    }
    const words = nq.split(/\s+/)
    return products
      .filter((p) => {
        const hay = normalize(`${p.name} ${p.brand ?? ''} ${p.barcode ?? ''}`)
        return words.every((w) => hay.includes(w))
      })
      .sort((a, b) => Number(normalize(b.name).startsWith(nq)) - Number(normalize(a.name).startsWith(nq)))
      .slice(0, 8)
  }, [q, products, stats])

  const exact = suggestions.some((p) => normalize(p.name) === normalize(q))

  function pick(p: Product) {
    onPick(p)
    setQ('')
  }

  return (
    <div className="quickadd">
      <div className="quickadd-bar">
        <input
          type="search"
          enterKeyHint="done"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (suggestions[0] && q.trim()) pick(suggestions[0])
              else if (q.trim()) onCreate(q.trim())
            }
          }}
        />
        <button className="scan-btn" onClick={onScan} aria-label="Escanear código de barras">
          <ScanIcon />
        </button>
      </div>
      {focused && (suggestions.length > 0 || q.trim()) && (
        <ul className="suggestions">
          {!q.trim() && <li className="suggestions-hint">Lo que más compráis</li>}
          {suggestions.map((p) => (
            <li key={p.id}>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}>
                <ProductImage product={p} size={36} />
                <span className="grow">
                  {p.name}
                  {p.brand && <small> · {p.brand}</small>}
                </span>
                {badge?.(p) && <span className="badge">{badge(p)}</span>}
                <span className="plus">＋</span>
              </button>
            </li>
          ))}
          {q.trim() && !exact && (
            <li>
              <button className="create" onMouseDown={(e) => e.preventDefault()} onClick={() => { onCreate(q.trim()); setQ('') }}>
                <span className="thumb thumb-letter" style={{ width: 36, height: 36, minWidth: 36, background: 'var(--accent)' }}>＋</span>
                <span className="grow">Crear «{q.trim()}»</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
