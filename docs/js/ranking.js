"use strict";

/**
 * ranking.js
 * - 個人Top10
 * - 自分の順位
 * - クラス対抗（平均）
 * - 目標表示
 * - 進捗バー
 */

console.log("[ranking] loaded! (class-goal + progress-bar)");

function byId2(id) {
  return document.getElementById(id);
}

function fmtRow(i, row) {
  const name = row.nickname || row.user_id || "-";
  const pts = row.points ?? row.score ?? 0;
  const combo = row.max_combo ?? 0;
  return `${i + 1}. ${name} — ${pts}点（COMBO ${combo}）`;
}

function makeBar(current, target) {
  const ratio = Math.max(0, Math.min(1, current / target));
  const width = Math.round(ratio * 100);
  return `
    <div style="margin:6px 0 10px;">
      <div style="height:10px; background:rgba(255,255,255,.10); border-radius:999px; overflow:hidden;">
        <div style="height:100%; width:${width}%; background:rgba(255,255,255,.75);"></div>
      </div>
    </div>
  `;
}

async function loadWeekOptions() {
  const weekSelect = byId2("weekSelect");
  if (!weekSelect) return;

  try {
    const now = api.getWeekIdNow();

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
  }
}

async function loadRankings() {
  const weekSelect = byId2("weekSelect");
  const weeklyTop = byId2("weeklyTop");
  const myRank = byId2("myRank");
  const rankMsg = byId2("rankMsg");
  const classRank = byId2("classRank");
  const classGoal = byId2("classGoal");

  if (!weekSelect) return;

  try {
    const weekId = weekSelect.value || api.getWeekIdNow();

    // Top10
    const top = await api.fetchWeeklyTop(weekId);
    if (weeklyTop) {
      weeklyTop.textContent = top.length
        ? top.map((r, i) => fmtRow(i, r)).join("\n")
        : "（まだデータなし）";
    }

    // 自分
    const mine = await api.fetchMyWeeklyRank(weekId);
    if (myRank) {
      myRank.textContent = mine
        ? `順位：${mine.rank ?? "-"}位　スコア：${mine.points ?? 0}点`
        : "（まだデータなし）";
    }

    // クラス対抗
    let classRows = [];
    if (typeof api.fetchClassWeeklyRanking === "function") {
      classRows = await api.fetchClassWeeklyRanking(weekId, 20);
    }

    if (classRank) {
      classRank.textContent = classRows.length
        ? classRows.map((r, i) =>
            `${i + 1}. ${r.class_code} — 平均${r.avg_score}点（${r.players}人 / 最高${r.best_score}）`
          ).join("\n")
        : "（まだデータなし）";
    }

    // 目標＋進捗バー
    if (classGoal) {
      if (classRows.length) {
        const avg = Number(classRows[0].avg_score) || 0;

        const bronzeTarget = 30;
        const silverTarget = 50;
        const goldTarget = 70;

        const bronzeRemain = Math.max(0, bronzeTarget - avg).toFixed(1);
        const silverRemain = Math.max(0, silverTarget - avg).toFixed(1);
        const goldRemain = Math.max(0, goldTarget - avg).toFixed(1);

        classGoal.innerHTML = `
          <div style="margin-bottom:8px; font-weight:900;">今週の目標</div>

          <div style="background:#3b2a1a; padding:8px 10px; border-radius:10px; margin-bottom:8px;">
            <div>🥉 銅まで ${bronzeRemain}</div>
            ${makeBar(avg, bronzeTarget)}
          </div>

          <div style="background:#2f2f38; padding:8px 10px; border-radius:10px; margin-bottom:8px;">
            <div>🥈 銀まで ${silverRemain}</div>
            ${makeBar(avg, silverTarget)}
          </div>

          <div style="background:#3b3412; padding:8px 10px; border-radius:10px;">
            <div>🥇 金まで ${goldRemain}</div>
            ${makeBar(avg, goldTarget)}
          </div>
        `;
      } else {
        classGoal.innerHTML = `
          <div style="margin-bottom:8px; font-weight:900;">今週の目標</div>
          <div class="msg">平均30点で銅 / 50点で銀 / 70点で金</div>
        `;
      }
    }

    if (rankMsg) {
      rankMsg.textContent = `OK（${weekId}）`;
    }
  } catch (e) {
    console.warn("[ranking] loadRankings failed:", e);

    if (rankMsg) rankMsg.textContent = "ランキング取得に失敗";
    if (weeklyTop) weeklyTop.textContent = "（まだデータなし）";
    if (myRank) myRank.textContent = "（まだデータなし）";
    if (classRank) classRank.textContent = "（まだデータなし）";
    if (classGoal) {
      classGoal.innerHTML = `<div class="msg">平均30点で銅 / 50点で銀 / 70点で金</div>`;
    }
  }
}

window.loadWeekOptions = loadWeekOptions;
window.loadRankings = loadRankings;

document.addEventListener("DOMContentLoaded", () => {
  const tick = setInterval(async () => {
    if (!window.api) return;
    clearInterval(tick);
    await loadWeekOptions();
    await loadRankings();
  }, 50);
});
