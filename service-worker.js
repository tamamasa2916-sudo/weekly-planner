/* ══════════════════════════════════════
   週間スケジュール表 — Service Worker
   キャッシュ戦略: Cache First（オフライン対応）
══════════════════════════════════════ */

const CACHE_NAME = 'schedule-sw-v1';

// キャッシュするリソース一覧
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
      // フォントなど外部リソースは失敗しても続行
      return Promise.allSettled(
        PRECACHE_URLS.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] キャッシュ失敗:', url, err);
          });
        })
      );
    }).then(function() {
      // 待機せず即アクティブ化
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
            .map(function(key) {
              console.log('[SW] 古いキャッシュを削除:', key);
              return caches.delete(key);
            })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── フェッチ：Cache First → Network Fallback ── */
self.addEventListener('fetch', function(event) {
  // POST / chrome-extension などはスキップ
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      // キャッシュになければネットワークから取得してキャッシュに追加
      return fetch(event.request).then(function(response) {
        // 正常なレスポンスのみキャッシュ
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, cloned);
        });
        return response;
      }).catch(function() {
        // オフライン時：index.html をフォールバック
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
