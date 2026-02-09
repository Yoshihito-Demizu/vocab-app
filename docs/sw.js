// docs/sw.js
"use strict";

// ✅ 更新のたびにここだけ変える
const VERSION = "20260209-1";
const CACHE_NAME = `vocab-ta-${VERSION}`;

// キャッシュしたい最低限（?v=なしの素のパスだけでOK）
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
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .catch(() => null)
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

  const accept = req.headers.get("accept") || "";
  const isHTML = req.mode === "navigate" || accept.includes("text/html");

  // ✅ HTMLはネット優先（更新反映）
  if (isHTML) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone()).catch(() => null);
        return fresh;
      } catch (e) {
        return (await caches.match(req)) || (await caches.match("./index.html"));
      }
    })());
    return;
  }

  // ✅ JS/CSS/CSV は「ネット優先」にして更新ズレを潰す
  const isAsset =
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".csv") ||
    url.pathname.endsWith(".webmanifest");

  if (isAsset) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone()).catch(() => null);
        return fresh;
      } catch (e) {
        return (await caches.match(req)) || fetch(req);
      }
    })());
    return;
  }

  // 画像などはキャッシュ優先
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    const fresh = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, fresh.clone()).catch(() => null);
    return fresh;
  })());
});
