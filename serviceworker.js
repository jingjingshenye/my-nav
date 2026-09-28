// 观澜 Service Worker：静态资源缓存优先（?v= 版本化 URL 天然免陈旧），导航网络优先
const CACHE = 'guanlan-v1';
const PRECACHE = ['./', 'index.html', 'css/style.css?v=20260930g', 'js/app.js?v=20260930g', 'js/grid-manager.js?v=20260930g', 'js/idb.js?v=20260930g', 'js/data/directory.js?v=20260930g', 'js/domain/data.js?v=20260930g', 'js/domain/pages.js?v=20260930g', 'js/adapters.js?v=20260930g', 'js/i18n.js?v=20260930g', 'assets/logo.svg', 'assets/wallpaper.svg'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // 第三方（图源/CDN）不接管
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
      return r;
    }))
  );
});
