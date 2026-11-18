import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { INVITE_KEY } from './pages/Onboarding'

// Enlace de invitación: https://tu-web/?codigo=ABC123
const code = new URLSearchParams(window.location.search).get('codigo')
if (code) {
  localStorage.setItem(INVITE_KEY, code.toUpperCase())
  window.history.replaceState(null, '', window.location.pathname + window.location.hash)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
