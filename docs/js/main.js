// docs/js/main.js
console.log("[main] loaded! (buttons+ranking)");

function $(id) { return document.getElementById(id); }

function safe(fn) {
  try { fn && fn(); } catch (e) { console.warn(e); }
}

window.addEventListener("DOMContentLoaded", async () => {
  // START / RETRY / STOP
  $("startBtn")?.addEventListener("click", () => safe(window.startGame));
  $("retryBtn")?.addEventListener("click", () => safe(window.startGame));
  $("stopBtn")?.addEventListener("click", () => safe(window.endGame));

  // 週プルダウン作る
  if (window.loadWeekOptions) {
    await window.loadWeekOptions();
  }

  // ランキング更新ボタン
  $("rankRefreshBtn")?.addEventListener("click", () => safe(window.loadRankings));

  // 「ランキングを見る」→ ランキング欄へスクロールして更新
  $("goRankBtn")?.addEventListener("click", async () => {
    $("rankingPane")?.scrollIntoView({ behavior: "smooth", block: "start" });
    await safe(window.loadRankings);
  });
});
