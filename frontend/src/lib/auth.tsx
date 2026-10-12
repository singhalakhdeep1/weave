import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, refreshSession, setAccessToken, setSessionLostHandler, type User } from './api'

interface AuthState {
  user: User | null
  ready: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<string>
  signOut: () => Promise<void>
  setUser: (u: User) => void
}

const AuthContext = createContext<AuthState | null>(null)
const HINT = 'weave_session'

const hint = {
  get: () => { try { return localStorage.getItem(HINT) === '1' } catch { return true } },
  set: (on: boolean) => { try { on ? localStorage.setItem(HINT, '1') : localStorage.removeItem(HINT) } catch { /* ignore */ } },
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  // Restore the session from the httpOnly refresh cookie (skipped when this browser never signed in)
  useEffect(() => {
    setSessionLostHandler(() => { setAccessToken(null); hint.set(false); setUser(null) })
    if (!hint.get()) { setReady(true); return }
    refreshSession()
      .then(async (token) => { if (token) setUser(await api.me()); else hint.set(false) })
      .catch(() => hint.set(false))
      .finally(() => setReady(true))
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await api.login({ email, password })
    setAccessToken(r.accessToken); hint.set(true); setUser(r.user)
  }, [])

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const r = await api.register({ name, email, password })
    setAccessToken(r.accessToken); hint.set(true); setUser(r.user)
    return r.workspaceId
  }, [])

  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined)
    setAccessToken(null); hint.set(false); setUser(null)
    window.location.assign('/login') // full reload clears every cached query and open socket
  }, [])

  const value = useMemo(() => ({ user, ready, signIn, signUp, signOut, setUser }), [user, ready, signIn, signUp, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
