"use client"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

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
  const bootedRef = useRef(false)

  function clearSupabaseLocal() {
    try {
      if (typeof localStorage === 'undefined') {
        console.warn('localStorage not available')
        return
      }
      console.log('Clearing Supabase localStorage keys')
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!k) continue
        const lk = k.toLowerCase()
        if (lk.startsWith('sb-') || lk.includes('supabase')) keys.push(k)
      }
      console.log('Found Supabase keys to clear:', keys)
      keys.forEach(k => { try { localStorage.removeItem(k) } catch {} })
    } catch (e) {
      console.error('Error clearing localStorage:', e)
    }
  }

  useEffect(() => {
    let unsub: (() => void) | undefined
    let refreshInterval: NodeJS.Timeout | undefined
    
    // Safety: if bootstrap hangs (corrupt session or blocked storage), clear SB keys and continue
    const watchdog = setTimeout(() => {
      if (!bootedRef.current) {
        clearSupabaseLocal()
        setLoading(false)
      }
    }, 5000)

    // Setup periodic session refresh
    const setupRefreshInterval = (session: Session | null) => {
      if (refreshInterval) clearInterval(refreshInterval)
      
      if (session) {
        // Refresh token every 45 minutes (tokens expire in 1 hour)
        refreshInterval = setInterval(async () => {
          try {
            const { data, error } = await supabase.auth.refreshSession()
            if (error) {
              console.warn('Session refresh failed:', error.message)
              // Let the auth state change handler deal with the expired session
            }
          } catch (e) {
            console.warn('Session refresh error:', e)
          }
        }, 45 * 60 * 1000) // 45 minutes
      }
    }

    ;(async () => {
      try {
        console.log('Browser info:', { userAgent: navigator.userAgent, localStorage: !!localStorage })
        const { data, error } = await supabase.auth.getSession()
        console.log('getSession result:', { data: data?.session ? 'session exists' : 'no session', error })
        if (error) {
          console.error('Session error:', error)
          setError(error.message)
          setSession(null)
          setUser(null)
        } else {
          setSession(data.session)
          setUser(data.session?.user ?? null)
          setupRefreshInterval(data.session)
          
          if (data.session?.user) {
            console.log('Creating profile for user:', data.session.user.id)
            try { 
              await ensureProfile(data.session.user) 
              console.log('Profile created successfully')
            } catch (e) { 
              console.error('Profile creation failed:', e)
            }
          }
        }
      } catch (e: any) {
        console.error('Session bootstrap error:', e)
        setError(e.message || 'Failed to load session')
        setSession(null)
        setUser(null)
      } finally {
        bootedRef.current = true
        clearTimeout(watchdog)
        setLoading(false)
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state change:', event, newSession ? 'session exists' : 'no session')
      
      setSession(newSession)
      setUser(newSession?.user ?? null)
      setupRefreshInterval(newSession)
      
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        setError(null) // Clear any previous errors
      }
      
      if (event === 'SIGNED_IN' && newSession?.user) {
        try { 
          await ensureProfile(newSession.user)
          console.log('Profile ensured for user:', newSession.user.id)
        } catch (e) { 
          console.error('Profile creation failed:', e)
        }
      }
    })
    
    unsub = () => {
      sub.subscription.unsubscribe()
      if (refreshInterval) clearInterval(refreshInterval)
    }
    
    return () => { 
      unsub?.()
      clearTimeout(watchdog)
      if (refreshInterval) clearInterval(refreshInterval)
    }
  }, [])

  const signInWith = useCallback(async (provider: Provider) => {
    setError(null)
    setLoading(true)
    try {
      await supabase.auth.signInWithOAuth({ 
        provider, 
        options: { 
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined 
        } 
      })
    } catch (e: any) {
      setError(e?.message ?? 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }, [])

  const signInEmail = useCallback(async (email: string) => {
    setError(null)
    setLoading(true)
    try {
      await supabase.auth.signInWithOtp({ 
        email, 
        options: { 
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined 
        } 
      })
    } catch (e: any) {
      setError(e?.message ?? 'Failed to send email link')
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    try {
      await supabase.auth.signOut()
    } catch (e: any) {
      setError(e?.message ?? 'Failed to sign out')
    }
  }, [])

  const value = useMemo(() => ({ user, session, loading, error, signInWith, signInEmail, signOut }), [user, session, loading, error, signInWith, signInEmail, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
