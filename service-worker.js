/* ══════════════════════════════════════
   週間スケジュール表 — Service Worker
   キャッシュ戦略: Cache First（オフライン対応）
══════════════════════════════════════ */
'use strict';

const CACHE_NAME = 'schedule-v1';

/* キャッシュ対象ファイル */
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap',
];

/* ── インストール: 事前キャッシュ ── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      /* フォントなど外部URLは失敗してもインストールを止めない */
      return cache.addAll(PRECACHE_URLS).catch(function() {
        return cache.addAll(['./index.html', './manifest.json']);
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* ── アクティベート: 古いキャッシュを削除 ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(key) { return key !== CACHE_NAME; })
          .map(function(key) { return caches.delete(key); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── フェッチ: Cache First → Network Fallback ── */
self.addEventListener('fetch', function(event) {
  /* POST など非GETはスキップ */
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      /* キャッシュにない場合はネットワーク取得してキャッシュに追加 */
      return fetch(event.request).then(function(response) {
        /* エラーレスポンスやopaque以外はキャッシュしない */
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, cloned);
        });
        return response;
      }).catch(function() {
        /* オフライン時はindex.htmlにフォールバック */
        return caches.match('./index.html');
      });
    })
  );
});
