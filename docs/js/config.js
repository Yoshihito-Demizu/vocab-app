"use strict";

/**

* docs/js/config.js
* * prod / mock 切り替え
* * Supabase client 初期化
* * loginId → email 変換
    */

// ===== Supabase =====
const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";
const SUPABASE_ANON_KEY = "ここはあなたのANONKEYのまま";

// ===== mode 判定 =====
const params = new URLSearchParams(location.search);
const urlMode = (params.get("mode") || "").toLowerCase();

let MODE = urlMode || localStorage.getItem("vocab_mode") || "mock";
if (MODE !== "mock" && MODE !== "prod") MODE = "mock";

localStorage.setItem("vocab_mode", MODE);
window.USE_MOCK = (MODE === "mock");

console.log("[config] MODE =", MODE, "USE_MOCK =", window.USE_MOCK);

// ===== Supabase client =====
window.client = null;

window.clientReady = new Promise((resolve) => {

if (window.USE_MOCK) {
resolve(null);
return;
}

const s = document.createElement("script");

// ★ CDNではなくローカル読み込み
s.src = "./js/supabase.js";

s.onload = () => {
try {
console.log("[config] Supabase SDK loaded = true");

```
  window.client = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  console.log("[config] Supabase client created = true");

  resolve(window.client);

} catch (e) {

  console.warn("[config] Supabase client create failed -> fallback mock:", e);

  window.USE_MOCK = true;
  localStorage.setItem("vocab_mode", "mock");

  resolve(null);
}
```

};

s.onerror = (e) => {

```
console.warn("[config] Supabase SDK load failed -> fallback mock:", e);

window.USE_MOCK = true;
localStorage.setItem("vocab_mode", "mock");

resolve(null);
```

};

document.head.appendChild(s);

});

// ===== loginId → email 変換 =====
window.toEmail = function toEmail(loginId) {

const s = String(loginId || "")
.trim()
.toLowerCase();

const safe = s.replace(/[^a-z0-9-_]/g, "-");

return `${safe}@app.local`;
};
