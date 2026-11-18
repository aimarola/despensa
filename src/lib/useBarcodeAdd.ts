import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useData, useToast } from '../store'
import { addToList, findProductByBarcode } from './actions'
import { guessCategoryFromName } from './categories'
import { detectSupermarkets, sameChain } from './chains'
import { lookupBarcode, lookupPrices } from './openfoodfacts'
import { errorText } from './supabase'
import type { Supermarket } from './types'

export interface Prefill {
  name?: string
  brand?: string | null
  barcode?: string
  image_url?: string | null
  category?: string | null
  supermarkets?: string[]
  /** por qué se han elegido esos supermercados (se muestra al usuario) */
  supermarketReason?: string | null
  /** supermarket_id → precio encontrado en Open Prices */
  prices?: Record<string, number>
  refPrice?: number | null
}

export interface NewProductState {
  prefill?: Prefill
  addToList?: boolean
  returnTo?: string
}

/** Busca todo lo que se sabe de un código: datos, supermercados, categoría y precios */
export async function enrichBarcode(code: string, supermarkets: Supermarket[]): Promise<Prefill & { found: boolean }> {
  const [info, prices] = await Promise.all([lookupBarcode(code), lookupPrices(code)])
  const detected = detectSupermarkets(
    { barcode: code, brands: info?.brands, stores: info?.stores, priceStores: prices.map((p) => p.store) },
    supermarkets,
  )
  // Precio más reciente en cada supermercado de la familia (de la misma cadena)
  const bySm: Record<string, number> = {}
  for (const s of supermarkets) {
    const p = prices.find((x) => sameChain(x.store, s))
    if (p) bySm[s.id] = p.price
  }
  const name = info ? (info.quantity && !info.name.includes(info.quantity) ? `${info.name} ${info.quantity}` : info.name) : undefined
  return {
    found: Boolean(info),
    barcode: code,
    name,
    brand: info?.brand ?? null,
    image_url: info?.imageUrl ?? null,
    category: info?.category ?? (name ? guessCategoryFromName(name) : null),
    supermarkets: detected.ids,
    supermarketReason: detected.reason,
    prices: bySm,
    refPrice: prices[0]?.price ?? null,
  }
}

/**
 * Lógica común tras leer un código de barras:
 *  1. si el producto ya está en vuestro catálogo → `onKnown` (por defecto, apuntarlo en la lista)
 *  2. si no, se busca en Open Food Facts / Open Prices y se abre la ficha ya rellena
 */
export function useBarcodeAdd(opts?: { returnTo?: string; onKnown?: (productId: string, name: string) => Promise<void> | void }) {
  const { household } = useAuth()
  const { supermarkets } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const handle = useCallback(async (code: string) => {
    if (!household) return
    setBusy(true)
    try {
      const known = await findProductByBarcode(household.id, code)
      if (known) {
        if (opts?.onKnown) await opts.onKnown(known.id, known.name)
        else {
          await addToList(known.id)
          toast(`Apuntado: ${known.name}`)
        }
        return
      }
      const { found, ...prefill } = await enrichBarcode(code, supermarkets)
      if (!found) toast('No lo conocemos: ponle nombre y foto')
      navigate('/productos/nuevo', { state: { prefill, addToList: true, returnTo: opts?.returnTo } satisfies NewProductState })
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      setBusy(false)
    }
  }, [household, supermarkets, navigate, toast, opts])

  return { handle, busy }
}
