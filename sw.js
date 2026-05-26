const CACHE_VERSION = 'ht-v20260526-2';

self.addEventListener('install', event => {
  // Skip waiting immediately so new SW activates without waiting for old tabs to close
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Don't intercept cross-origin requests
  if (url.origin !== self.location.origin) return;

  // HTML navigation → always network-first, never serve stale HTML
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Images & fonts → cache-first (these don't change often)
  if (/\.(png|jpg|jpeg|gif|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_VERSION)
              .then(c => c.put(event.request, res.clone()));
          }
          return res;
        });
      })
    );
    return;
  }

  // Everything else → network only (JS, API calls, etc.)
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
