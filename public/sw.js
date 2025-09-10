const CACHE_NAME = 'betabreaker-v4'
const OFFLINE_URLS = [
  '/manifest.webmanifest'
]

function fetchWithTimeout(request, timeout = 8000) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('fetch timeout')), timeout)
    )
  ])
}

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v4')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v4')
  event.waitUntil(
    caches.keys().then((keys) => {
      console.log('[SW] Cleaning old caches:', keys.filter(k => k !== CACHE_NAME))
      return Promise.all(keys.map((k) => k !== CACHE_NAME ? caches.delete(k) : undefined))
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Never interfere with cross-origin (e.g., Supabase) or Next.js runtime/data endpoints
  if (url.origin !== self.location.origin) return

  // Do not handle documents, RSC/data, or any dynamic Next.js endpoints
  const isDocument = request.mode === 'navigate' || request.destination === 'document'
  const isNextData = url.pathname.startsWith('/_next/data') || url.pathname.startsWith('/_next/image')
  const isRsc = url.searchParams.has('__nextDataReq') || url.pathname.startsWith('/_next/webpack-hmr')
  if (isDocument || isNextData || isRsc) return

  // Cache-first only for immutable hashed assets under /_next/static
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetchWithTimeout(request).then((res) => {
        const copy = res.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        return res
      }).catch(() => cached || new Response('', { status: 408 })))
    )
    return
  }

  // Stale-while-revalidate for same-origin images, styles, and fonts
  if (request.destination === 'image' || request.destination === 'style' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetchWithTimeout(request, 5000).then((res) => {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return res
        }).catch(() => cached)
        return cached || network
      })
    )
    return
  }
  // For everything else, let the browser handle it (no caching)
})

// Handle message port errors
self.addEventListener('message', (event) => {
  console.log('[SW] Received message:', event.data)
  // Simple message acknowledgment to prevent port errors
  if (event.ports && event.ports[0]) {
    try {
      event.ports[0].postMessage({ success: true, version: 'v4' })
    } catch (e) {
      console.log('[SW] Port message failed:', e)
    }
  }
  // Handle skip waiting messages
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
