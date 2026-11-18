import { ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { errorText, supabase } from '../lib/supabase'

type Mode = 'login' | 'signup' | 'link'

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const redirect = window.location.origin + window.location.pathname
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect } })
        if (error) throw error
        if (!data.session) setMsg({ ok: true, text: 'Te hemos enviado un email para confirmar la cuenta. Ábrelo desde este móvil.' })
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } })
        if (error) throw error
        setMsg({ ok: true, text: 'Revisa tu email y pulsa el enlace para entrar.' })
      }
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <div className="mark"><ShoppingCart size={32} /></div>
        <h1>Despensa</h1>
        <p className="muted" style={{ margin: 0 }}>La lista de la compra de toda la familia</p>
      </div>

      <div className="segmented">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Entrar</button>
        <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Crear cuenta</button>
      </div>

      <form className="form" onSubmit={submit}>
        <label>Email
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== 'link' && (
          <label>Contraseña
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {msg && <p className={msg.ok ? 'notice' : 'error'}>{msg.text}</p>}
        <button className="btn primary big" disabled={busy}>
          {busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Crear cuenta' : 'Enviarme el enlace'}
        </button>
      </form>
      <button className="link" onClick={() => setMode(mode === 'link' ? 'login' : 'link')}>
        {mode === 'link' ? 'Entrar con contraseña' : '¿Olvidaste la contraseña? Entra con un enlace por email'}
      </button>
    </div>
  )
}
