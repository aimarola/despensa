import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from './lib/supabase'
import type { Household, ListItem, Member, Product, ProductPrice, ProductStats, Supermarket } from './lib/types'

// ---------------------------------------------------------------------------
// Avisos breves (toasts)
// ---------------------------------------------------------------------------
interface ToastAction { label: string; onClick: () => void }
interface Toast { id: number; text: string; kind: 'ok' | 'error'; action?: ToastAction }
type ShowToast = (text: string, kind?: 'ok' | 'error', action?: ToastAction) => void
const ToastCtx = createContext<ShowToast>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const show = useCallback<ShowToast>((text, kind = 'ok', action) => {
    const id = Date.now() + Math.random()
    // Solo un aviso a la vez: al marcar productos seguidos no se apilan
    setToasts([{ id, text, kind, action }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 4500 : action ? 4000 : 2200)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span>{t.text}</span>
            {t.action && (
              <button onClick={() => { t.action!.onClick(); setToasts((x) => x.filter((y) => y.id !== t.id)) }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ---------------------------------------------------------------------------
// Sesión y familia
// ---------------------------------------------------------------------------
interface AuthState {
  session: Session | null
  loading: boolean
  household: Household | null
  me: Member | null
  reloadHousehold: () => Promise<void>
  setHouseholdId: (id: string) => void
}
const AuthCtx = createContext<AuthState>(null as unknown as AuthState)
export const useAuth = () => useContext(AuthCtx)

const HH_KEY = 'despensa.household'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [household, setHousehold] = useState<Household | null>(null)
  const [me, setMe] = useState<Member | null>(null)
  const [hhLoading, setHhLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const reloadHousehold = useCallback(async () => {
    if (!userId) {
      setHousehold(null); setMe(null); setHhLoading(false)
      return
    }
    setHhLoading(true)
    const { data } = await supabase
      .from('members')
      .select('household_id, user_id, display_name, households(id, name, invite_code)')
      .eq('user_id', userId)
    const rows = (data ?? []) as unknown as (Member & { households: Household })[]
    const preferred = localStorage.getItem(HH_KEY)
    const row = rows.find((r) => r.household_id === preferred) ?? rows[0]
    setHousehold(row?.households ?? null)
    setMe(row ? { household_id: row.household_id, user_id: row.user_id, display_name: row.display_name } : null)
    setHhLoading(false)
  }, [userId])

  useEffect(() => { reloadHousehold() }, [reloadHousehold])

  const setHouseholdId = useCallback((id: string) => {
    localStorage.setItem(HH_KEY, id)
    reloadHousehold()
  }, [reloadHousehold])

  const value = useMemo(
    () => ({ session, loading: !sessionLoaded || (Boolean(userId) && hhLoading), household, me, reloadHousehold, setHouseholdId }),
    [session, sessionLoaded, userId, hhLoading, household, me, reloadHousehold, setHouseholdId],
  )
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

// ---------------------------------------------------------------------------
// Datos compartidos de la familia (con actualización en tiempo real)
// ---------------------------------------------------------------------------
interface DataState {
  ready: boolean
  products: Product[]
  productsById: Map<string, Product>
  supermarkets: Supermarket[]
  members: Member[]
  memberName: (userId: string | null) => string
  list: ListItem[]
  stats: Map<string, ProductStats>
  /** Precio conocido de un producto en un supermercado (o el más reciente en cualquiera) */
  priceOf: (productId: string, supermarketId: string | null) => PriceInfo | null
  pricesOf: (productId: string) => ProductPrice[]
  refresh: () => Promise<void>
}

export interface PriceInfo { price: number; exact: boolean; supermarketId: string | null; source: string }
const DataCtx = createContext<DataState>(null as unknown as DataState)
export const useData = () => useContext(DataCtx)

export function DataProvider({ household, children }: { household: Household; children: ReactNode }) {
  const hid = household.id
  const [ready, setReady] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [list, setList] = useState<ListItem[]>([])
  const [statsRows, setStatsRows] = useState<ProductStats[]>([])
  const [prices, setPrices] = useState<ProductPrice[]>([])

  const refresh = useCallback(async () => {
    const [p, s, m, l, st, pr] = await Promise.all([
      supabase.from('products').select('*, product_supermarkets(supermarket_id)').eq('household_id', hid).order('name'),
      supabase.from('supermarkets').select('*').eq('household_id', hid).order('name'),
      supabase.from('members').select('household_id, user_id, display_name').eq('household_id', hid),
      supabase.from('list_items').select('*').eq('household_id', hid).eq('status', 'pending').order('added_at', { ascending: false }),
      supabase.from('product_stats').select('*').eq('household_id', hid),
      supabase.from('product_prices').select('product_id, supermarket_id, price, source, updated_at, products!inner(household_id)').eq('products.household_id', hid),
    ])
    if (p.data) setProducts(p.data as Product[])
    if (s.data) setSupermarkets(s.data as Supermarket[])
    if (m.data) setMembers(m.data as Member[])
    if (l.data) setList(l.data as ListItem[])
    if (st.data) setStatsRows(st.data as ProductStats[])
    if (pr.data) setPrices(pr.data as unknown as ProductPrice[])
    setReady(true)
  }, [hid])

  // Agrupa ráfagas de cambios en una sola recarga
  const timer = useRef<number | undefined>(undefined)
  const scheduleRefresh = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(refresh, 300)
  }, [refresh])

  useEffect(() => {
    refresh()
    const filter = `household_id=eq.${hid}`
    const channel = supabase.channel(`household-${hid}`)
    for (const table of ['list_items', 'products', 'supermarkets', 'trips']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, scheduleRefresh)
    }
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'product_prices' }, scheduleRefresh)
    channel.subscribe()
    // En el móvil la conexión se corta en segundo plano: al volver, recargamos
    const onVisible = () => { if (document.visibilityState === 'visible') scheduleRefresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', scheduleRefresh)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', scheduleRefresh)
    }
  }, [hid, refresh, scheduleRefresh])

  const value = useMemo<DataState>(() => {
    const productsById = new Map(products.map((p) => [p.id, p]))
    const stats = new Map(statsRows.map((r) => [r.product_id, r]))
    const names = new Map(members.map((m) => [m.user_id, m.display_name]))
    const byProduct = new Map<string, ProductPrice[]>()
    for (const pp of prices) byProduct.set(pp.product_id, [...(byProduct.get(pp.product_id) ?? []), pp])
    const priceOf = (productId: string, supermarketId: string | null): PriceInfo | null => {
      const list = byProduct.get(productId) ?? []
      const exact = supermarketId ? list.find((x) => x.supermarket_id === supermarketId) : undefined
      if (exact) return { price: Number(exact.price), exact: true, supermarketId, source: exact.source }
      const latest = [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
      if (latest) return { price: Number(latest.price), exact: !supermarketId, supermarketId: latest.supermarket_id, source: latest.source }
      const ref = productsById.get(productId)?.ref_price
      return ref != null ? { price: Number(ref), exact: false, supermarketId: null, source: 'referencia' } : null
    }
    return {
      ready, products, productsById, supermarkets, members, list, stats, refresh,
      priceOf, pricesOf: (id) => byProduct.get(id) ?? [],
      memberName: (id) => (id ? names.get(id) ?? 'Alguien' : 'Alguien'),
    }
  }, [ready, products, supermarkets, members, list, statsRows, prices, refresh])

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>
}

/** ¿Se compra este producto en este supermercado? (sin supermercados = en cualquiera) */
export function soldAt(p: Product | undefined, supermarketId: string | null): boolean {
  if (!supermarketId || !p) return true
  const ids = p.product_supermarkets?.map((x) => x.supermarket_id) ?? []
  return ids.length === 0 || ids.includes(supermarketId)
}
