"use strict";

/**
 * ranking.js
 * - 結果画面のランキングUIのみ
 * - main.js の $ と衝突しないように、ここでは $$ を使う
 */

console.log("[ranking] loaded! (safe-init + api-aligned)");

// main.js と衝突しない名前にする
const $$ = (id) => document.getElementById(id);

function fmtRow(i, row) {
  const name = row.nickname || row.user_id || "-";
  const pts = row.points ?? row.best_score ?? row.score ?? 0;
  const combo = row.best_combo ?? row.max_combo ?? 0;
  return `${i + 1}. ${name} — ${pts}点（COMBO ${combo}）`;
}

async function loadRankings(selectedWeekId) {
  const weekSelect = $$("weekSelect");
  const weeklyTop = $$("weeklyTop");
  const myRank = $$("myRank");
  const rankMsg = $$("rankMsg");

  if (!weekSelect || !weeklyTop || !myRank || !rankMsg) return;

  weeklyTop.textContent = "loading...";
  myRank.textContent = "loading...";
  rankMsg.textContent = "loading...";

  try {
    const weekId = selectedWeekId || weekSelect.value || api.getWeekIdNow();

    if (window.USE_MOCK) {
      rankMsg.textContent = "MOCK（ランキングは空）";
      weeklyTop.textContent = "（まだデータなし）";
      myRank.textContent = "（まだデータなし）";
      return;
    }

    const top = await api.fetchWeeklyTop(weekId);
    weeklyTop.textContent = top.length
      ? top.map((r, i) => fmtRow(i, r)).join("\n")
      : "（まだデータなし）";

    const mine = await api.fetchMyWeeklyRank(weekId);
    myRank.textContent = mine
      ? `順位：${mine.rank ?? "-"}位　スコア：${mine.points ?? 0}点`
      : "（まだデータなし）";

    rankMsg.textContent = `OK（${weekId}）`;
  } catch (e) {
    console.warn("[ranking] loadRankings failed:", e);
    const msg = (e && (e.message || e.details || e.code))
      ? String(e.message || e.details || e.code)
      : String(e);
    $$("rankMsg").textContent = "取得失敗";
    $$("weeklyTop").textContent = `（取得失敗）\n${msg}`;
    $$("myRank").textContent = "（取得失敗）";
  }
}

async function initRankingUI() {
  const weekSelect = $$("weekSelect");
  const reloadBtn = $$("rankReloadBtn");
  if (!weekSelect || !reloadBtn) return;

  try {
    const weeks = await api.fetchWeekOptions();
    const now = api.getWeekIdNow();

    weekSelect.innerHTML = "";
    const sorted = [...weeks].sort().reverse();
    const use = sorted.length ? sorted : [now];

    for (const w of use) {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      if (w === now) opt.selected = true;
      weekSelect.appendChild(opt);
    }

    reloadBtn.addEventListener("click", () => loadRankings(weekSelect.value));
    weekSelect.addEventListener("change", () => loadRankings(weekSelect.value));

    await loadRankings(weekSelect.value || now);
  } catch (e) {
    console.warn("[ranking] init failed:", e);
    const rankMsg = $$("rankMsg");
    if (rankMsg) rankMsg.textContent = "ランキング初期化失敗";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const tick = setInterval(() => {
    if (window.api) {
      clearInterval(tick);
      initRankingUI();
    }
  }, 50);
});
