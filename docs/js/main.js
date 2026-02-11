// docs/js/main.js
console.log("[main] loaded!");

function $(id){ return document.getElementById(id); }

// ゲーム操作
$("startBtn")?.addEventListener("click", () => window.startGame?.());
$("retryBtn")?.addEventListener("click", () => window.startGame?.());
$("stopBtn")?.addEventListener("click", () => window.endGame?.());

// ランキング操作（ボタンIDはこれで統一）
$("rankRefreshBtn")?.addEventListener("click", async () => {
  try {
    await window.loadWeekOptions?.(); // ranking.js 側にある想定
    await window.loadRankings?.();    // ranking.js 側にある想定
  } catch (e) {
    console.warn("[rank] refresh failed", e);
  }
});

// 初回に週リストだけ作る（表示の土台）
(async () => {
  try {
    await window.loadWeekOptions?.();
  } catch (e) {
    console.warn("[rank] init week options failed", e);
  }
})();
