const CACHE_NAME = 'betabreaker-v2'
const OFFLINE_URLS = [
  // Only cache static, truly offline-safe assets
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

  // Avoid caching Next.js navigation/documents to prevent stale app shells
  const isDocument = request.mode === 'navigate' || request.destination === 'document'
  if (isDocument) {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    )
    return
  }

  // Network-first for JS/CSS; cache-first for other GETs
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      fetch(request).then((res) => {
        const copy = res.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        return res
      }).catch(() => caches.match(request))
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        const copy = networkResponse.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        return networkResponse
      }).catch(() => cached)
      return cached || fetchPromise
    })
  )
})
