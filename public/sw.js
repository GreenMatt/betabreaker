const CACHE_NAME = 'betabreaker-v3'
const OFFLINE_URLS = [
  '/manifest.webmanifest'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME ? caches.delete(k) : undefined)))
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
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        const copy = res.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        return res
      }))
    )
    return
  }

  // Stale-while-revalidate for same-origin images, styles, and fonts
  if (request.destination === 'image' || request.destination === 'style' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((res) => {
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
