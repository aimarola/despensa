import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Product, Supermarket } from '../lib/types'

const PALETTE = ['#e8590c', '#2f9e44', '#1971c2', '#9c36b5', '#c2255c', '#0c8599', '#f08c00', '#5c940d']
function colorFor(text: string) {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

/** Miniatura del producto; si no hay foto, muestra la inicial */
export function ProductImage({ product, size = 52 }: { product: Pick<Product, 'name' | 'image_url'> | undefined; size?: number }) {
  const [failed, setFailed] = useState(false)
  const name = product?.name ?? '?'
  const style = { width: size, height: size, minWidth: size }
  if (product?.image_url && !failed) {
    return <img className="thumb" style={style} src={product.image_url} alt="" loading="lazy" onError={() => setFailed(true)} />
  }
  return (
    <div className="thumb thumb-letter" style={{ ...style, background: colorFor(name), fontSize: size * 0.42 }}>
      {name.trim().charAt(0).toUpperCase()}
    </div>
  )
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
        <button
          key={s.id}
          className={`chip ${value === s.id ? 'active' : ''}`}
          style={value === s.id ? { background: s.color, borderColor: s.color } : { borderColor: s.color }}
          onClick={() => onChange(s.id)}
        >
          {s.name}{counts ? <b>{counts.get(s.id) ?? 0}</b> : null}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, onChange, min = 1 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="stepper" onClick={(e) => e.stopPropagation()}>
      <button aria-label="Menos" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>−</button>
      <span>{value}</span>
      <button aria-label="Más" onClick={() => onChange(value + 1)}>+</button>
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
      <div className="photo-preview" onClick={() => cameraRef.current?.click()}>
        {preview && broken !== preview
          ? <img src={preview} alt="Foto del producto" onError={() => setBroken(preview)} />
          : <span>📷<br />{preview ? 'Foto no disponible' : 'Sin foto'}</span>}
      </div>
      <div className="photo-actions">
        <button type="button" className="btn" onClick={() => cameraRef.current?.click()}>📷 Hacer foto</button>
        <button type="button" className="btn ghost" onClick={() => galleryRef.current?.click()}>🖼️ Galería</button>
        {preview && <button type="button" className="btn ghost danger" onClick={onClear}>Quitar foto</button>}
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
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M17 8v8" />
            </svg>
  )
}
