import { ClipboardList, Package, Receipt, Settings, ShoppingCart } from 'lucide-react'
import { HashRouter, Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { Spinner } from './components/ui'
import { isConfigured } from './lib/supabase'
import { HistoryPage, TripDetail } from './pages/HistoryPage'
import ListPage from './pages/ListPage'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import ProductDetail from './pages/ProductDetail'
import ProductForm from './pages/ProductForm'
import ProductsPage from './pages/ProductsPage'
import SettingsPage from './pages/SettingsPage'
import ShoppingMode from './pages/ShoppingMode'
import { AuthProvider, DataProvider, ToastProvider, useAuth, useData } from './store'

function TabBar() {
  const { list } = useData()
  return (
    <nav className="tabbar">
      <NavLink to="/" end><ClipboardList size={24} />Lista{list.length > 0 && <i className="dot-count">{list.length}</i>}</NavLink>
      <NavLink to="/productos"><Package size={24} />Productos</NavLink>
      <NavLink to="/comprar" className="tab-main"><span className="fab"><ShoppingCart size={26} /></span>Comprar</NavLink>
      <NavLink to="/historial"><Receipt size={24} />Historial</NavLink>
      <NavLink to="/ajustes"><Settings size={24} />Ajustes</NavLink>
    </nav>
  )
}

function Layout() {
  return (
    <div className="shell">
      <main><Outlet /></main>
      <TabBar />
    </div>
  )
}

function Gate() {
  const { session, loading, household } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Login />
  if (!household) return <Onboarding />
  return (
    <DataProvider household={household} key={household.id}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ListPage />} />
          <Route path="productos" element={<ProductsPage />} />
          <Route path="productos/nuevo" element={<ProductForm />} />
          <Route path="productos/:id" element={<ProductDetail />} />
          <Route path="productos/:id/editar" element={<ProductForm />} />
          <Route path="comprar" element={<ShoppingMode />} />
          <Route path="historial" element={<HistoryPage />} />
          <Route path="historial/:id" element={<TripDetail />} />
          <Route path="ajustes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}

function NotConfigured() {
  return (
    <div className="auth">
      <div className="auth-hero"><div className="mark"><Settings size={30} /></div></div>
      <h1>Falta configurar</h1>
      <p className="muted">
        Crea el archivo <code>.env</code> con <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>
        (o defínelas en tu hosting) y vuelve a publicar. Mira el README.
      </p>
    </div>
  )
}

export default function App() {
  if (!isConfigured) return <NotConfigured />
  return (
    <ToastProvider>
      <AuthProvider>
        <HashRouter>
          <Gate />
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
