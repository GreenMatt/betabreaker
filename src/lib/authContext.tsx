"use client"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
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

  useEffect(() => {
    console.log('Simple auth: Starting...')
    
    // Simple bootstrap - no watchdogs, no complex timers
    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        console.log('Simple auth: Initial session:', !!data?.session)
        
        if (error) {
          console.error('Simple auth: Session error:', error)
          setError(error.message)
        } else if (data.session) {
          setSession(data.session)
          setUser(data.session.user)
          try {
            await ensureProfile(data.session.user)
            console.log('Simple auth: Profile ensured')
          } catch (e) {
            console.warn('Simple auth: Profile failed:', e)
          }
        }
      } catch (e: any) {
        console.error('Simple auth: Init error:', e)
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // Simple auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Simple auth: State change:', event, !!newSession)
      
      setSession(newSession)
      setUser(newSession?.user ?? null)
      
      if (event === 'SIGNED_IN' && newSession?.user) {
        try {
          await ensureProfile(newSession.user)
          console.log('Simple auth: Profile ensured on sign-in')
        } catch (e) {
          console.warn('Simple auth: Profile failed on sign-in:', e)
        }
      }

      if (event === 'SIGNED_OUT') {
        setError(null)
      }

      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signInWith = useCallback(async (provider: Provider) => {
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({ 
        provider, 
        options: { 
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined 
        } 
      })
      if (error) setError(error.message)
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
      const { error } = await supabase.auth.signInWithOtp({ 
        email, 
        options: { 
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined 
        } 
      })
      if (error) setError(error.message)
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