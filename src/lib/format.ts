const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

export function timeAgo(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return 'ahora mismo'
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day')
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month')
  return rtf.format(Math.round(diff / (86400 * 365)), 'year')
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
export function euro(n: number | null | undefined): string {
  return n == null || Number.isNaN(n) ? '—' : eur.format(n)
}

/** Acepta "1,35", "1.35", "1,35 €" */
export function parsePrice(s: string): number | null {
  const v = parseFloat(s.replace(/[^0-9,.-]/g, '').replace(',', '.'))
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null
}

export function firstName(s: string): string {
  return s.trim().split(/\s+/)[0] ?? s
}
