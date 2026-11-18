import { ChevronRight, LogOut, Plus, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Sheet } from '../components/ui'
import { errorText, supabase } from '../lib/supabase'
import type { Supermarket } from '../lib/types'
import { useAuth, useData, useToast } from '../store'

const COLORS = ['#2f9e44', '#e8590c', '#1971c2', '#c2255c', '#f08c00', '#9c36b5', '#0c8599', '#495057']

export default function SettingsPage() {
  const { household, me, session, reloadHousehold } = useAuth()
  const { supermarkets, members, refresh } = useData()
  const toast = useToast()
  const [editing, setEditing] = useState<Partial<Supermarket> | null>(null)
  const [myName, setMyName] = useState(me?.display_name ?? '')
  const [familyName, setFamilyName] = useState(household?.name ?? '')

  const inviteUrl = `${window.location.origin}${window.location.pathname}?codigo=${household?.invite_code}`

  async function wrap(fn: () => PromiseLike<{ error: unknown }>, ok: string) {
    const { error } = await fn()
    if (error) toast(errorText(error), 'error')
    else { toast(ok); await refresh() }
  }

  async function share() {
    const text = `Únete a nuestra lista de la compra "${household?.name}" en Despensa. Código: ${household?.invite_code}`
    if (navigator.share) {
      try { await navigator.share({ title: 'Despensa', text, url: inviteUrl }) } catch { /* cancelado */ }
    } else {
      await navigator.clipboard?.writeText(`${text}\n${inviteUrl}`)
      toast('Invitación copiada')
    }
  }

  async function saveSupermarket() {
    if (!editing?.name?.trim()) return
    const row = { name: editing.name.trim(), color: editing.color ?? COLORS[0] }
    await wrap(
      () => editing.id
        ? supabase.from('supermarkets').update(row).eq('id', editing.id)
        : supabase.from('supermarkets').insert({ ...row, household_id: household!.id }),
      'Supermercado guardado',
    )
    setEditing(null)
  }

  async function deleteSupermarket(s: Supermarket) {
    if (!confirm(`¿Eliminar «${s.name}»? Los productos seguirán existiendo.`)) return
    await wrap(() => supabase.from('supermarkets').delete().eq('id', s.id), 'Supermercado eliminado')
    setEditing(null)
  }

  return (
    <div className="page">
      <header className="page-header"><h1>Ajustes</h1></header>

      <section className="card">
        <h3>Supermercados</h3>
        <ul className="plain">
          {supermarkets.map((s) => (
            <li key={s.id}>
              <button className="row-btn" onClick={() => setEditing(s)}>
                <span className="swatch-dot" style={{ background: s.color }} /> <span className="grow">{s.name}</span> <ChevronRight size={18} className="muted" />
              </button>
            </li>
          ))}
        </ul>
        <button className="btn" onClick={() => setEditing({ name: '', color: COLORS[supermarkets.length % COLORS.length] })}><Plus size={18} /> Añadir supermercado</button>
      </section>

      <section className="card">
        <h3>Familia</h3>
        <label>Nombre
          <div className="row">
            <input value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
            <button className="btn" disabled={familyName.trim() === household?.name || !familyName.trim()}
              onClick={async () => { await wrap(() => supabase.from('households').update({ name: familyName.trim() }).eq('id', household!.id), 'Guardado'); reloadHousehold() }}>
              Guardar
            </button>
          </div>
        </label>
        <p className="muted small">Código para que se unan otros miembros:</p>
        <div className="invite">
          <span className="code">{household?.invite_code}</span>
          <button className="btn primary" onClick={share}><Share2 size={18} /> Invitar</button>
        </div>
        <button className="link small" onClick={async () => {
          if (!confirm('¿Generar un código nuevo? El anterior dejará de funcionar.')) return
          const { error } = await supabase.rpc('regenerate_invite_code', { p_household: household!.id })
          if (error) toast(errorText(error), 'error'); else { reloadHousehold(); toast('Código nuevo generado') }
        }}>Cambiar código</button>

        <h4>Miembros</h4>
        <ul className="plain">
          {members.map((m) => <li key={m.user_id}><Avatar name={m.display_name} /> {m.display_name}{m.user_id === me?.user_id ? ' (tú)' : ''}</li>)}
        </ul>
      </section>

      <section className="card">
        <h3>Tu perfil</h3>
        <p className="muted small">{session?.user.email}</p>
        <label>Tu nombre
          <div className="row">
            <input value={myName} onChange={(e) => setMyName(e.target.value)} />
            <button className="btn" disabled={!myName.trim() || myName === me?.display_name}
              onClick={async () => {
                await wrap(() => supabase.from('members').update({ display_name: myName.trim() })
                  .eq('household_id', household!.id).eq('user_id', me!.user_id), 'Guardado')
                reloadHousehold()
              }}>Guardar</button>
          </div>
        </label>
        <button className="btn ghost big" onClick={() => supabase.auth.signOut()}><LogOut size={18} /> Cerrar sesión</button>
        <button className="btn ghost danger" onClick={async () => {
          if (!confirm('¿Salir de esta familia? Dejarás de ver su lista.')) return
          const { error } = await supabase.from('members').delete().eq('household_id', household!.id).eq('user_id', me!.user_id)
          if (error) toast(errorText(error), 'error'); else reloadHousehold()
        }}>Salir de la familia</button>
      </section>

      <p className="muted small center-text">
        Los datos de los productos escaneados vienen de Open Food Facts (ODbL).
      </p>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Editar supermercado' : 'Nuevo supermercado'}>
        <div className="form">
          <label>Nombre
            <input autoFocus value={editing?.name ?? ''} placeholder="Ej. Mercadona"
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && saveSupermarket()} />
          </label>
          <div className="colors">
            {COLORS.map((c) => (
              <button key={c} type="button" aria-label={c}
                className={`swatch ${editing?.color === c ? 'on' : ''}`} style={{ background: c }}
                onClick={() => setEditing({ ...editing, color: c })} />
            ))}
          </div>
          <button className="btn primary big" onClick={saveSupermarket} disabled={!editing?.name?.trim()}>Guardar</button>
          {editing?.id && <button className="btn ghost danger" onClick={() => deleteSupermarket(editing as Supermarket)}>Eliminar</button>}
        </div>
      </Sheet>
    </div>
  )
}
