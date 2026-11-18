import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && key)

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Convierte errores de Supabase en mensajes legibles en español */
export function errorText(e: unknown): string {
  const msg =
    typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos'
  if (msg.includes('Email not confirmed')) return 'Confirma tu email (revisa tu bandeja de entrada)'
  if (msg.includes('User already registered')) return 'Ese email ya tiene cuenta: inicia sesión'
  if (msg.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres'
  if (msg.includes('products_barcode_uidx')) return 'Ya existe un producto con ese código de barras'
  if (msg.includes('Failed to fetch')) return 'Sin conexión. Inténtalo de nuevo'
  return msg
}
