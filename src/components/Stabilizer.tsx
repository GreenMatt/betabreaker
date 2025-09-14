"use client"
import { useEffect } from 'react'

export default function Stabilizer() {
  useEffect(() => {
    console.log('[Simple Stabilizer] Loaded - doing minimal cleanup only')

    // Force a single canonical host to avoid split localStorage sessions between apex and www
    try {
      if (typeof window !== 'undefined') {
        const h = window.location.hostname
        if (h === 'betabreaker.app') {
          const target = `https://www.betabreaker.app${window.location.pathname}${window.location.search}${window.location.hash}`
          window.location.replace(target)
          return
        }
      }
    } catch {}

    // Only do basic service worker cleanup, no session clearing
    const cleanupServiceWorkers = async () => {
      try {
        const enabled = process.env.NEXT_PUBLIC_ENABLE_SW === '1'
        
        if ('serviceWorker' in navigator && !enabled) {
          const regs = await navigator.serviceWorker.getRegistrations().catch(() => [])
          console.log(`[Simple Stabilizer] SW disabled, cleaning ${regs.length} registrations`)
          await Promise.all(regs.map(r => r.unregister().catch(() => {})))
          
          if (typeof caches !== 'undefined') {
            const names = await caches.keys()
            const toDelete = names.filter(n => /betabreaker|^next|^workbox/i.test(n))
            await Promise.all(names.map(n => (/betabreaker|^next|^workbox/i.test(n) ? caches.delete(n) : Promise.resolve(false))))
          }
        }
      } catch (e) {
        console.warn('[Simple Stabilizer] SW cleanup failed:', e)
      }
    }

    cleanupServiceWorkers()

    // NO watchdogs, NO session clearing, NO error recovery
  }, [])

  return null
}
