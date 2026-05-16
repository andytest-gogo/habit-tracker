// ── Cache version: bump this string whenever you deploy a new build ──
// Format: 'healthy-habits-vYYYYMMDD-N' (date + deploy number)
const CACHE_VERSION = 'healthy-habits-v20250516-1';

// Static assets to pre-cache on install (never changes between deploys)
const STATIC_ASSETS = [
  '/manifest.json',
];

// ── Install: pre-cache static assets only ──
// Do NOT cache index.html here — always fetch it fresh from network
self.addEventListener('install', event => {
  console.log('[SW] Installing', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => {
        // Take over immediately without waiting for old SW to be released
        return self.skipWaiting();
      })
  );
});

// ── Activate: delete all old caches ──
self.addEventListener('activate', event => {
  console.log('[SW] Activating', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_VERSION)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: different strategies for different request types ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Cross-origin requests (Supabase, APIs, CDNs) → always network, no cache
  if (url.origin !== self.location.origin) {
    return; // Let browser handle normally
  }

  // 2. HTML pages (index.html, /) → Network-first, fallback to cache
  // This ensures users always get the latest version of the app
  if (
    event.request.mode === 'navigate' ||
    event.request.headers.get('accept')?.includes('text/html')
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Got a fresh response — update cache and return it
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Network failed (offline) — serve cached HTML as fallback
          console.warn('[SW] Network failed for HTML, serving cache');
          return caches.match(event.request)
            .then(cached => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  // 3. Static assets (JS, CSS, images, fonts) → Cache-first, fallback to network
  // These don't change often; cache-first is safe and fast
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 4. Everything else → network only
});

// ── Message handler: receive SKIP_WAITING from index.html ──
// index.html calls: serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING — taking over immediately');
    self.skipWaiting();
  }
});
