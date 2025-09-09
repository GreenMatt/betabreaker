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

async function unregisterSWIfDisabled() {
  try {
    const enabled = process.env.NEXT_PUBLIC_ENABLE_SW === '1'
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations().catch(() => [])
      if (!enabled) {
        await Promise.all(regs.map(r => r.unregister().catch(() => {})))
        // Best-effort clear related caches
        if (typeof caches !== 'undefined') {
          const names = await caches.keys()
          await Promise.all(names.map(n => (/betabreaker|^next|^workbox/i.test(n) ? caches.delete(n) : Promise.resolve(false))))
        }
      }
    }
  } catch {}
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
    }, 8000)

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
