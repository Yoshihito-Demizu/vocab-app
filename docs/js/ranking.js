"use strict";

/**
 * ranking.js
 * - 個人Top10
 * - 自分の順位
 * - クラス対抗（平均）
 * - 目標表示
 * - 進捗バー
 * - 見やすい結果画面向け
 */

console.log("[ranking] loaded! (result-refresh)");

function byId2(id) {
  return document.getElementById(id);
}

function fmtRowHtml(i, row) {
  const name = row.nickname || row.user_id || "-";
  const pts = row.points ?? row.score ?? 0;
  const combo = row.max_combo ?? 0;

  return `
    <div class="rankRow">
      <div class="rankNo">${i + 1}</div>
      <div>
        <div class="rankName">${escapeHtml(String(name))}</div>
        <div class="rankMeta">COMBO ${escapeHtml(String(combo))}</div>
      </div>
      <div class="rankScore">${escapeHtml(String(pts))}点</div>
    </div>
  `;
}

function fmtClassRowHtml(i, row) {
  const avg = row.avg_score ?? 0;
  const players = row.players ?? 0;
  const best = row.best_score ?? 0;
  return `
    <div class="classRankRow">
      <div style="font-weight:1000; margin-bottom:2px;">${i + 1}. ${escapeHtml(String(row.class_code || "-"))}</div>
      <div style="color:var(--muted); font-size:13px;">
        平均${escapeHtml(String(avg))}点 / ${escapeHtml(String(players))}人 / 最高${escapeHtml(String(best))}点
      </div>
    </div>
  `;
}

function makeBar(current, target) {
  const ratio = Math.max(0, Math.min(1, current / target));
  const width = Math.round(ratio * 100);
  return `
    <div style="margin:6px 0 4px;">
      <div style="height:10px; background:rgba(255,255,255,.10); border-radius:999px; overflow:hidden;">
        <div style="height:100%; width:${width}%; background:rgba(255,255,255,.78);"></div>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

    const top = await api.fetchWeeklyTop(weekId);
    if (weeklyTop) {
      weeklyTop.innerHTML = top.length
        ? top.map((r, i) => fmtRowHtml(i, r)).join("")
        : `<div class="msg">（まだデータなし）</div>`;
    }

    const mine = await api.fetchMyWeeklyRank(weekId);
    if (myRank) {
      if (mine) {
        myRank.innerHTML = `
          <div class="youRankBig">${escapeHtml(String(mine.rank ?? "-"))}位</div>
          <div class="youScore">${escapeHtml(String(mine.points ?? 0))}点</div>
        `;
      } else {
        myRank.innerHTML = `<div class="msg">（まだデータなし）</div>`;
      }
    }

    let classRows = [];
    if (typeof api.fetchClassWeeklyRanking === "function") {
      classRows = await api.fetchClassWeeklyRanking(weekId, 20);
    }

    if (classRank) {
      classRank.innerHTML = classRows.length
        ? classRows.map((r, i) => fmtClassRowHtml(i, r)).join("")
        : `<div class="msg">（まだデータなし）</div>`;
    }

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

          <div style="background:#3b2a1a; padding:10px 12px; border-radius:14px; margin-bottom:8px; border:1px solid rgba(255,255,255,.08);">
            <div style="font-weight:900;">🥉 銅まで ${bronzeRemain}</div>
            ${makeBar(avg, bronzeTarget)}
          </div>

          <div style="background:#2f2f38; padding:10px 12px; border-radius:14px; margin-bottom:8px; border:1px solid rgba(255,255,255,.08);">
            <div style="font-weight:900;">🥈 銀まで ${silverRemain}</div>
            ${makeBar(avg, silverTarget)}
          </div>

          <div style="background:#3b3412; padding:10px 12px; border-radius:14px; border:1px solid rgba(255,255,255,.08);">
            <div style="font-weight:900;">🥇 金まで ${goldRemain}</div>
            ${makeBar(avg, goldTarget)}
          </div>
        `;
      } else {
        classGoal.innerHTML = `<div class="msg">平均30点で銅 / 50点で銀 / 70点で金</div>`;
      }
    }

    if (rankMsg) {
      rankMsg.textContent = `OK（${weekId}）`;
    }
  } catch (e) {
    console.warn("[ranking] loadRankings failed:", e);

    if (rankMsg) rankMsg.textContent = "ランキング取得に失敗";
    if (weeklyTop) weeklyTop.innerHTML = `<div class="msg">（まだデータなし）</div>`;
    if (myRank) myRank.innerHTML = `<div class="msg">（まだデータなし）</div>`;
    if (classRank) classRank.innerHTML = `<div class="msg">（まだデータなし）</div>`;
    if (classGoal) classGoal.innerHTML = `<div class="msg">平均30点で銅 / 50点で銀 / 70点で金</div>`;
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
