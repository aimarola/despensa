import { normalize } from './format'
import type { Supermarket } from './types'

/**
 * Cadenas españolas y sus marcas propias. Si un producto escaneado es de
 * "Hacendado", sabemos que es de Mercadona aunque Open Food Facts no lo diga.
 */
const CHAINS: { key: string; aliases: string[]; brands: string[]; eanPrefixes?: string[] }[] = [
  { key: 'mercadona', aliases: ['mercadona'], brands: ['hacendado', 'deliplus', 'bosque verde', 'compy', 'solcare', 'casa juncal', 'mercadona'], eanPrefixes: ['8480000'] },
  { key: 'eroski', aliases: ['eroski', 'caprabo', 'vegalsa'], brands: ['eroski', 'eroski basic', 'eroski seleqtia', 'eroski natur', 'belle', 'romester'], eanPrefixes: ['8480010'] },
  { key: 'carrefour', aliases: ['carrefour'], brands: ['carrefour', 'carrefour bio', 'carrefour classic', 'carrefour el mercado', 'carrefour extra', 'carrefour sensation', 'carrefour discount', 'simpl', 'carrefour baby', 'carrefour soft', 'carrefour veggie'] },
  { key: 'dia', aliases: ['dia', 'supermercados dia', 'la plaza'], brands: ['dia', 'bonte', 'delicious dia', 'basic dia', 'dia nature', 'babysmile', 'as'], eanPrefixes: ['8480017'] },
  { key: 'lidl', aliases: ['lidl'], brands: ['milbona', 'pikok', 'solevita', 'freeway', 'cien', 'w5', 'chef select', 'deluxe', 'alesto', 'crownfield', 'gelatelli', 'combino', 'vitasia', 'italiamo', 'baresa', 'snack day', 'formil', 'dulano', 'vemondo', 'favorina', 'bellarom', 'silvercrest', 'kania', 'perlenbacher', 'nixe', 'lupilu', 'dentalux', 'linda'] },
  { key: 'aldi', aliases: ['aldi'], brands: ['milsani', 'gutbio', 'river', 'tandil', 'ombra', 'cucina nobile', 'choceur', 'moser roth', 'lacura', 'mamia', 'confiserie'] },
  { key: 'alcampo', aliases: ['alcampo', 'auchan'], brands: ['auchan', 'alcampo', 'cosmia', 'mmm'] },
  { key: 'consum', aliases: ['consum', 'charter'], brands: ['consum', 'kyrei'] },
  { key: 'elcorteingles', aliases: ['el corte ingles', 'hipercor', 'supercor'], brands: ['el corte ingles', 'aliada'] },
  { key: 'ahorramas', aliases: ['ahorramas'], brands: ['alipende'] },
  { key: 'bonarea', aliases: ['bonarea', 'bon area'], brands: ['bonarea', 'bon area'] },
  { key: 'gadis', aliases: ['gadis'], brands: ['gadis'] },
  { key: 'bm', aliases: ['bm', 'bm supermercados'], brands: [] },
  { key: 'condis', aliases: ['condis'], brands: ['condis'] },
]

function chainOfText(text: string): string | null {
  // Palabras completas: "Dia" no debe coincidir con "Media Markt"
  const t = ` ${normalize(text).replace(/[^a-z0-9]+/g, ' ')} `
  if (!t.trim()) return null
  for (const c of CHAINS) {
    if (c.aliases.some((a) => t.includes(` ${a} `))) return c.key
  }
  return null
}

function chainOfBrand(brand: string): string | null {
  const b = normalize(brand)
  for (const c of CHAINS) if (c.brands.some((x) => b === x || b.startsWith(x + ' '))) return c.key
  return null
}

/** Cadena a la que pertenece cada supermercado de la familia ("Mercadona Gran Vía" → mercadona) */
export function chainOfSupermarket(s: Supermarket): string | null {
  return chainOfText(s.name)
}

export interface StoreHints {
  barcode?: string
  brands?: string | null
  stores?: string | null
  /** supermercados donde Open Prices tiene precio registrado */
  priceStores?: string[]
}

/**
 * Devuelve los supermercados de la familia donde se compra este producto.
 *  - Marca propia o prefijo de código → solo esa cadena.
 *  - Si no, las tiendas que indica Open Food Facts / Open Prices.
 *  - Si eso coincide con todos los supermercados, no se asigna ninguno (= en cualquiera).
 */
export function detectSupermarkets(hints: StoreHints, supermarkets: Supermarket[]): { ids: string[]; reason: string | null } {
  if (supermarkets.length === 0) return { ids: [], reason: null }
  const byChain = new Map<string, string[]>()
  for (const s of supermarkets) {
    const c = chainOfSupermarket(s)
    if (c) byChain.set(c, [...(byChain.get(c) ?? []), s.id])
  }

  // 1. Marca propia
  for (const brand of (hints.brands ?? '').split(',')) {
    const c = chainOfBrand(brand)
    if (c) {
      const ids = byChain.get(c)
      if (ids?.length) return { ids, reason: `marca ${brand.trim()}` }
    }
  }
  // 2. Prefijo del código de barras de la cadena
  if (hints.barcode) {
    for (const c of CHAINS) {
      if (c.eanPrefixes?.some((p) => hints.barcode!.startsWith(p)) && byChain.get(c.key)?.length) {
        return { ids: byChain.get(c.key)!, reason: 'código de marca propia' }
      }
    }
  }
  // 3. Tiendas donde se ha visto el producto
  const found = new Set<string>()
  for (const st of [...(hints.stores ?? '').split(','), ...(hints.priceStores ?? [])]) {
    const c = chainOfText(st)
    if (c) byChain.get(c)?.forEach((id) => found.add(id))
  }
  const knownChains = [...byChain.values()].flat().length
  if (found.size > 0 && found.size < knownChains) {
    return { ids: [...found], reason: 'tiendas donde se vende' }
  }
  return { ids: [], reason: null }
}

/** ¿El nombre de una tienda (p.ej. de Open Prices) corresponde a este supermercado? */
export function sameChain(storeName: string, s: Supermarket): boolean {
  const a = chainOfText(storeName)
  return Boolean(a && a === chainOfSupermarket(s))
}
