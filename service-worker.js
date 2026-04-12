/* ══ 週間スケジュール表 Service Worker ══ */
const CACHE_NAME = 'schedule-pwa-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap'
];

/* インストール：アセットをキャッシュ */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS.map(url => {
        // Googleフォントは失敗してもOK（オフライン時はシステムフォントで代替）
        return fetch(url).then(res => {
          if (res.ok) cache.put(url, res);
        }).catch(() => {});
      }));
    }).then(() => self.skipWaiting())
  );
});

/* アクティベート：古いキャッシュを削除 */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

/* フェッチ：キャッシュ優先、なければネットワーク */
self.addEventListener('fetch', function(e) {
  // POSTやchromeExtension等はスキップ
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(response) {
        // 成功したレスポンスをキャッシュに追加
        if (response && response.status === 200 && response.type !== 'opaque') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(function() {
        // オフライン時はindex.htmlを返す
        return caches.match('./index.html');
      });
    })
  );
});
