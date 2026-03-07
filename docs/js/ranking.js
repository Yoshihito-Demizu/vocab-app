"use strict";

/**
 * ranking.js
 * - 結果画面のランキングUI
 * - 個人Top10 + 自分 + クラス対抗（平均）
 * - 目標表示つき
 * - main.js の関数設計（loadWeekOptions/loadRankings）に合わせる
 * - $ の衝突を避ける
 */

console.log("[ranking] loaded! (safe-init + api-aligned + class-average)");

function byId2(id) {
  return document.getElementById(id);
}

function fmtRow(i, row) {
  const name = row.nickname || row.user_id || "-";
  const pts = row.points ?? row.best_score ?? row.score ?? 0;
  const combo = row.best_combo ?? row.max_combo ?? 0;
  return `${i + 1}. ${name} — ${pts}点（COMBO ${combo}）`;
}

// ===== 週の選択肢を入れる =====
async function loadWeekOptions() {
  const weekSelect = byId2("weekSelect");
  if (!weekSelect) return;

  try {
    const now = api.getWeekIdNow();

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
  } catch (e) {
    console.warn("[ranking] loadWeekOptions failed:", e);

    const now = api.getWeekIdNow?.() || "";
    weekSelect.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = now;
    opt.textContent = now || "week";
    opt.selected = true;
    weekSelect.appendChild(opt);
  }
}

// ===== ランキングを描画 =====
async function loadRankings() {
  const weekSelect = byId2("weekSelect");
  const weeklyTop = byId2("weeklyTop");
  const myRank = byId2("myRank");
  const rankMsg = byId2("rankMsg");
  const classRank = byId2("classRank");
  const classGoal = byId2("classGoal");

  if (!weekSelect || !weeklyTop || !myRank || !rankMsg) return;

  weeklyTop.textContent = "loading...";
  myRank.textContent = "loading...";
  rankMsg.textContent = "loading...";
  if (classRank) classRank.textContent = "loading...";
  if (classGoal) classGoal.textContent = "今週の目標：平均30点で銅 / 50点で銀 / 70点で金";

  try {
    const weekId = weekSelect.value || api.getWeekIdNow();

    if (window.USE_MOCK) {
      rankMsg.textContent = `MOCK（${weekId}）`;
      weeklyTop.textContent = "（まだデータなし）";
      myRank.textContent = "（まだデータなし）";
      if (classRank) classRank.textContent = "（まだデータなし）";
      return;
    }

    // 個人Top10
    const top = await api.fetchWeeklyTop(weekId);
    weeklyTop.textContent = top.length
      ? top.map((r, i) => fmtRow(i, r)).join("\n")
      : "（まだデータなし）";

    // 自分の順位
    const mine = await api.fetchMyWeeklyRank(weekId);
    myRank.textContent = mine
      ? `順位：${mine.rank ?? "-"}位　スコア：${mine.points ?? 0}点`
      : "（まだデータなし）";

    // クラス対抗（平均）
    let classRows = [];
    if (classRank && typeof api.fetchClassWeeklyRanking === "function") {
      classRows = await api.fetchClassWeeklyRanking(weekId, 20);
      classRank.textContent = classRows.length
        ? classRows.map((r, i) =>
            `${i + 1}. ${r.class_code} — 平均${r.avg_score}点（${r.players}人 / 最高${r.best_score}）`
          ).join("\n")
        : "（まだデータなし）";
    }

    // 目標表示（固定文）
    if (classGoal) {
      classGoal.textContent = "今週の目標：平均30点で銅 / 50点で銀 / 70点で金";
    }

    rankMsg.textContent = `OK（${weekId}）`;
  } catch (e) {
    console.warn("[ranking] loadRankings failed:", e);

    const msg = (e && (e.message || e.details || e.code))
      ? String(e.message || e.details || e.code)
      : String(e);

    rankMsg.textContent = "ランキング取得に失敗";
    weeklyTop.textContent = "（まだデータなし）";
    myRank.textContent = "（まだデータなし）";
    if (classRank) classRank.textContent = "（まだデータなし）";
    if (classGoal) classGoal.textContent = "今週の目標：平均30点で銅 / 50点で銀 / 70点で金";
    console.warn("[ranking] detail:", msg);
  }
}

// main.js から呼べるように公開
window.loadWeekOptions = loadWeekOptions;
window.loadRankings = loadRankings;

// ページ読み込みで一応初期化
document.addEventListener("DOMContentLoaded", () => {
  const tick = setInterval(async () => {
    if (!window.api) return;
    clearInterval(tick);
    await loadWeekOptions();
    await loadRankings();
  }, 50);
});
