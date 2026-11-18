/**
 * Identificación de productos por código de barras con las bases de datos
 * abiertas de Open Food Facts (alimentación), Open Products Facts (droguería,
 * limpieza…) y Open Beauty Facts (higiene). Precios: Open Prices.
 * Todo gratis y sin clave.
 */
import { categoryFromOff } from './categories'

export interface BarcodeInfo {
  barcode: string
  name: string
  brand: string | null
  brands: string | null
  stores: string | null
  imageUrl: string | null
  quantity: string | null
  category: string | null
}

const SOURCES: { base: string; kind: 'food' | 'products' | 'beauty' }[] = [
  { base: 'https://world.openfoodfacts.org', kind: 'food' },
  { base: 'https://world.openproductsfacts.org', kind: 'products' },
  { base: 'https://world.openbeautyfacts.org', kind: 'beauty' },
]

const FIELDS = 'product_name,product_name_es,generic_name_es,brands,stores,quantity,categories_tags,image_front_small_url,image_front_url,image_small_url'

async function getJson(url: string, ms = 6000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function lookupBarcode(barcode: string): Promise<BarcodeInfo | null> {
  for (const { base, kind } of SOURCES) {
    const data = await getJson(`${base}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`)
    if (!data || data.status !== 1 || !data.product) continue
    const p = data.product
    const name: string = (p.product_name_es || p.product_name || p.generic_name_es || '').trim()
    if (!name) continue
    return {
      barcode,
      name,
      brand: (p.brands || '').split(',')[0].trim() || null,
      brands: p.brands || null,
      stores: p.stores || null,
      quantity: p.quantity || null,
      imageUrl: p.image_front_small_url || p.image_small_url || p.image_front_url || null,
      category: categoryFromOff(p.categories_tags, kind),
    }
  }
  return null
}

export interface PriceSeen {
  price: number
  store: string
  date: string
  city: string | null
}

/** Precios recientes en euros registrados en Open Prices para este código */
export async function lookupPrices(barcode: string): Promise<PriceSeen[]> {
  const data = await getJson(
    `https://prices.openfoodfacts.org/api/v1/prices?product_code=${encodeURIComponent(barcode)}&currency=EUR&order_by=-date&size=30`,
    5000,
  )
  const items = (data?.items ?? []) as {
    price: number; date: string; price_is_discounted?: boolean
    location?: { osm_name?: string; osm_brand?: string; osm_address_city?: string; osm_address_country?: string }
  }[]
  return items
    .filter((i) => typeof i.price === 'number' && i.price > 0 && !i.price_is_discounted)
    .map((i) => ({
      price: i.price,
      store: i.location?.osm_brand || i.location?.osm_name || '',
      date: i.date,
      city: i.location?.osm_address_city ?? null,
    }))
}
