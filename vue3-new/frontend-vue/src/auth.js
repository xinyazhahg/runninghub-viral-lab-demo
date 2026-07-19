import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isAuthConfigured = Boolean(url && anonKey)
export const supabase = isAuthConfigured
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null

const SESSION_REFRESH_SKEW_MS = 30_000

function authExpiredError(message = '登录已过期，请重新登录') {
  const error = new Error(message)
  error.code = 'AUTH_EXPIRED'
  error.status = 401
  return error
}

export async function clearExpiredSession() {
  if (!supabase) return
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
}

export async function getSession() {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const session = data.session
  if (!session) return null
  const expiresAtMs = Number(session.expires_at || 0) * 1000
  if (expiresAtMs && expiresAtMs <= Date.now() + SESSION_REFRESH_SKEW_MS) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !refreshed.session?.access_token) {
      await clearExpiredSession()
      throw authExpiredError()
    }
    return refreshed.session
  }
  return session
}

export async function getAccessToken() {
  return (await getSession())?.access_token || ''
}

export async function signUp(email, password) {
  if (!supabase) throw new Error('前端未配置 Supabase Auth')
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('前端未配置 Supabase Auth')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
