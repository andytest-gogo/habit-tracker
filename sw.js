/* ══════════════════════════════════
   健康習慣追蹤 Pro — Service Worker
   版本：1.0.0
   ══════════════════════════════════ */

const CACHE_NAME = 'habit-pro-v1';
const OFFLINE_URL = './index.html';

// 預先快取的資源
const PRE_CACHE = [
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
];

/* ── 安裝：預先快取核心資源 ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRE_CACHE);
    }).then(() => self.skipWaiting())
  );
});

/* ── 啟動：清除舊快取 ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── 攔截請求：Network First，失敗才用快取 ── */
self.addEventListener('fetch', (event) => {
  // 只處理 GET 請求
  if (event.request.method !== 'GET') return;
  // 不快取 Cloudinary / Firebase / 外部 API
  const url = new URL(event.request.url);
  if (url.hostname.includes('cloudinary') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('unpkg') ||
      url.hostname.includes('fonts')) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // 成功就更新快取
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      })
      .catch(() => {
        // 網路失敗，從快取取
        return caches.match(event.request)
          .then(cached => cached || caches.match(OFFLINE_URL));
      })
  );
});

/* ── 推播通知：接收 Push 事件 ── */
self.addEventListener('push', (event) => {
  let data = { title: '健康習慣追蹤', body: '記得完成今日習慣！', icon: './icons/icon-192x192.png' };
  try { data = { ...data, ...event.data.json() }; } catch(e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || './icons/icon-192x192.png',
      badge: './icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || './' },
      actions: [
        { action: 'open', title: '立即查看' },
        { action: 'close', title: '稍後再說' }
      ]
    })
  );
});

/* ── 點擊通知 ── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow(event.notification.data?.url || './');
    })
  );
});
