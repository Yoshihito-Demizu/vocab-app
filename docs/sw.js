/* sw.js - GitHub Pages向け 安定PWA */

const CACHE_VERSION = "v9"; // ←更新したら v10, v11... と上げる
const CACHE_NAME = `vocab-app-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",

  // アプリ本体
  "./js/config.js",
  "./js/api.js",
  "./js/ranking.js",
  "./js/quiz.js",
  "./js/main.js",

  // データ（使ってるなら）
  "./vocab.csv",

  // アイコン
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// インストール：事前キャッシュ
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    self.skipWaiting();
  })());
});

// 有効化：古いキャッシュ削除
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

// 取得：基本はキャッシュ優先（白画面防止）
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // ナビゲーション（ページ遷移）は index.html を返す（PWAで重要）
    if (req.mode === "navigate") {
      const cached = await cache.match("./index.html");
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        cache.put("./index.html", fresh.clone());
        return fresh;
      } catch {
        return new Response("オフラインです", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    }

    // 通常ファイル：キャッシュ→ネットの順
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      // 同一オリジンのみ保存（安全）
      if (new URL(req.url).origin === location.origin) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      return cached || new Response("", { status: 504 });
    }
  })());
});
