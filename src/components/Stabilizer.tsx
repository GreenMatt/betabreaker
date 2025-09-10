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
      if (!enabled || slowConnection) {
        console.log('[Stabilizer] Clearing service workers:', regs.length)
        await Promise.all(regs.map(r => r.unregister().catch(() => {})))
        // Best-effort clear related caches
        if (typeof caches !== 'undefined') {
          const names = await caches.keys()
          console.log('[Stabilizer] Clearing caches:', names.filter(n => /betabreaker|^next|^workbox/i.test(n)))
          await Promise.all(names.map(n => (/betabreaker|^next|^workbox/i.test(n) ? caches.delete(n) : Promise.resolve(false))))
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
  } catch {}
}

// Expose manual SW clearing function to global scope for debugging
if (typeof window !== 'undefined') {
  (window as any).clearServiceWorkers = async () => {
    console.log('[Debug] Manually clearing all service workers')
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
      if (typeof caches !== 'undefined') {
        const names = await caches.keys()
        await Promise.all(names.map(n => caches.delete(n)))
      }
      console.log('[Debug] All service workers and caches cleared')
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
        const looksStuck = txt.includes('loading') && !txt.includes('login')
        if (looksStuck) {
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
      if (errCount >= 3 && sessionStorage.getItem('bb_recovered') !== '1') {
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
