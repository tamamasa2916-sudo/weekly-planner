/* ═══════════════════════════════════════════════════════════
   週間スケジュール表 — Service Worker  v2.1
   ─ キャッシュ優先（Cache First）戦略
   ─ オフライン完全対応
   ─ iOS 12 対応（Promise.allSettled ポリフィル）
═══════════════════════════════════════════════════════════ */
'use strict';

const CACHE_VERSION = 'schedule-v2';
const CACHE_STATIC  = CACHE_VERSION + '-static';

/* iOS 12 以下向け Promise.allSettled ポリフィル */
if (typeof Promise.allSettled === 'undefined') {
  Promise.allSettled = function(promises) {
    return Promise.all(promises.map(function(p) {
      return Promise.resolve(p).then(
        function(v) { return { status: 'fulfilled', value: v }; },
        function(e) { return { status: 'rejected',  reason: e }; }
      );
    }));
  };
}

/* キャッシュするファイル */
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-192-maskable.png',
  './icon-512.png',
  './icon-512-maskable.png',
];

const FONT_ORIGIN = 'https://fonts.googleapis.com';
const FONT_STATIC = 'https://fonts.gstatic.com';

/* ── install：静的アセットを事前キャッシュ ── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(function(cache) {
        return Promise.allSettled(
          STATIC_ASSETS.map(function(url) {
            return cache.add(url).catch(function() { /* 失敗しても続行 */ });
          })
        );
      })
      .then(function() {
        return self.skipWaiting();
      })
  );
});

/* ── activate：古いキャッシュを削除 ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(
          keys
            .filter(function(k) { return k !== CACHE_STATIC; })
            .map(function(k) { return caches.delete(k); })
        );
      })
      .then(function() {
        return self.clients.claim();
      })
  );
});

/* ── fetch：リクエスト戦略の振り分け ── */
self.addEventListener('fetch', function(event) {
  var req = event.request;
  var url = new URL(req.url);

  if (req.method !== 'GET') return;

  /* Google Fonts CSS → ネットワーク優先 */
  if (url.origin === FONT_ORIGIN) {
    event.respondWith(networkFirstWithCache(req));
    return;
  }

  /* Fonts static（woff2 等）→ キャッシュ優先 */
  if (url.origin === FONT_STATIC) {
    event.respondWith(cacheFirstWithNetwork(req));
    return;
  }

  /* 同一オリジン → キャッシュ優先 */
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstWithNetwork(req));
    return;
  }
});

/* キャッシュ優先 */
function cacheFirstWithNetwork(req) {
  return caches.match(req).then(function(cached) {
    if (cached) return cached;
    return fetchAndCache(req);
  }).catch(function() {
    return caches.match('./index.html');
  });
}

/* ネットワーク優先 */
function networkFirstWithCache(req) {
  return fetchAndCache(req).catch(function() {
    return caches.match(req).then(function(cached) {
      return cached || caches.match('./index.html');
    });
  });
}

/* ネットワークから取得してキャッシュに保存 */
function fetchAndCache(req) {
  return fetch(req).then(function(response) {
    if (!response || response.status !== 200 || response.type === 'error') {
      return response;
    }
    var clone = response.clone();
    caches.open(CACHE_STATIC).then(function(cache) {
      cache.put(req, clone);
    });
    return response;
  });
}

/* ── メッセージ：キャッシュ強制更新 ── */
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
