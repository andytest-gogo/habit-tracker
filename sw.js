// ── 版本號：每次部署靜態資源時才需要改 ──
// HTML 完全不快取，所以不改版本號也能拿到最新 index.html
const CACHE_VERSION = 'ht-v20250516-5';

// 只快取這些真正的靜態資源（不包含 index.html）
const STATIC_ASSETS = [
  '/manifest.json'
];

// ══ Install ══
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())  // 立刻接管，不等舊 tab 關閉
  );
});

// ══ Activate: 清除所有舊快取 ══
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ══ Fetch ══
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. 跨域（Supabase、CDN）→ 完全不攔截
  if (url.origin !== self.location.origin) return;

  // 2. HTML 導航請求 → 永遠不快取，直接從網路取
  //    這是白頁問題的根本解法：SW 不碰 HTML，就不會有壞快取
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // 只有真正離線時才 fallback 到快取
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 3. 靜態資源（圖片、字型等）→ cache-first
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

  // 4. 其他一切 → 直接網路，不快取
});

// ══ Message ══
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
