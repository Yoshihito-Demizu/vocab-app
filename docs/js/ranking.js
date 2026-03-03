"use strict";

/**
 * ranking.js
 * - 結果画面のランキングUIのみ
 * - main.js の関数設計（loadWeekOptions/loadRankings）に合わせる
 * - $ の衝突を避ける
 */

console.log("[ranking] loaded! (safe-init + api-aligned)");

function byId2(id){ return document.getElementById(id); }

function fmtRow(i, row) {
  const name = row.nickname || row.user_id || "-";
  const pts = row.points ?? row.best_score ?? row.score ?? 0;
  const combo = row.best_combo ?? row.max_combo ?? 0;
  return `${i + 1}. ${name} — ${pts}点（COMBO ${combo}）`;
}

// ===== 週の選択肢を入れる =====
async function loadWeekOptions(){
  const weekSelect = byId2("weekSelect");
  if (!weekSelect) return;

  try{
    const now = api.getWeekIdNow();

    // MOCKなら今週だけ入れて終了（ランキングも空でOK）
    if (window.USE_MOCK) {
      weekSelect.innerHTML = "";
      const opt = document.createElement("option");
      opt.value = now;
      opt.textContent = now;
      opt.selected = true;
      weekSelect.appendChild(opt);

      const rankMsg = byId2("rankMsg");
      if (rankMsg) rankMsg.textContent = "MOCK";
      return;
    }

    const weeks = await api.fetchWeekOptions();
    const sorted = [...weeks].sort().reverse();
    const use = sorted.length ? sorted : [now];

    weekSelect.innerHTML = "";
    for (const w of use) {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      if (w === now) opt.selected = true;
      weekSelect.appendChild(opt);
    }
  } catch(e){
    console.warn("[ranking] loadWeekOptions failed:", e);
    // とりあえず今週だけ入れる
    const now = api.getWeekIdNow?.() || "";
    const weekSelect = byId2("weekSelect");
    if (weekSelect) {
      weekSelect.innerHTML = "";
      const opt = document.createElement("option");
      opt.value = now;
      opt.textContent = now || "week";
      opt.selected = true;
      weekSelect.appendChild(opt);
    }
  }
}

// ===== ランキングを描画 =====
async function loadRankings(){
  const weekSelect = byId2("weekSelect");
  const weeklyTop = byId2("weeklyTop");
  const myRank = byId2("myRank");
  const rankMsg = byId2("rankMsg");

  if (!weekSelect || !weeklyTop || !myRank || !rankMsg) return;

  weeklyTop.textContent = "loading...";
  myRank.textContent = "loading...";
  rankMsg.textContent = "loading...";

  try{
    const weekId = weekSelect.value || api.getWeekIdNow();

    if (window.USE_MOCK) {
      rankMsg.textContent = `MOCK（${weekId}）`;
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
  } catch(e){
    console.warn("[ranking] loadRankings failed:", e);
    const msg = (e && (e.message || e.details || e.code))
      ? String(e.message || e.details || e.code)
      : String(e);

    rankMsg.textContent = "取得失敗";
    weeklyTop.textContent = `（取得失敗）\n${msg}`;
    myRank.textContent = "（取得失敗）";
  }
}

// main.js から呼べるように公開
window.loadWeekOptions = loadWeekOptions;
window.loadRankings = loadRankings;

// ページ読み込みで一応初期化（main.js でも呼ばれるので二重でもOK）
document.addEventListener("DOMContentLoaded", () => {
  const tick = setInterval(async () => {
    if (!window.api) return;
    clearInterval(tick);
    await loadWeekOptions();
    await loadRankings();
  }, 50);
});
