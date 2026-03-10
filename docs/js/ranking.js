"use strict";

/**
 * ranking.js
 * - 個人Top10
 * - 自分の順位
 * - クラス対抗（平均）
 * - 目標表示
 * - Plain text風の進捗表示
 */

console.log("[ranking] loaded! (plain-text-style)");

function byId2(id) {
  return document.getElementById(id);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtRowHtml(i, row) {
  const name = row.nickname || row.user_id || "-";
  const pts = row.points ?? row.score ?? 0;
  const combo = row.max_combo ?? 0;

  return `
    <div style="
      display:grid;
      grid-template-columns:34px 1fr auto;
      gap:8px;
      align-items:center;
      padding:8px 10px;
      border-radius:12px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.07);
      margin-bottom:6px;
    ">
      <div style="
        font-weight:1000;
        font-size:14px;
        text-align:center;
        color:#fff;
      ">${i + 1}</div>

      <div style="min-width:0;">
        <div style="
          font-weight:900;
          font-size:13px;
          line-height:1.15;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        ">${escapeHtml(String(name))}</div>
        <div style="
          color:rgba(234,240,255,.66);
          font-size:11px;
          font-weight:700;
          margin-top:2px;
        ">COMBO ${escapeHtml(String(combo))}</div>
      </div>

      <div style="
        font-weight:1000;
        font-size:15px;
        white-space:nowrap;
      ">${escapeHtml(String(pts))}点</div>
    </div>
  `;
}

function fmtClassRowHtml(i, row) {
  const avg = row.avg_score ?? 0;
  const players = row.players ?? 0;
  const best = row.best_score ?? 0;

  return `
    <div style="
      padding:8px 10px;
      border-radius:12px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.07);
      margin-bottom:6px;
      line-height:1.25;
    ">
      <div style="font-weight:1000; font-size:13px; margin-bottom:2px;">
        ${i + 1}. ${escapeHtml(String(row.class_code || "-"))}
      </div>
      <div style="
        color:rgba(234,240,255,.70);
        font-size:12px;
        font-weight:700;
      ">
        平均${escapeHtml(String(avg))}点 / ${escapeHtml(String(players))}人 / 最高${escapeHtml(String(best))}点
      </div>
    </div>
  `;
}

function makePlainBar(current, target, width = 12) {
  const ratio = Math.max(0, Math.min(1, current / target));
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

function makeGoalLine(icon, label, current, target) {
  const remain = Math.max(0, target - current).toFixed(1);
  const bar = makePlainBar(current, target, 12);

  return `
    <div style="
      display:grid;
      grid-template-columns:28px 52px 52px 1fr;
      gap:8px;
      align-items:center;
      font-size:13px;
      font-weight:900;
      line-height:1.2;
      margin-bottom:6px;
    ">
      <div>${icon}</div>
      <div>${label}</div>
      <div style="text-align:right;">${remain}</div>
      <div style="
        font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
        letter-spacing:.02em;
        white-space:nowrap;
      ">${bar}</div>
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
          <div style="font-size:13px; color:rgba(234,240,255,.66); font-weight:800;">現在の順位</div>
          <div style="font-size:30px; font-weight:1000; line-height:1; margin:6px 0 8px;">${escapeHtml(String(mine.rank ?? "-"))}位</div>
          <div style="font-size:17px; font-weight:900;">${escapeHtml(String(mine.points ?? 0))}点</div>
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

        classGoal.innerHTML = `
          <div style="
            margin-bottom:8px;
            font-weight:1000;
            font-size:14px;
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:8px;
          ">
            <span>今週の目標</span>
            <span style="font-size:12px; color:rgba(234,240,255,.66);">平均 ${escapeHtml(avg.toFixed(1))}点</span>
          </div>

          <div style="
            background:rgba(255,255,255,.04);
            border:1px solid rgba(255,255,255,.07);
            border-radius:12px;
            padding:10px 12px;
          ">
            ${makeGoalLine("🥉", "銅", avg, 30)}
            ${makeGoalLine("🥈", "銀", avg, 50)}
            ${makeGoalLine("🥇", "金", avg, 70)}
          </div>
        `;
      } else {
        classGoal.innerHTML = `
          <div class="msg" style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">
🥉 銅  30点
🥈 銀  50点
🥇 金  70点
          </div>
        `;
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
    if (classGoal) {
      classGoal.innerHTML = `
        <div class="msg" style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">
🥉 銅  30点
🥈 銀  50点
🥇 金  70点
        </div>
      `;
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
