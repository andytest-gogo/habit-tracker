// ── 每次部署改這個 ──
const CACHE_VERSION = 'ht-v20250516-3';

// SW 啟動後，通知所有已開啟的 client 重新整理
function notifyClientsToReload() {
  self.clients.matchAll({ type: 'window' }).then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION });
    });
  });
}

self.addEventListener('install', event => {
  console.log('[SW] install', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(['/manifest.json']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] activate', CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => notifyClientsToReload())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // HTML → network-first, no-store
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(res => {
          if (res && res.status === 200)
            caches.open(CACHE_VERSION).then(c => c.put(event.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(event.request)
          .then(cached => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  // 靜態資源 → cache-first
  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const net = fetch(event.request).then(res => {
          if (res && res.status === 200)
            caches.open(CACHE_VERSION).then(c => c.put(event.request, res.clone()));
          return res;
        });
        return cached || net;
      })
    );
  }
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION')
    event.source?.postMessage({ type: 'SW_VERSION', version: CACHE_VERSION });
});
