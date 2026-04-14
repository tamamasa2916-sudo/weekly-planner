/* ══════════════════════════════════════════
   週間スケジュール表 — Service Worker
   オフライン対応・キャッシュ管理
══════════════════════════════════════════ */
'use strict';

const CACHE_NAME = 'schedule-sw-v1';

/* キャッシュ対象ファイル */
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap',
];

/* ── インストール：必須ファイルをキャッシュ ── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      /* フォントなど外部リソースは失敗しても続行 */
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(() => { /* ignore */ }))
      );
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
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── フェッチ：キャッシュ優先、なければネットワーク ── */
self.addEventListener('fetch', function(event) {
  /* POST / 外部API は素通し */
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      return fetch(event.request).then(function(response) {
        /* エラーレスポンスはキャッシュしない */
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        /* 成功したレスポンスをキャッシュに追加 */
        const clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(function() {
        /* オフライン時は index.html へフォールバック */
        return caches.match('./index.html');
      });
    })
  );
});
