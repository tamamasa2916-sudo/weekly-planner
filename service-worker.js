/* ══ 週間スケジュール表 Service Worker ══ */
const CACHE_NAME = 'schedule-pwa-v2';
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
      // 各URLを個別にfetch→put。失敗（Googleフォント等）はスキップ。
      // Promise.allに正しくPromise[]を渡す
      var promises = ASSETS.map(function(url) {
        return fetch(url).then(function(res) {
          if (res && res.ok) return cache.put(url, res);
        }).catch(function() { /* オフライン時・CORS失敗はスキップ */ });
      });
      return Promise.all(promises);
    }).then(function() { return self.skipWaiting(); })
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
