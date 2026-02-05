/* sw.js */
"use strict";

const CACHE_NAME = "vocab-ta-v1";

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
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    ).then(() => self.clients.claim())
  );
});

// 基本は「キャッシュ優先」：学校Wi-Fiが不安定でも起動しやすい
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          // 取れたものはキャッシュに入れる（更新にも強くなる）
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
