// lib/authContext.tsx
"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import { startDiagnostics } from '@/lib/authDiagnostics'

type Provider = 'google' | 'facebook'

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
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
        // Find any sb-*-auth-token key
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
              if (!error && data?.session) {
                setSession(data.session)
                setUser(data.session.user)
                try { await ensureProfile(data.session.user) } catch {}
                return true
              }
            }
          } catch {}
        }
      } catch {}
      return false
    }

    const init = async () => {
      try {
        console.log('🔐 Initializing auth session...')
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Auth bootstrap error:', error)
          setError(error.message)
        }
        if (data?.session) {
          console.log('✅ Session found:', {
            userId: data.session.user.id,
            expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
            provider: data.session.user.app_metadata?.provider
          })
          setSession(data.session)
          setUser(data.session.user)
          try { await ensureProfile(data.session.user) } catch (e) { console.warn('ensureProfile on bootstrap failed:', e) }
        } else {
          console.log('ℹ️ No session found during bootstrap')
          await rehydrateFromStorage()
        }
      } finally {
        clearTimeout(safety)
        setLoading(false)
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

      setSession(newSession)
      setUser(newSession?.user ?? null)

      if (!newSession) {
        await rehydrateFromStorage()
      }

      if (event === 'SIGNED_IN' && newSession?.user) {
        try { await ensureProfile(newSession.user) } catch (e) { console.warn('ensureProfile on sign-in failed:', e) }
      }

      if (event === 'SIGNED_OUT') {
        setError(null)
      }

      if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token refreshed successfully')
      }

      setLoading(false)
    })

    const onOnline = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          await supabase.auth.refreshSession().catch(() => {})
        } else {
          await rehydrateFromStorage()
        }
      } catch {}
    }
    window.addEventListener('online', onOnline)

    // Refresh when the tab becomes visible (with a small cooldown)
    let lastVisRefresh = 0
    const onVis = async () => {
      if (document.hidden) return
      const now = Date.now()
      if (now - lastVisRefresh < 60_000) return // 60s cooldown
      lastVisRefresh = now
      try {
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          await supabase.auth.refreshSession().catch(() => {})
        } else {
          await rehydrateFromStorage()
        }
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined }
      })
      if (error) setError(error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const signInEmail = useCallback(async (email: string) => {
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined }
      })
      if (error) setError(error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    await supabase.auth.signOut()
  }, [])

  const value = useMemo(
    () => ({ user, session, loading, error, signInWith, signInEmail, signOut }),
    [user, session, loading, error, signInWith, signInEmail, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
