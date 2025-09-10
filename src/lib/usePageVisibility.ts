"use client"
import { useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

export function usePageVisibility() {
  const wasAwayRef = useRef(false)
  const lastVisibleRef = useRef(Date.now())

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // User is leaving the page
        wasAwayRef.current = true
        lastVisibleRef.current = Date.now()
      } else if (wasAwayRef.current) {
        // User is returning to the page
        const timeAway = Date.now() - lastVisibleRef.current
        
        // If user was away for more than 5 minutes, refresh the session
        if (timeAway > 5 * 60 * 1000) {
          try {
            const { data: currentSession } = await supabase.auth.getSession()
            if (currentSession.session) {
              // Attempt to refresh the session
              await supabase.auth.refreshSession()
            }
          } catch (error) {
            console.warn('Failed to refresh session on page return:', error)
          }
        }
        wasAwayRef.current = false
      }
    }

    // Also handle when the window regains focus
    const handleFocus = async () => {
      if (wasAwayRef.current) {
        const timeAway = Date.now() - lastVisibleRef.current
        if (timeAway > 5 * 60 * 1000) {
          try {
            const { data: currentSession } = await supabase.auth.getSession()
            if (currentSession.session) {
              await supabase.auth.refreshSession()
            }
          } catch (error) {
            console.warn('Failed to refresh session on focus:', error)
          }
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