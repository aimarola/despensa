import { Camera, ImageIcon, Minus, Plus, ScanBarcode, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CATEGORIES, categoryOf } from '../lib/categories'
import { euro } from '../lib/format'
import type { Product, Supermarket } from '../lib/types'

const AVATAR_COLORS = ['#0e7c5a', '#c44536', '#2d7fb8', '#7a4e2d', '#6c63c7', '#cf6fae', '#e07a2f', '#3f9b4f']
export function colorFor(text: string) {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

/** Miniatura: la foto del producto o, si no hay, el icono de su categoría */
export function ProductImage({ product, size = 54 }: { product: Pick<Product, 'name' | 'image_url'> & { category?: string } | undefined; size?: number }) {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size, minWidth: size }
  if (product?.image_url && !failed) {
    return <img className="thumb" style={style} src={product.image_url} alt="" loading="lazy" onError={() => setFailed(true)} />
  }
  const cat = categoryOf(product?.category)
  if (cat.id !== 'otros') {
    return (
      <div className="thumb thumb-letter" style={{ ...style, background: `color-mix(in srgb, ${cat.color} 16%, var(--card))`, fontSize: size * 0.5 }}>
        {cat.emoji}
      </div>
    )
  }
  const name = product?.name ?? '?'
  return (
    <div className="thumb thumb-letter" style={{ ...style, background: colorFor(name), color: '#fff', fontSize: size * 0.42 }}>
      {name.trim().charAt(0).toUpperCase()}
    </div>
  )
}

export function Avatar({ name, size }: { name: string; size?: number }) {
  return (
    <span className="avatar" style={{ background: colorFor(name), ...(size ? { width: size, height: size } : {}) }} title={name}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

/** Etiqueta amarilla de precio, como las de la estantería */
export function PriceTag({ value, approx, big, onClick }: { value: number | null | undefined; approx?: boolean; big?: boolean; onClick?: () => void }) {
  const cls = `price-tag ${big ? 'big' : ''} ${value == null ? 'ghost' : approx ? 'approx' : ''}`
  const content = value == null ? '+ precio' : euro(value)
  if (onClick) {
    return <button type="button" className={cls} onClick={(e) => { e.stopPropagation(); onClick() }}>{content}</button>
  }
  return value == null ? null : <span className={cls}>{content}</span>
}

export function SupermarketChips({
  supermarkets, value, onChange, allLabel = 'Todos', counts,
}: {
  supermarkets: Supermarket[]
  value: string | null
  onChange: (id: string | null) => void
  allLabel?: string
  counts?: Map<string | null, number>
}) {
  if (supermarkets.length === 0) return null
  return (
    <div className="chips" role="tablist">
      <button className={`chip ${value === null ? 'active' : ''}`} onClick={() => onChange(null)}>
        {allLabel}{counts ? <b>{counts.get(null) ?? 0}</b> : null}
      </button>
      {supermarkets.map((s) => (
        <button key={s.id} className={`chip ${value === s.id ? 'active' : ''}`} onClick={() => onChange(s.id)}>
          <span className="dot" style={{ background: s.color }} />
          {s.name}{counts ? <b>{counts.get(s.id) ?? 0}</b> : null}
        </button>
      ))}
    </div>
  )
}

/** Selector visual de categoría (rejilla de iconos) */
export function CategoryPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="cat-grid">
      {CATEGORIES.map((c) => (
        <button
          type="button" key={c.id}
          className={`cat-tile ${value === c.id ? 'on' : ''}`}
          onClick={() => onChange(c.id)}
          aria-pressed={value === c.id}
        >
          <span className="emo">{c.emoji}</span>
          <span>{c.name}</span>
        </button>
      ))}
    </div>
  )
}

export function GroupHead({ categoryId, count, extra }: { categoryId: string; count?: number; extra?: ReactNode }) {
  const c = categoryOf(categoryId)
  return (
    <div className="group-head">
      <span className="bubble" style={{ background: `color-mix(in srgb, ${c.color} 18%, var(--card))` }}>{c.emoji}</span>
      <h3>{c.name}</h3>
      {extra}
      {count != null && <span className="count">{count}</span>}
    </div>
  )
}

export function Stepper({ value, onChange, min = 1 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="stepper" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Menos" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}><Minus size={18} strokeWidth={2.6} /></button>
      <span>{value}</span>
      <button type="button" aria-label="Más" onClick={() => onChange(value + 1)}><Plus size={18} strokeWidth={2.6} /></button>
    </div>
  )
}

/** Panel inferior tipo "bottom sheet" */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        {title && <h2 className="sheet-title">{title}</h2>}
        {children}
      </div>
    </div>
  )
}

/** Hacer una foto con la cámara del móvil o elegirla de la galería */
export function PhotoPicker({ preview, onFile, onClear }: { preview: string | null; onFile: (f: File) => void; onClear: () => void }) {
  const [broken, setBroken] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) onFile(f)
    e.target.value = ''
  }
  return (
    <div className="photo-picker">
      <button type="button" className="photo-preview" onClick={() => cameraRef.current?.click()} aria-label="Hacer foto">
        {preview && broken !== preview
          ? <img src={preview} alt="Foto del producto" onError={() => setBroken(preview)} />
          : <span><Camera size={28} /><br />{preview ? 'Foto no disponible' : 'Añadir foto'}</span>}
      </button>
      <div className="photo-actions">
        <button type="button" className="btn" onClick={() => cameraRef.current?.click()}><Camera size={18} /> Hacer foto</button>
        <button type="button" className="btn ghost" onClick={() => galleryRef.current?.click()}><ImageIcon size={18} /> Galería</button>
        {preview && <button type="button" className="btn ghost danger small" onClick={onClear}><Trash2 size={16} /> Quitar foto</button>}
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={pick} />
    </div>
  )
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  )
}

export function Spinner() {
  return <div className="center"><div className="spinner" /></div>
}

export function ScanIcon() {
  return <ScanBarcode size={24} strokeWidth={2.2} />
}
