// docs/js/main.js
console.log("[main] loaded!");

function $(id) { return document.getElementById(id); }

function safeCall(fnName) {
  const fn = window[fnName];
  if (typeof fn === "function") return fn();
  console.warn("[main] missing fn:", fnName);
}

document.addEventListener("DOMContentLoaded", async () => {
  $("startBtn")?.addEventListener("click", () => window.startGame?.());
  $("retryBtn")?.addEventListener("click", () => window.startGame?.());
  $("stopBtn")?.addEventListener("click", () => window.endGame?.());

  $("goRankBtn")?.addEventListener("click", async () => {
    $("rankingPane")?.scrollIntoView({ behavior: "smooth" });
    await safeCall("loadRankings"); // ★複数形
  });

  $("rankRefreshBtn")?.addEventListener("click", async () => {
    await safeCall("loadRankings");
  });

  $("weekSelect")?.addEventListener("change", async () => {
    await safeCall("loadRankings");
  });

  // 初期に週リストを作っておく
  await safeCall("loadWeekOptions");
  await safeCall("loadRankings");
});
