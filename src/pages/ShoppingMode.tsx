import { Check, ChevronDown, ChevronRight, PartyPopper, ShoppingBasket, Store } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BarcodeScanner from '../components/BarcodeScanner'
import QuickAdd from '../components/QuickAdd'
import { Avatar, GroupHead, PriceTag, ProductImage, Sheet, Spinner, Stepper } from '../components/ui'
import { CATEGORY_ORDER } from '../lib/categories'
import { euro, firstName, parsePrice } from '../lib/format'
import { errorText, supabase } from '../lib/supabase'
import type { ListItem, Product } from '../lib/types'
import { useBarcodeAdd, type NewProductState } from '../lib/useBarcodeAdd'
import { soldAt, useAuth, useData, useToast } from '../store'

interface Line { qty: number; price: number | null }
interface ShopState {
  /** undefined = aún no se ha elegido supermercado */
  supermarketId?: string | null
  /** list_item_id → lo cogido */
  checked: Record<string, Line>
  /** product_id → cogido sin estar en la lista */
  extras: Record<string, Line>
}
const EMPTY: ShopState = { checked: {}, extras: {} }

/** El progreso se guarda en el móvil: si se cierra la web en el súper, no se pierde nada */
function useShopState(householdId: string) {
  const key = `despensa.shopping.v2.${householdId}`
  const [state, setState] = useState<ShopState>(() => {
    try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(key) ?? '{}') } } catch { return EMPTY }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)) } catch { /* sin espacio */ } }, [key, state])
  return [state, setState] as const
}

interface Editing { kind: 'list' | 'extra'; id: string; product: Product | undefined; qty: number; price: string; inCart: boolean }

export default function ShoppingMode() {
  const { household, me } = useAuth()
  const { ready, list, productsById, supermarkets, members, refresh, priceOf } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [state, setState] = useShopState(household!.id)
  const [leaving, setLeaving] = useState<Set<string>>(new Set())
  const [showOthers, setShowOthers] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [shoppers, setShoppers] = useState<string[]>([])
  const [ticket, setTicket] = useState('')
  const [saving, setSaving] = useState(false)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const smId = state.supermarketId ?? null
  const sm = supermarkets.find((s) => s.id === smId)
  const chooseStore = state.supermarketId === undefined && supermarkets.length > 0
  const pendingByProduct = useMemo(() => new Map(list.map((l) => [l.product_id, l])), [list])

  // ---------- Precios ----------
  const unitPrice = useCallback((productId: string, line?: Line) => {
    if (line?.price != null) return { price: line.price, exact: true }
    const p = priceOf(productId, smId)
    return p ? { price: p.price, exact: p.exact } : null
  }, [priceOf, smId])

  // ---------- Acciones ----------
  const markProduct = useCallback((productId: string): ListItem | undefined => {
    const li = pendingByProduct.get(productId)
    setState((s) => li
      ? { ...s, checked: { ...s.checked, [li.id]: s.checked[li.id] ?? { qty: li.quantity, price: null } } }
      : { ...s, extras: { ...s.extras, [productId]: { qty: (s.extras[productId]?.qty ?? 0) + 1, price: s.extras[productId]?.price ?? null } } })
    return li
  }, [pendingByProduct, setState])

  const uncheck = useCallback((liId: string) => {
    setState((s) => { const c = { ...s.checked }; delete c[liId]; return { ...s, checked: c } })
  }, [setState])

  function take(li: ListItem) {
    if (leaving.has(li.id)) return
    navigator.vibrate?.(15)
    setLeaving((x) => new Set(x).add(li.id))
    const t = window.setTimeout(() => {
      setState((s) => ({ ...s, checked: { ...s.checked, [li.id]: s.checked[li.id] ?? { qty: li.quantity, price: null } } }))
      setLeaving((x) => { const n = new Set(x); n.delete(li.id); return n })
    }, 240)
    timers.current.push(t)
    const name = productsById.get(li.product_id)?.name ?? 'Producto'
    toast(`En el carro: ${name}`, 'ok', { label: 'Deshacer', onClick: () => { clearTimeout(t); setLeaving((x) => { const n = new Set(x); n.delete(li.id); return n }); uncheck(li.id) } })
  }

  const { handle, busy } = useBarcodeAdd({
    returnTo: '/comprar',
    onKnown: (pid, name) => {
      const li = markProduct(pid)
      toast(li ? `En el carro: ${name}` : `Añadido al carro: ${name}`)
    },
  })

  // Al volver de crear un producto nuevo desde aquí, va directo al carro
  const checkProduct = (location.state as { checkProduct?: string } | null)?.checkProduct
  useEffect(() => {
    if (!checkProduct || !pendingByProduct.has(checkProduct)) return
    markProduct(checkProduct)
    navigate('/comprar', { replace: true, state: null })
  }, [checkProduct, pendingByProduct, markProduct, navigate])

  // ---------- Datos derivados ----------
  const checkedValid = Object.entries(state.checked).filter(([id]) => list.some((l) => l.id === id))
  const extras = Object.entries(state.extras).filter(([pid]) => productsById.has(pid))
  const inCartCount = checkedValid.length + extras.length

  const pending = list.filter((li) => !(li.id in state.checked) || leaving.has(li.id))
  const here = pending.filter((li) => soldAt(productsById.get(li.product_id), smId))
  const others = pending.filter((li) => !here.includes(li))
  const relevantTotal = list.filter((li) => soldAt(productsById.get(li.product_id), smId)).length
  const hereDone = relevantTotal - here.filter((li) => !leaving.has(li.id)).length

  const groups = useMemo(() => {
    const g = new Map<string, ListItem[]>()
    for (const li of here) {
      const c = productsById.get(li.product_id)?.category || 'otros'
      g.set(c, [...(g.get(c) ?? []), li])
    }
    for (const items of g.values()) items.sort((a, b) => (productsById.get(a.product_id)?.name ?? '').localeCompare(productsById.get(b.product_id)?.name ?? ''))
    return [...g.entries()].sort((a, b) => (CATEGORY_ORDER.get(a[0]) ?? 99) - (CATEGORY_ORDER.get(b[0]) ?? 99))
  }, [here, productsById])

  let cartTotal = 0
  let cartPriced = 0
  for (const [id, line] of checkedValid) {
    const li = list.find((l) => l.id === id)!
    const u = unitPrice(li.product_id, line)
    if (u) { cartTotal += u.price * line.qty; cartPriced++ }
  }
  for (const [pid, line] of extras) {
    const u = unitPrice(pid, line)
    if (u) { cartTotal += u.price * line.qty; cartPriced++ }
  }

  // ---------- Editar cantidad / precio ----------
  function openEdit(kind: 'list' | 'extra', id: string) {
    const productId = kind === 'list' ? list.find((l) => l.id === id)!.product_id : id
    const line = kind === 'list' ? state.checked[id] : state.extras[id]
    const li = kind === 'list' ? list.find((l) => l.id === id) : undefined
    const u = unitPrice(productId, line)
    setEditing({
      kind, id, product: productsById.get(productId),
      qty: line?.qty ?? li?.quantity ?? 1,
      price: u ? String(u.price).replace('.', ',') : '',
      inCart: Boolean(line),
    })
  }
  function saveEdit(putInCart: boolean) {
    if (!editing) return
    const line: Line = { qty: editing.qty, price: parsePrice(editing.price) }
    setState((s) => editing.kind === 'list'
      ? (putInCart || editing.inCart ? { ...s, checked: { ...s.checked, [editing.id]: line } } : s)
      : { ...s, extras: { ...s.extras, [editing.id]: line } })
    if (putInCart && !editing.inCart) toast(`En el carro: ${editing.product?.name ?? ''}`)
    setEditing(null)
  }

  // ---------- Finalizar ----------
  function openFinish() {
    setShoppers(me ? [me.user_id] : [])
    setTicket(cartPriced > 0 ? cartTotal.toFixed(2).replace('.', ',') : '')
    setFinishing(true)
  }

  async function finish() {
    setSaving(true)
    try {
      const sendPrice = (productId: string, line: Line) => {
        if (line.price != null) return line.price
        const p = priceOf(productId, smId)
        return p?.exact && smId ? p.price : null // solo precios de este súper
      }
      const { data, error } = await supabase.rpc('complete_shopping', {
        p_household: household!.id,
        p_supermarket: smId,
        p_bought: checkedValid.map(([id, line]) => {
          const li = list.find((l) => l.id === id)!
          return { list_item_id: id, quantity: line.qty, unit_price: sendPrice(li.product_id, line) }
        }),
        p_extra: extras.map(([product_id, line]) => ({ product_id, quantity: line.qty, unit_price: sendPrice(product_id, line) })),
        p_total: parsePrice(ticket),
        p_shoppers: shoppers,
      })
      if (error) throw error
      setState({ ...EMPTY })
      await refresh()
      toast('Compra registrada')
      navigate(`/historial/${data}`, { replace: true })
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      setSaving(false)
      setFinishing(false)
    }
  }

  if (!ready) return <Spinner />

  // ---------- Paso 1: ¿dónde compras? ----------
  if (chooseStore) {
    return (
      <div className="page">
        <header className="page-header">
          <div><h1>¿Dónde compras?</h1><p className="sub">Te enseño solo lo que toca comprar allí.</p></div>
        </header>
        <div className="store-picker">
          {supermarkets.map((s) => {
            const items = list.filter((li) => soldAt(productsById.get(li.product_id), s.id))
            let est = 0
            for (const li of items) { const p = priceOf(li.product_id, s.id); if (p) est += p.price * li.quantity }
            return (
              <button key={s.id} className="store-card" style={{ '--c': s.color } as React.CSSProperties} onClick={() => setState((x) => ({ ...x, supermarketId: s.id }))}>
                <Store size={26} color={s.color} />
                <div className="grow">
                  <div className="name">{s.name}</div>
                  <div className="muted small">{est > 0 ? `≈ ${euro(est)}` : 'Sin precios todavía'}</div>
                </div>
                <div className="big">{items.length}</div>
                <ChevronRight className="muted" />
              </button>
            )
          })}
          <button className="btn ghost" onClick={() => setState((x) => ({ ...x, supermarketId: null }))}>Otro sitio (toda la lista)</button>
        </div>
      </div>
    )
  }

  // ---------- Paso 2: comprando ----------
  const leftHere = here.filter((li) => !leaving.has(li.id)).length
  const ShopRow = ({ li }: { li: ListItem }) => {
    const p = productsById.get(li.product_id)
    const u = unitPrice(li.product_id, state.checked[li.id])
    return (
      <li className={`item shop-item ${leaving.has(li.id) ? 'leaving' : ''}`} onClick={() => take(li)}>
        <span className="check-btn" aria-hidden><Check size={24} strokeWidth={3} /></span>
        <ProductImage product={p} size={56} />
        <div className="item-text">
          <strong>{p?.name}</strong>
          {p?.brand && <span className="brand">{p.brand}</span>}
          {li.note && <span className="note">“{li.note}”</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {li.quantity > 1 && <span className="qty-big">×{li.quantity}</span>}
          <PriceTag value={u ? u.price * li.quantity : null} approx={u ? !u.exact : false} onClick={() => openEdit('list', li.id)} />
        </div>
      </li>
    )
  }

  return (
    <div className="page shop-page">
      <header className="shop-head">
        <div className="shop-top">
          <div className="where">
            <small>Comprando en</small>
            {supermarkets.length > 0 ? (
              <button onClick={() => setState((s) => ({ ...s, supermarketId: undefined }))}>
                {sm?.name ?? 'Cualquier sitio'} <ChevronDown size={20} />
              </button>
            ) : <button disabled>Supermercado</button>}
          </div>
          <div className="left">{leftHere}<small>{leftHere === 1 ? 'queda' : 'quedan'}</small></div>
        </div>
        <div className="shop-progress"><div style={{ width: `${relevantTotal ? (hereDone / relevantTotal) * 100 : 100}%` }} /></div>
      </header>

      {leftHere === 0 && (
        <div className="empty">
          <div className="empty-icon"><PartyPopper size={34} color="var(--green)" /></div>
          <h3>{relevantTotal ? '¡Ya está todo!' : 'Nada pendiente aquí'}</h3>
          <p>{inCartCount ? 'Pulsa «Finalizar» para guardar la compra.' : 'Añade abajo lo que vayas cogiendo.'}</p>
        </div>
      )}

      {groups.map(([cat, items]) => (
        <section className="group" key={cat}>
          <GroupHead categoryId={cat} count={items.filter((i) => !leaving.has(i.id)).length} />
          <ul className="items">{items.map((li) => <ShopRow key={li.id} li={li} />)}</ul>
        </section>
      ))}

      {others.length > 0 && (
        <>
          <button className="link" onClick={() => setShowOthers(!showOthers)}>
            {showOthers ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            {others.length} de la lista se suelen comprar en otro sitio
          </button>
          {showOthers && <ul className="items" style={{ opacity: .8 }}>{others.map((li) => <ShopRow key={li.id} li={li} />)}</ul>}
        </>
      )}

      <h3 className="section-title">¿Algo que no estaba en la lista?</h3>
      <QuickAdd
        placeholder="Buscar o escanear…"
        onPick={(p) => { const li = markProduct(p.id); toast(li ? `En el carro: ${p.name}` : `Añadido al carro: ${p.name}`) }}
        onCreate={(name) => navigate('/productos/nuevo', { state: { prefill: { name, supermarkets: smId ? [smId] : [] }, addToList: true, returnTo: '/comprar' } satisfies NewProductState })}
        onScan={() => setScanning(true)}
      />

      {inCartCount > 0 && (
        <section className="cart">
          <button onClick={() => setCartOpen(!cartOpen)}>
            <ShoppingBasket size={20} />
            <span className="grow" style={{ textAlign: 'left' }}>En el carro ({inCartCount})</span>
            {cartOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          {cartOpen && (
            <ul className="items">
              {checkedValid.map(([id, line]) => {
                const li = list.find((l) => l.id === id)!
                const p = productsById.get(li.product_id)
                const u = unitPrice(li.product_id, line)
                return (
                  <li key={id} className="item" onClick={() => openEdit('list', id)}>
                    <button className="check-btn on" aria-label={`Devolver ${p?.name} a la lista`} onClick={(e) => { e.stopPropagation(); uncheck(id) }}><Check size={22} strokeWidth={3} /></button>
                    <ProductImage product={p} size={40} />
                    <div className="item-text"><strong>{p?.name}</strong>{line.qty > 1 && <span className="brand">×{line.qty}</span>}</div>
                    <PriceTag value={u ? u.price * line.qty : null} approx={u ? !u.exact : false} onClick={() => openEdit('list', id)} />
                  </li>
                )
              })}
              {extras.map(([pid, line]) => {
                const p = productsById.get(pid)
                const u = unitPrice(pid, line)
                return (
                  <li key={pid} className="item" onClick={() => openEdit('extra', pid)}>
                    <button className="check-btn on" aria-label={`Quitar ${p?.name} del carro`} onClick={(e) => { e.stopPropagation(); setState((s) => { const x = { ...s.extras }; delete x[pid]; return { ...s, extras: x } }) }}><Check size={22} strokeWidth={3} /></button>
                    <ProductImage product={p} size={40} />
                    <div className="item-text"><strong>{p?.name}</strong><span className="brand">{line.qty > 1 ? `×${line.qty} · ` : ''}no estaba en la lista</span></div>
                    <PriceTag value={u ? u.price * line.qty : null} approx={u ? !u.exact : false} onClick={() => openEdit('extra', pid)} />
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {/* Barra fija: siempre se puede finalizar */}
      <div className="finish-bar">
        <div>
          <div className="sum">
            <small>{inCartCount === 0 ? 'Carro vacío' : `${inCartCount} en el carro`}</small>
            {cartPriced > 0 ? <PriceTag value={cartTotal} approx={cartPriced < inCartCount} /> : <span style={{ fontWeight: 700 }}>Toca un producto al cogerlo</span>}
          </div>
          <button className="btn" disabled={inCartCount === 0} onClick={openFinish}>Finalizar compra</button>
        </div>
      </div>

      {/* Editar cantidad y precio */}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing?.product?.name}>
        {editing && (
          <>
            <div className="row">
              <span className="grow">Cantidad</span>
              <Stepper value={editing.qty} onChange={(n) => setEditing({ ...editing, qty: n })} />
            </div>
            <label>Precio por unidad{sm ? ` en ${sm.name}` : ''}
              <input inputMode="decimal" className="amount-input" placeholder="0,00" value={editing.price}
                onChange={(e) => setEditing({ ...editing, price: e.target.value })} autoFocus />
            </label>
            {parsePrice(editing.price) != null && editing.qty > 1 && (
              <p className="muted" style={{ margin: 0, textAlign: 'right' }}>Total: {euro(parsePrice(editing.price)! * editing.qty)}</p>
            )}
            {editing.kind === 'list' && !editing.inCart
              ? <button className="btn primary big" onClick={() => saveEdit(true)}><Check size={20} /> Lo he cogido</button>
              : <button className="btn primary big" onClick={() => saveEdit(false)}>Guardar</button>}
          </>
        )}
      </Sheet>

      {/* Finalizar */}
      <Sheet open={finishing} onClose={() => setFinishing(false)} title="Finalizar compra">
        <div className="field-group" style={{ boxShadow: 'none', padding: 0 }}>
          <div className="legend">¿Quién ha ido a comprar?</div>
          <div className="member-pick">
            {members.map((m) => {
              const on = shoppers.includes(m.user_id)
              return (
                <button key={m.user_id} type="button" className={`member-chip ${on ? 'on' : ''}`}
                  onClick={() => setShoppers(on ? shoppers.filter((x) => x !== m.user_id) : [...shoppers, m.user_id])}>
                  <Avatar name={m.display_name} />{firstName(m.display_name)}
                </button>
              )
            })}
          </div>
        </div>
        <label>Total del ticket
          <input inputMode="decimal" className="amount-input" placeholder="0,00 €" value={ticket} onChange={(e) => setTicket(e.target.value)} />
          <span className="hint">{cartPriced > 0 ? `Calculado con los precios que conocemos: ${euro(cartTotal)}. Corrígelo con lo que pone el ticket.` : 'Opcional. Escribe lo que has pagado.'}</span>
        </label>
        <ul className="plain">
          <li><ShoppingBasket size={18} color="var(--green)" /> <span><b>{inCartCount}</b> comprados: salen de la lista y quedan en el historial</span></li>
          {list.length - checkedValid.length > 0 && <li><ChevronRight size={18} color="var(--muted)" /> <span><b>{list.length - checkedValid.length}</b> sin comprar: siguen en la lista</span></li>}
        </ul>
        <button className="btn primary big" disabled={saving || shoppers.length === 0} onClick={finish}>{saving ? 'Guardando…' : 'Guardar compra'}</button>
        <button className="btn ghost big" onClick={() => setFinishing(false)}>Seguir comprando</button>
      </Sheet>

      {busy && <div className="overlay-busy"><div className="spinner" /><p>Buscando el producto…</p></div>}
      {scanning && (
        <BarcodeScanner title="Escanea lo que coges" onClose={() => setScanning(false)} onDetected={(code) => { setScanning(false); handle(code) }} />
      )}
    </div>
  )
}
