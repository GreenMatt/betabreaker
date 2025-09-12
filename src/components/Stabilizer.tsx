"use client"
import { useEffect, useRef } from 'react'
import { logClientError } from '@/lib/clientLog'

function clearSupabaseLocal() {
  try {
    if (typeof localStorage === 'undefined') return
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      const lk = k.toLowerCase()
      if (lk.startsWith('sb-') || lk.includes('supabase')) keys.push(k)
    }
    keys.forEach(k => { try { localStorage.removeItem(k) } catch {} })
  } catch {}
}

function isSlowConnection() {
  try {
    // Check if Network Information API is available
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    if (connection) {
      // Disable SW on slow connections (2G or slower)
      return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g'
    }
  } catch {}
  return false
}

async function unregisterSWIfDisabled() {
  try {
    const enabled = process.env.NEXT_PUBLIC_ENABLE_SW === '1'
    const slowConnection = isSlowConnection()
    
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations().catch(() => [])
      
      // Check for phantom service worker
      const hasController = !!navigator.serviceWorker.controller
      if (hasController && regs.length === 0) {
        console.log('[Stabilizer] ⚠️ PHANTOM SERVICE WORKER DETECTED!')
        console.log('[Stabilizer] Controller exists but no registrations found')
        // Try to clear the phantom controller
        try {
          navigator.serviceWorker.controller?.postMessage({ type: 'FORCE_TERMINATE' })
        } catch (e) {
          console.log('[Stabilizer] Failed to clear phantom controller:', e)
        }
      }
      
      if (!enabled || slowConnection) {
        console.log('[Stabilizer] Clearing service workers:', regs.length, hasController ? '(+phantom)' : '')
        await Promise.all(regs.map(r => r.unregister().catch(() => {})))
        
        // Best-effort clear related caches
        if (typeof caches !== 'undefined') {
          const names = await caches.keys()
          const toDelete = names.filter(n => /betabreaker|^next|^workbox/i.test(n))
          console.log('[Stabilizer] Clearing caches:', toDelete)
          await Promise.all(names.map(n => (/betabreaker|^next|^workbox/i.test(n) ? caches.delete(n) : Promise.resolve(false))))
        }
        
        // If phantom controller still exists after clearing, log it
        if (navigator.serviceWorker.controller) {
          console.log('[Stabilizer] ⚠️ Controller still exists after clearing!')
        }
      } else if (enabled) {
        // Force update existing service worker to new version
        if (regs.length > 0) {
          console.log('[Stabilizer] SW enabled, checking for updates')
          regs.forEach(reg => {
            if (reg.waiting) {
              console.log('[Stabilizer] SW update waiting, forcing activation')
              reg.waiting.postMessage({ type: 'SKIP_WAITING' })
            }
            reg.update().catch(() => {})
          })
        }
      }
    }
  } catch (e) {
    console.log('[Stabilizer] Error in unregisterSWIfDisabled:', e)
  }
}

// Expose manual SW clearing function to global scope for debugging
if (typeof window !== 'undefined') {
  (window as any).debugServiceWorkers = async () => {
    console.log('[Debug] === SERVICE WORKER DEBUG ===')
    if ('serviceWorker' in navigator) {
      console.log('[Debug] Navigator SW support:', !!navigator.serviceWorker)
      console.log('[Debug] Current controller:', navigator.serviceWorker.controller)
      
      const regs = await navigator.serviceWorker.getRegistrations()
      console.log('[Debug] Registrations found:', regs.length)
      regs.forEach((reg, i) => {
        console.log(`[Debug] Registration ${i}:`, {
          scope: reg.scope,
          active: !!reg.active,
          installing: !!reg.installing,
          waiting: !!reg.waiting,
          state: reg.active?.state
        })
      })
      
      if (typeof caches !== 'undefined') {
        const names = await caches.keys()
        console.log('[Debug] Cache names:', names)
      }
      
      // Check if there's a service worker but no registrations (phantom)
      if (navigator.serviceWorker.controller && regs.length === 0) {
        console.log('[Debug] ⚠️ PHANTOM SERVICE WORKER DETECTED!')
        console.log('[Debug] Controller exists but no registrations found')
      }
    }
  }
  
  (window as any).clearServiceWorkers = async () => {
    console.log('[Debug] === NUCLEAR SERVICE WORKER CLEARING ===')
    if ('serviceWorker' in navigator) {
      // Step 1: Get all registrations  
      const regs = await navigator.serviceWorker.getRegistrations()
      console.log('[Debug] Found registrations:', regs.length)
      
      // Step 2: Unregister everything
      await Promise.all(regs.map(async (reg) => {
        console.log('[Debug] Unregistering:', reg.scope)
        return reg.unregister()
      }))
      
      // Step 3: Clear all caches
      if (typeof caches !== 'undefined') {
        const names = await caches.keys()
        console.log('[Debug] Clearing caches:', names)
        await Promise.all(names.map(n => caches.delete(n)))
      }
      
      // Step 4: Force clear any phantom controllers
      if (navigator.serviceWorker.controller) {
        console.log('[Debug] Controller still exists, attempting force clear')
        try {
          navigator.serviceWorker.controller.postMessage({ type: 'FORCE_TERMINATE' })
        } catch (e) {
          console.log('[Debug] Controller force clear failed:', e)
        }
      }
      
      console.log('[Debug] Clearing complete, reloading...')
      window.location.reload()
    }
  }
}

export default function Stabilizer() {
  const loggedRef = useRef(0)
  useEffect(() => {
    unregisterSWIfDisabled().catch(() => {})

    // Watchdog: if the app looks stuck on a loading skeleton for too long, clear only Supabase session
    const watchdog = setTimeout(() => {
      try {
        if (typeof window === 'undefined') return
        if (sessionStorage.getItem('bb_recovered') === '1') return
        const txt = (document.body?.innerText || '').toLowerCase()
        // Only trigger if genuinely stuck on loading AND not successfully signed in
        const looksStuck = txt.includes('loading') && !txt.includes('login') && !txt.includes('signed in') && !txt.includes('welcome back')
        if (looksStuck) {
          console.log('[Stabilizer] App appears stuck, clearing session')
          clearSupabaseLocal()
          sessionStorage.setItem('bb_recovered', '1')
          window.location.reload()
        }
      } catch {}
    }, 12000)

    // Global error burst recovery
    let errCount = 0
    const onErr = (evt?: any) => {
      // lightweight client logging, sample first 3 errors per load
      if (loggedRef.current < 3) {
        loggedRef.current++
        const err: any = evt?.error || evt?.reason || evt
        const message = err?.message || String(err || 'window error')
        const stack = err?.stack
        logClientError({ message, stack }).catch(() => {})
      }
      errCount++
      if (errCount >= 5 && sessionStorage.getItem('bb_recovered') !== '1') {
        console.log('[Stabilizer] Multiple errors detected, clearing session')
        clearSupabaseLocal()
        sessionStorage.setItem('bb_recovered', '1')
        window.location.reload()
      }
    }
    window.addEventListener('error', onErr)
    window.addEventListener('unhandledrejection', onErr as any)

    return () => {
      clearTimeout(watchdog)
      window.removeEventListener('error', onErr)
      window.removeEventListener('unhandledrejection', onErr as any)
    }
  }, [])

  return null
}
