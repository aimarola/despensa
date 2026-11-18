import { useState } from 'react'
import { errorText, supabase } from '../lib/supabase'
import { useAuth } from '../store'

export const INVITE_KEY = 'despensa.invite'

export default function Onboarding() {
  const { setHouseholdId, session } = useAuth()
  const pendingCode = localStorage.getItem(INVITE_KEY) ?? ''
  const [mode, setMode] = useState<'join' | 'create'>(pendingCode ? 'join' : 'create')
  const [name, setName] = useState('')
  const [family, setFamily] = useState('Casa')
  const [code, setCode] = useState(pendingCode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { data, error } =
        mode === 'create'
          ? await supabase.rpc('create_household', { p_name: family, p_display_name: name })
          : await supabase.rpc('join_household', { p_code: code, p_display_name: name })
      if (error) throw error
      localStorage.removeItem(INVITE_KEY)
      setHouseholdId(data as string)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-logo">🏠</div>
      <h1>¡Bienvenido!</h1>
      <p className="muted">Crea la familia o únete a la de otro con su código.</p>

      <div className="segmented">
        <button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Crear familia</button>
        <button className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>Tengo un código</button>
      </div>

      <form className="form" onSubmit={submit}>
        <label>Tu nombre (lo verá la familia)
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Mamá, Lucía…" />
        </label>
        {mode === 'create' ? (
          <label>Nombre de la familia
            <input required value={family} onChange={(e) => setFamily(e.target.value)} />
          </label>
        ) : (
          <label>Código de la familia
            <input
              required value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ej. A1B2C3" autoCapitalize="characters" className="code-input"
            />
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <button className="btn primary big" disabled={busy}>
          {busy ? 'Un momento…' : mode === 'create' ? 'Crear y empezar' : 'Unirme'}
        </button>
      </form>
      <button className="link" onClick={() => supabase.auth.signOut()}>
        Salir ({session?.user.email})
      </button>
    </div>
  )
}
