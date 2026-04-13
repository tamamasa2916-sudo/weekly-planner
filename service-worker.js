/* ══════════════════════════════════════════════════
   週間スケジュール表 — Service Worker
   キャッシュ戦略: Cache First（オフライン対応）
══════════════════════════════════════════════════ */

const CACHE_NAME    = 'schedule-pwa-v1';
const FONT_CACHE    = 'schedule-fonts-v1';

/* キャッシュ対象（アプリシェル） */
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

/* Googleフォント（別キャッシュ） */
const FONT_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

/* ══ インストール：アプリシェルを事前キャッシュ ══ */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* ══ アクティベート：古いキャッシュを削除 ══ */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME && key !== FONT_CACHE;
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ══ フェッチ：Cache First 戦略 ══ */
self.addEventListener('fetch', function(event) {
  /* POST など GET 以外はスルー（最初に判定） */
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  /* Googleフォントは専用キャッシュ（Stale-While-Revalidate） */
  if (FONT_ORIGINS.some(function(origin) { return url.origin === new URL(origin).origin; })) {
    event.respondWith(handleFont(event.request));
    return;
  }

  /* アプリシェル：Cache First */
  event.respondWith(handleCacheFirst(event.request));
});

/* ── Cache First ── */
function handleCacheFirst(request) {
  return caches.match(request).then(function(cached) {
    if (cached) return cached;

    return fetch(request).then(function(response) {
      /* 有効なレスポンスのみキャッシュ */
      if (!response || response.status !== 200 || response.type === 'opaque') {
        return response;
      }
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function(cache) {
        cache.put(request, clone);
      });
      return response;
    }).catch(function() {
      /* オフライン時：index.html にフォールバック */
      return caches.match('./index.html');
    });
  });
}

/* ── フォント：Stale-While-Revalidate ── */
function handleFont(request) {
  return caches.open(FONT_CACHE).then(function(cache) {
    return cache.match(request).then(function(cached) {
      var fetchPromise = fetch(request).then(function(response) {
        /* opaque レスポンスはサイズ不明で QuotaExceeded を招くためキャッシュしない */
        if (response && response.status === 200 && response.type !== 'opaque') {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(function() { return cached; });

      /* キャッシュがあればすぐ返し、バックグラウンドで更新 */
      return cached || fetchPromise;
    });
  });
}
