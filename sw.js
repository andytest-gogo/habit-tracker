// ── 每次部署改這個版本號 ──
const CACHE_VERSION = 'ht-v20250516-4';

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
        keys.filter(k => k !== CACHE_VERSION).map(k => {
          console.log('[SW] deleting old cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 跨域請求一律不攔截
  if (url.origin !== self.location.origin) return;

  // HTML 導航 → network-first，帶 no-store 確保拿最新版
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(event.request)
            .then(cached => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  // 靜態資源 → cache-first，背景更新快取
  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const net = fetch(event.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
  }
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING received');
    self.skipWaiting();
  }
});
