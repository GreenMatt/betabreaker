// lib/authContext.tsx
"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import { isNativePlatform, openExternal } from '@/lib/nativeBridge'
import { startDiagnostics } from '@/lib/authDiagnostics'

type Provider = 'google'

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
  authEpoch: number
  ready: boolean
  signInWith: (provider: Provider) => Promise<void>
  signInEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function ensureProfile(user: User) {
  const meta: any = user.user_metadata || {}
  const name = meta.full_name || meta.name || meta.user_name || (user.email ? user.email.split('@')[0] : null)
  const email = user.email || meta.email || null
  const profile_photo = meta.avatar_url || null
  await supabase.from('users').upsert({ id: user.id, email, name, profile_photo }, { onConflict: 'id' })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authEpoch, setAuthEpoch] = useState(0)
  const [ready, setReady] = useState(false)
  const bumpAuthEpoch = () => setAuthEpoch((n) => n + 1)

  useEffect(() => {
    // Enable diagnostics in dev, or when BB_DEBUG=1 or NEXT_PUBLIC_AUTH_DEBUG=1
    try {
      const want = process.env.NODE_ENV === 'development' ||
        process.env.NEXT_PUBLIC_AUTH_DEBUG === '1' ||
        (typeof window !== 'undefined' && localStorage.getItem('BB_DEBUG') === '1')
      if (want) startDiagnostics()
    } catch {}

    const safety = setTimeout(() => setLoading(false), 10_000)

    const rehydrateFromStorage = async () => {
      try {
        if (typeof window === 'undefined') return false
        // Restrict to this Supabase project ref when possible
        let projectRef: string | null = null
        try {
          const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL as string)
          // typical host: <ref>.supabase.co
          projectRef = (u.hostname.split('.') || [])[0] || null
        } catch { projectRef = null }
        // Find any sb-*-auth-token key
        const keys: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (!k) continue
          if (/\bsb-.*-auth-token\b/i.test(k)) {
            if (!projectRef || k.includes(projectRef)) {
              keys.push(k)
            }
          }
        }
        for (const k of keys) {
          try {
            const raw = localStorage.getItem(k)
            if (!raw) continue
            const parsed = JSON.parse(raw)
            const cur = parsed?.currentSession || parsed?.session || null
            const at = cur?.access_token
            const rt = cur?.refresh_token
            if (at && rt) {
              const { data, error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt })
              if (!error && data?.session) {
                setSession(data.session)
                setUser(data.session.user)
                try { await ensureProfile(data.session.user) } catch {}
                bumpAuthEpoch()
                return true
              }
            }
          } catch {}
        }
      } catch {}
      return false
    }

    const pingDb = async () => {
      try {
        const { error } = await supabase.from('users').select('id', { head: true, count: 'exact' }).limit(1)
        return !error
      } catch { return false }
    }

    const recover = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          await supabase.auth.refreshSession().catch(() => {})
          if (await pingDb()) { bumpAuthEpoch(); return true }
        }
        const ok = await rehydrateFromStorage()
        if (ok && await pingDb()) { bumpAuthEpoch(); return true }
      } catch {}
      return false
    }

    const init = async () => {
      try {
        console.log('🔐 Initializing auth session...')
        // Prefer server session (cookie-based) so we avoid client bootstrap gaps
        let serverSession: any = null
        try {
          const res = await fetch('/api/auth/session', { cache: 'no-store' })
          if (res.ok) {
            const json = await res.json()
            serverSession = json?.session || null
          }
        } catch {}

        if (serverSession) {
          console.log('✅ Session found (server):', {
            userId: serverSession.user.id,
            expiresAt: new Date(serverSession.expires_at! * 1000).toISOString(),
            provider: serverSession.user.app_metadata?.provider
          })
          setSession(serverSession)
          setUser(serverSession.user)
          try { await ensureProfile(serverSession.user) } catch (e) { console.warn('ensureProfile on bootstrap failed:', e) }
          bumpAuthEpoch()
        } else {
          // Fallback to client query
          const { data, error } = await supabase.auth.getSession()
          if (error) {
            console.error('Auth bootstrap error:', error)
            setError(error.message)
          }
          if (data?.session) {
            console.log('✅ Session found (client):', {
              userId: data.session.user.id,
              expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
              provider: data.session.user.app_metadata?.provider
            })
            setSession(data.session)
            setUser(data.session.user)
            try { await ensureProfile(data.session.user) } catch (e) { console.warn('ensureProfile on bootstrap failed:', e) }
            bumpAuthEpoch()
          } else {
            console.log('ℹ️ No session found during bootstrap')
            const ok = await rehydrateFromStorage()
            if (ok) bumpAuthEpoch()
          }
        }
      } finally {
        clearTimeout(safety)
        setLoading(false)
        setReady(true)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log(`🔄 Auth state changed: ${event}`, {
        hasSession: !!newSession,
        userId: newSession?.user?.id,
        timestamp: new Date().toISOString(),
        expiresAt: newSession?.expires_at ? new Date(newSession.expires_at * 1000).toISOString() : null
      })

      if (newSession) setSession(newSession)
      if (newSession) setUser(newSession.user)

      if (newSession) {
        bumpAuthEpoch()
      }

      if (event === 'SIGNED_IN' && newSession?.user) {
        try { await ensureProfile(newSession.user) } catch (e) { console.warn('ensureProfile on sign-in failed:', e) }
      }

      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setError(null)
      }

      if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token refreshed successfully')
        bumpAuthEpoch()
      }

      setLoading(false)
      setReady(true)
    })

    const onOnline = async () => {
      try {
        await recover()
      } catch {}
    }
    window.addEventListener('online', onOnline)

    // Refresh when the tab becomes visible (with a small cooldown)
    let lastVisRefresh = 0
    const onVis = async () => {
      if (document.hidden) return
      const now = Date.now()
      lastVisRefresh = now
      try {
        await recover()
      } catch {}
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const signInWith = useCallback(async (provider: Provider) => {
    setError(null)
    setLoading(true)
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined
      const native = isNativePlatform()
      const redirectTo = native ? 'io.betabreaker.app://auth/callback' : (origin ? `${origin}/api/auth/callback` : undefined)
      if (native) {
        // Use system browser and deep link back to the app
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
            flowType: 'pkce' as any,
            skipBrowserRedirect: true,
          }
        })
        if (error) setError(error.message)
        if (data?.url) await openExternal(data.url)
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
            flowType: 'pkce' as any,
          }
        })
        if (error) setError(error.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const signInEmail = useCallback(async (email: string) => {
    setError(null)
    setLoading(true)
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined
      const native = isNativePlatform()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: native ? 'io.betabreaker.app://auth/callback' : origin }
      })
      if (error) setError(error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    try { await fetch('/api/auth/signout', { method: 'POST', headers: { 'x-csrf': '1' } }) } catch {}
    await supabase.auth.signOut().catch(() => {})
    setSession(null)
    setUser(null)
    bumpAuthEpoch()
  }, [])

  // Expose minimal controls for prod debugging even if diagnostics are disabled
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        (window as any).bbAuth = {
          refresh: async () => { const r = await supabase.auth.refreshSession(); bumpAuthEpoch(); return r },
          rehydrate: async () => {
            const ok = await (async () => {
              try {
                if (typeof window === 'undefined') return false
                const keys: string[] = []
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i)
                  if (k && /\bsb-.*-auth-token\b/i.test(k)) keys.push(k)
                }
                for (const k of keys) {
                  try {
                    const raw = localStorage.getItem(k)
                    if (!raw) continue
                    const parsed = JSON.parse(raw)
                    const cur = parsed?.currentSession || parsed?.session || null
                    const at = cur?.access_token
                    const rt = cur?.refresh_token
                    if (at && rt) {
                      const { data, error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt })
                      if (!error && data?.session) { setSession(data.session); setUser(data.session.user); return true }
                    }
                  } catch {}
                }
              } catch {}
              return false
            })()
            if (ok) bumpAuthEpoch()
            return ok
          }
        }
      }
    } catch {}
  }, [])

  const value = useMemo(
    () => ({ user, session, loading, error, authEpoch, ready, signInWith, signInEmail, signOut }),
    [user, session, loading, error, authEpoch, ready, signInWith, signInEmail, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

