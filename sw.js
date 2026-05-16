const CACHE_VERSION = 'ht-v20250516-6';

self.addEventListener('install', event => {
  // 不預快取任何東西，直接接管
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

  // 跨域不攔截
  if (url.origin !== self.location.origin) return;

  // HTML 導航 → 永遠從網路取，不快取
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 圖片字型 → cache-first
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
  // 其他 → 直接網路
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
