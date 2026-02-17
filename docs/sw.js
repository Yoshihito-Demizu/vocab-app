// docs/sw.js
"use strict";

// ✅ 更新のたびにここだけ変える（YYYYMMDD-連番）
const VERSION = "20260217-1";
const CACHE_NAME = `vocab-ta-${VERSION}`;

// ✅ これだけキャッシュ（基本は最低限にする）
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

// ========== install ==========
self.addEventListener("install", (event) => {
  // 先にキャッシュしてから即待機解除（ただし実際に切替はクライアント側で行う）
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(ASSETS);
      await self.skipWaiting();
    })().catch(() => null)
  );
});

// ========== activate ==========
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 古いキャッシュを削除
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

// ========== メッセージ（即切替要求） ==========
self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ========== fetch ==========
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 同一オリジンだけ
  if (url.origin !== location.origin) return;

  const accept = req.headers.get("accept") || "";
  const isHTML = req.mode === "navigate" || accept.includes("text/html");

  // ✅ HTML は network-first（更新反映優先）
  if (isHTML) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: "no-store" });
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone()).catch(() => null);
          return fresh;
        } catch {
          return (await caches.match(req)) || (await caches.match("./index.html"));
        }
      })()
    );
    return;
  }

  // ✅ JS/CSS/CSV/manifest も network-first（更新ズレ防止）
  const isHotAsset =
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".csv") ||
    url.pathname.endsWith(".webmanifest");

  if (isHotAsset) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: "no-store" });
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone()).catch(() => null);
          return fresh;
        } catch {
          return (await caches.match(req)) || fetch(req);
        }
      })()
    );
    return;
  }

  // ✅ 画像などは cache-first
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, fresh.clone()).catch(() => null);
      return fresh;
    })()
  );
});
