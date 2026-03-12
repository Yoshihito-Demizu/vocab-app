/* docs/sw.js */
"use strict";

/**
 * 学校運用向け：更新を最優先
 * - index.html / js/* はキャッシュしない（常にネット優先）
 * - 画像やアイコンだけキャッシュして体感を軽くする
 */

const CACHE_VERSION = "vocab-ta-2026-03-12a";
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

// 画像/アイコンなど「キャッシュしてOK」な拡張子
const CACHE_OK_EXT = [
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico",
  ".woff", ".woff2", ".ttf", ".otf"
];

self.addEventListener("install", (event) => {
  // すぐ新SWを有効化できるようにする（待機しない）
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // 古いキャッシュ掃除
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (!k.startsWith(CACHE_VERSION)) return caches.delete(k);
    }));
    await self.clients.claim();
  })());
});

// ページ側から「今すぐ切替」を指示できる
self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") self.skipWaiting();
});

function isCacheOkRequest(reqUrl) {
  const path = reqUrl.pathname.toLowerCase();
  return CACHE_OK_EXT.some(ext => path.endsWith(ext));
}

function isNoCachePath(reqUrl) {
  const path = reqUrl.pathname.toLowerCase();
  // ここをキャッシュすると “古いコード” が残って事故るので常にネット
  if (path.endsWith("/") || path.endsWith("/index.html")) return true;
  if (path.endsWith(".html")) return true;
  if (path.includes("/js/")) return true;
  if (path.endsWith(".webmanifest")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 他ドメインは触らない
  if (url.origin !== self.location.origin) return;

  // HTML / JS / manifest は「必ずネット優先（キャッシュしない）」
  if (req.mode === "navigate" || isNoCachePath(url)) {
    event.respondWith((async () => {
      try {
        // cache:'no-store' でブラウザ側キャッシュも避ける
        return await fetch(req, { cache: "no-store" });
      } catch (e) {
        // 万一オフラインなら最後にキャッシュから拾う（あれば）
        const cached = await caches.match(req);
        if (cached) return cached;
        throw e;
      }
    })());
    return;
  }

  // 画像などはキャッシュ優先（軽くする）
  if (isCacheOkRequest(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;

      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  // それ以外はネット優先（軽めに安全側）
  event.respondWith((async () => {
    try {
      return await fetch(req);
    } catch (e) {
      const cached = await caches.match(req);
      if (cached) return cached;
      throw e;
    }
  })());
});



