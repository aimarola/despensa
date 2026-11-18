import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BarcodeScanner from '../components/BarcodeScanner'
import QuickAdd from '../components/QuickAdd'
import { Empty, ProductImage, Sheet, Spinner, Stepper, SupermarketChips } from '../components/ui'
import { errorText, supabase } from '../lib/supabase'
import type { ListItem, Product } from '../lib/types'
import type { NewProductState } from '../lib/useBarcodeAdd'
import { useBarcodeAdd } from '../lib/useBarcodeAdd'
import { soldAt, useAuth, useData, useToast } from '../store'

interface ShopState {
  supermarketId: string | null
  /** list_item_id → cantidad comprada */
  checked: Record<string, number>
  /** product_id → cantidad (comprado sin estar en la lista) */
  extras: Record<string, number>
}
const EMPTY: ShopState = { supermarketId: null, checked: {}, extras: {} }

/** El progreso se guarda en el móvil: si se cierra la web en el súper, no se pierde nada */
function useShopState(householdId: string) {
  const key = `despensa.shopping.${householdId}`
  const [state, setState] = useState<ShopState>(() => {
    try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(key) ?? '{}') } } catch { return EMPTY }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(state)) }, [key, state])
  const reset = useCallback(() => {
    setState((s) => ({ ...EMPTY, supermarketId: s.supermarketId }))
  }, [])
  return [state, setState, reset] as const
}

export default function ShoppingMode() {
  const { household } = useAuth()
  const { ready, list, productsById, supermarkets, refresh } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [state, setState, reset] = useShopState(household!.id)
  const [showOthers, setShowOthers] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)

  const pendingByProduct = useMemo(() => new Map(list.map((l) => [l.product_id, l])), [list])

  const markProduct = useCallback((productId: string) => {
    const li = pendingByProduct.get(productId)
    setState((s) => li
      ? { ...s, checked: { ...s.checked, [li.id]: s.checked[li.id] ?? li.quantity } }
      : { ...s, extras: { ...s.extras, [productId]: (s.extras[productId] ?? 0) + 1 } })
    return li
  }, [pendingByProduct, setState])

  const { handle, busy } = useBarcodeAdd({
    returnTo: '/comprar',
    onKnown: (pid, name) => {
      const li = markProduct(pid)
      toast(li ? `✓ ${name}` : `Añadido a la compra: ${name}`)
    },
  })

  // Al volver de crear un producto nuevo desde aquí, lo damos por cogido
  const checkProduct = (location.state as { checkProduct?: string } | null)?.checkProduct
  useEffect(() => {
    if (!checkProduct || !pendingByProduct.has(checkProduct)) return
    markProduct(checkProduct)
    navigate('/comprar', { replace: true, state: null })
  }, [checkProduct, pendingByProduct, markProduct, navigate])

  // Limpia marcas de artículos que otro miembro ya quitó de la lista
  const validChecked = Object.entries(state.checked).filter(([id]) => list.some((l) => l.id === id))
  const extras = Object.entries(state.extras).filter(([pid]) => productsById.has(pid))
  const total = validChecked.length + extras.length

  const here = list.filter((li) => soldAt(productsById.get(li.product_id), state.supermarketId))
  const others = list.filter((li) => !here.includes(li))
  const order = (a: ListItem, b: ListItem) =>
    Number(a.id in state.checked) - Number(b.id in state.checked) ||
    (productsById.get(a.product_id)?.name ?? '').localeCompare(productsById.get(b.product_id)?.name ?? '')

  function toggle(li: ListItem) {
    setState((s) => {
      const checked = { ...s.checked }
      if (li.id in checked) delete checked[li.id]
      else { checked[li.id] = li.quantity; navigator.vibrate?.(20) }
      return { ...s, checked }
    })
  }

  function pickExtra(p: Product) {
    const li = markProduct(p.id)
    toast(li ? `✓ ${p.name}` : `Añadido a la compra: ${p.name}`)
  }

  async function finish() {
    setSaving(true)
    try {
      const { data, error } = await supabase.rpc('complete_shopping', {
        p_household: household!.id,
        p_supermarket: state.supermarketId,
        p_bought: validChecked.map(([id, quantity]) => ({ list_item_id: id, quantity })),
        p_extra: extras.map(([product_id, quantity]) => ({ product_id, quantity })),
      })
      if (error) throw error
      reset()
      await refresh()
      toast('¡Compra registrada! 🎉')
      navigate(`/historial/${data}`, { replace: true })
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      setSaving(false)
      setConfirming(false)
    }
  }

  if (!ready) return <Spinner />

  const Row = ({ li }: { li: ListItem }) => {
    const p = productsById.get(li.product_id)
    const on = li.id in state.checked
    return (
      <li className={`item shop ${on ? 'done' : ''}`} onClick={() => toggle(li)}>
        <span className={`checkbox ${on ? 'on' : ''}`}>{on ? '✓' : ''}</span>
        <ProductImage product={p} />
        <div className="item-text">
          <strong>{p?.name}</strong>
          {p?.brand && <small className="muted"> {p.brand}</small>}
          {li.note && <div className="note">“{li.note}”</div>}
          {!on && <div className="meta">Necesitáis {li.quantity}</div>}
        </div>
        {on && (
          <Stepper
            value={state.checked[li.id]}
            onChange={(n) => setState((s) => ({ ...s, checked: { ...s.checked, [li.id]: n } }))}
          />
        )}
      </li>
    )
  }

  const notBought = list.length - validChecked.length

  return (
    <div className="page shopping">
      <header className="page-header">
        <div>
          <h1>Haciendo la compra</h1>
          <p className="muted">{validChecked.length} de {list.length} de la lista{extras.length ? ` · +${extras.length} extra` : ''}</p>
        </div>
      </header>

      {supermarkets.length > 0 && (
        <>
          <p className="muted small">¿Dónde estás comprando?</p>
          <SupermarketChips
            supermarkets={supermarkets}
            value={state.supermarketId}
            allLabel="Sin especificar"
            onChange={(id) => setState((s) => ({ ...s, supermarketId: id }))}
          />
        </>
      )}

      <div className="progress"><div style={{ width: `${list.length ? (validChecked.length / list.length) * 100 : 0}%` }} /></div>

      {list.length === 0 && extras.length === 0 ? (
        <Empty icon="🧺" title="La lista está vacía">Puedes añadir abajo lo que vayas cogiendo igualmente.</Empty>
      ) : (
        <ul className="items">
          {[...here].sort(order).map((li) => <Row key={li.id} li={li} />)}
        </ul>
      )}

      {others.length > 0 && (
        <>
          <button className="link" onClick={() => setShowOthers(!showOthers)}>
            {showOthers ? '▾' : '▸'} {others.length} de la lista no se suelen comprar aquí
          </button>
          {showOthers && <ul className="items faded">{[...others].sort(order).map((li) => <Row key={li.id} li={li} />)}</ul>}
        </>
      )}

      {extras.length > 0 && (
        <>
          <h3 className="section-title">También he cogido</h3>
          <ul className="items">
            {extras.map(([pid, qty]) => {
              const p = productsById.get(pid)
              return (
                <li key={pid} className="item shop done">
                  <span className="checkbox on">✓</span>
                  <ProductImage product={p} />
                  <div className="item-text"><strong>{p?.name}</strong></div>
                  <Stepper value={qty} onChange={(n) => setState((s) => ({ ...s, extras: { ...s.extras, [pid]: n } }))} />
                  <button className="icon-btn" aria-label="Quitar" onClick={() => setState((s) => {
                    const e = { ...s.extras }; delete e[pid]; return { ...s, extras: e }
                  })}>✕</button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <h3 className="section-title">¿Algo que no estaba en la lista?</h3>
      <QuickAdd
        placeholder="Buscar o escanear lo que coges…"
        onPick={pickExtra}
        onCreate={(name) => navigate('/productos/nuevo', { state: { prefill: { name }, addToList: true, returnTo: '/comprar' } satisfies NewProductState })}
        onScan={() => setScanning(true)}
      />

      <div className="bottom-cta">
        <button className="btn primary big" disabled={total === 0} onClick={() => setConfirming(true)}>
          ✔ He hecho la compra ({total})
        </button>
      </div>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title="¿Terminar la compra?">
        <ul className="summary">
          <li>🛒 <b>{total}</b> productos comprados — se quitan de la lista y quedan en el historial</li>
          {notBought > 0 && <li>⏳ <b>{notBought}</b> sin comprar — se quedan en la lista para la próxima</li>}
          {state.supermarketId && <li>📍 {supermarkets.find((s) => s.id === state.supermarketId)?.name}</li>}
        </ul>
        <button className="btn primary big" disabled={saving} onClick={finish}>{saving ? 'Guardando…' : 'Confirmar'}</button>
        <button className="btn ghost big" onClick={() => setConfirming(false)}>Seguir comprando</button>
      </Sheet>

      {busy && <div className="overlay-busy"><div className="spinner" /><p>Buscando el producto…</p></div>}
      {scanning && (
        <BarcodeScanner
          title="Escanea lo que coges"
          onClose={() => setScanning(false)}
          onDetected={(code) => { setScanning(false); handle(code) }}
        />
      )}
    </div>
  )
}
