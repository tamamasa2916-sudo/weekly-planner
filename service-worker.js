/* ══════════════════════════════════════
   週間スケジュール表 — Service Worker
   キャッシュ戦略: Cache First（オフライン対応）
   ══════════════════════════════════════ */

const CACHE_NAME = 'schedule-v1';

// キャッシュ対象ファイル
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap',
];

/* ── インストール：事前キャッシュ ── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Googleフォントはopaque responseのため個別にfetch
      return cache.addAll(
        PRECACHE_URLS.filter(url => !url.startsWith('https://fonts.googleapis.com'))
      ).then(function() {
        return fetch('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap')
          .then(function(res) { return cache.put(PRECACHE_URLS[4], res); })
          .catch(function() { /* オフライン時は無視 */ });
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* ── アクティベート：古いキャッシュを削除 ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── フェッチ：Cache First ── */
self.addEventListener('fetch', function(event) {
  // POST や chrome-extension など非GETは素通し
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      // キャッシュになければネットワークから取得してキャッシュに追加
      return fetch(event.request).then(function(response) {
        // 有効なレスポンスのみキャッシュ
        if (!response || response.status !== 200) return response;

        var toCache = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, toCache);
        });
        return response;
      }).catch(function() {
        // オフライン時でキャッシュにもない場合はindex.htmlにフォールバック
        return caches.match('./index.html');
      });
    })
  );
});
