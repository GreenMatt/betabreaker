"use client"
import { useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

export function usePageVisibility() {
  const wasAwayRef = useRef(false)
  const lastVisibleRef = useRef(Date.now())
  const lastRefreshRef = useRef(0)

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // User is leaving the page
        wasAwayRef.current = true
        lastVisibleRef.current = Date.now()
      } else if (wasAwayRef.current) {
        // User is returning to the page
        const now = Date.now()
        const sinceLast = now - lastRefreshRef.current
        try {
          const { data: currentSession } = await supabase.auth.getSession()
          if (currentSession.session) {
            if (sinceLast > 60_000) { // 60s cooldown
              await supabase.auth.refreshSession()
              lastRefreshRef.current = now
            }
          }
        } catch (error) {
          console.warn('Failed to refresh session on page return:', error)
        }
        wasAwayRef.current = false
      }
    }

    // Also handle when the window regains focus
    const handleFocus = async () => {
      if (wasAwayRef.current) {
        const now = Date.now()
        const sinceLast = now - lastRefreshRef.current
        try {
          const { data: currentSession } = await supabase.auth.getSession()
          if (currentSession.session && sinceLast > 60_000) {
            await supabase.auth.refreshSession()
            lastRefreshRef.current = now
          }
        } catch (error) {
          console.warn('Failed to refresh session on focus:', error)
        }
        wasAwayRef.current = false
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])
}
