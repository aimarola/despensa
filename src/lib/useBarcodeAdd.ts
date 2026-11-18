import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useToast } from '../store'
import { addToList, findProductByBarcode } from './actions'
import { lookupBarcode } from './openfoodfacts'
import { errorText } from './supabase'

export interface NewProductState {
  prefill?: { name?: string; brand?: string | null; barcode?: string; image_url?: string | null }
  addToList?: boolean
  returnTo?: string
}

/**
 * Lógica común tras leer un código de barras:
 *  1. si el producto ya está en vuestro catálogo → `onKnown` (por defecto, apuntarlo en la lista)
 *  2. si no, se busca en Open Food Facts y se abre la ficha de producto nuevo ya rellena
 */
export function useBarcodeAdd(opts?: { returnTo?: string; onKnown?: (productId: string, name: string) => Promise<void> | void }) {
  const { household } = useAuth()
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
      const info = await lookupBarcode(code)
      if (!info) toast('Producto desconocido: ponle nombre y foto', 'ok')
      const state: NewProductState = {
        prefill: info
          ? { name: info.quantity ? `${info.name} ${info.quantity}` : info.name, brand: info.brand, barcode: code, image_url: info.imageUrl }
          : { barcode: code },
        addToList: true,
        returnTo: opts?.returnTo,
      }
      navigate('/productos/nuevo', { state })
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      setBusy(false)
    }
  }, [household, navigate, toast, opts])

  return { handle, busy }
}
