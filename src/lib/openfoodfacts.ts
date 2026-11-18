/**
 * Identificación de productos por código de barras con las bases de datos
 * abiertas de Open Food Facts (alimentación), Open Products Facts (droguería,
 * limpieza…) y Open Beauty Facts (higiene). Gratis y sin clave.
 */
export interface BarcodeInfo {
  barcode: string
  name: string
  brand: string | null
  imageUrl: string | null
  quantity: string | null
}

const SOURCES = [
  'https://world.openfoodfacts.org',
  'https://world.openproductsfacts.org',
  'https://world.openbeautyfacts.org',
]

const FIELDS = 'product_name,product_name_es,generic_name_es,brands,quantity,image_front_small_url,image_front_url,image_small_url'

export async function lookupBarcode(barcode: string): Promise<BarcodeInfo | null> {
  for (const base of SOURCES) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 6000)
      const res = await fetch(`${base}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, {
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) continue
      const data = await res.json()
      if (data.status !== 1 || !data.product) continue
      const p = data.product
      const name: string = (p.product_name_es || p.product_name || p.generic_name_es || '').trim()
      if (!name) continue
      return {
        barcode,
        name,
        brand: (p.brands || '').split(',')[0].trim() || null,
        quantity: p.quantity || null,
        imageUrl: p.image_front_small_url || p.image_small_url || p.image_front_url || null,
      }
    } catch {
      // sin conexión o timeout: probamos la siguiente fuente
    }
  }
  return null
}
