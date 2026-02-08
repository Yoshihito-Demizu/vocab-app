// docs/sw.js
"use strict";

// ★ 変更したら必ず増やす（これが“全員更新”のスイッチ）
const VERSION = "v2026-02-08-1";
const CACHE_NAME = `vocab-ta-${VERSION}`;

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./vocab.csv",
  "./js/config.js",
  "./js/api.js",
  "./js/ranking.js",
  "./js/quiz.js",
  "./js/main.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/start-bg.jpg",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => null)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 同一オリジンだけ
  if (url.origin !== location.origin) return;

  const accept = (req.headers.get("accept") || "");
  const isHTML = req.mode === "navigate" || accept.includes("text/html");

  // ★ HTMLはネット優先（常に最新の画面）
  if (isHTML) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone()).catch(() => null);
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        return cached || caches.match("./index.html");
      }
    })());
    return;
  }

  // ★ JS/CSS/CSVは「stale-while-revalidate」
  // （今すぐはキャッシュで速く、裏で更新して次回から最新になる）
  const isAsset =
    url.pathname.includes("/js/") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".csv") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.includes("/icons/");

  if (isAsset) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);

      const fetchPromise = fetch(req).then((fresh) => {
        cache.put(req, fresh.clone()).catch(() => null);
        return fresh;
      }).catch(() => null);

      return cached || (await fetchPromise) || cached;
    })());
    return;
  }

  // その他はキャッシュ優先
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    const fresh = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, fresh.clone()).catch(() => null);
    return fresh;
  })());
});
