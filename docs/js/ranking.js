"use strict";

/**
 * ranking.js
 * - 個人Top5
 * - 自分の順位
 * - クラス対抗（平均）
 * - 目標表示（コンパクト1ブロック）
 * - Top3メダル
 * - 縦を短くした版
 */

console.log("[ranking] loaded! (compact-final)");

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

function rankBadge(i) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return String(i + 1);
}

function scoreLabel(points) {
  const p = Number(points) || 0;
  if (p >= 100) return "SCORE BURST";
  if (p >= 70) return "GREAT";
  if (p >= 40) return "NICE";
  return "TRY";
}

function makePlainBar(current, target, width = 16) {
  const ratio = Math.max(0, Math.min(1, current / target));
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return `${"█".repeat(filled)}${"░".repeat(empty)}`;
}

function fmtRowHtml(i, row) {
  const name = row.nickname || row.user_id || "-";
  const pts = row.points ?? row.score ?? 0;
  const combo = row.max_combo ?? 0;
  const badge = rankBadge(i);

  const glow =
    i === 0 ? "rgba(255,215,0,.14)" :
    i === 1 ? "rgba(220,220,235,.10)" :
    i === 2 ? "rgba(205,127,50,.12)" :
    "rgba(255,255,255,.04)";

  return `
    <div style="
      display:grid;
      grid-template-columns:30px 1fr auto;
      gap:8px;
      align-items:center;
      padding:7px 9px;
      border-radius:10px;
      background:${glow};
      border:1px solid rgba(255,255,255,.07);
      margin-bottom:5px;
      box-shadow:0 6px 14px rgba(0,0,0,.12);
    ">
      <div style="
        font-weight:1000;
        font-size:14px;
        text-align:center;
        color:#fff;
      ">${badge}</div>

      <div style="min-width:0;">
        <div style="
          font-weight:900;
          font-size:12px;
          line-height:1.1;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        ">${escapeHtml(String(name))}</div>
        <div style="
          color:rgba(234,240,255,.60);
          font-size:10px;
          font-weight:800;
          margin-top:2px;
        ">COMBO ${escapeHtml(String(combo))} ・ ${escapeHtml(scoreLabel(pts))}</div>
      </div>

      <div style="
        font-weight:1000;
        font-size:14px;
        white-space:nowrap;
      ">${escapeHtml(String(pts))}点</div>
    </div>
  `;
}

function fmtClassRowHtml(i, row) {
  const avg = row.avg_score ?? 0;
  const players = row.players ?? 0;
  const best = row.best_score ?? 0;
  const badge = rankBadge(i);

  return `
    <div style="
      padding:7px 9px;
      border-radius:10px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.06);
      margin-bottom:5px;
      line-height:1.18;
    ">
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:8px;
        margin-bottom:2px;
      ">
        <div style="font-weight:1000; font-size:12px;">
          ${badge} ${escapeHtml(String(row.class_code || "-"))}
        </div>
        <div style="
          font-size:11px;
          color:rgba(234,240,255,.66);
          font-weight:800;
        ">平均${escapeHtml(String(avg))}点</div>
      </div>
      <div style="
        color:rgba(234,240,255,.64);
        font-size:10px;
        font-weight:700;
      ">
        ${escapeHtml(String(players))}人 / 最高${escapeHtml(String(best))}点
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

    // Top5だけ表示
    const top = await api.fetchWeeklyTop(weekId);
    if (weeklyTop) {
      const show = Array.isArray(top) ? top.slice(0, 5) : [];
      weeklyTop.innerHTML = show.length
        ? show.map((r, i) => fmtRowHtml(i, r)).join("")
        : `<div class="msg">（まだデータなし）</div>`;
    }

    // 自分
    const mine = await api.fetchMyWeeklyRank(weekId);
    if (myRank) {
      if (mine) {
        const rank = Number(mine.rank) || 0;
        const title =
          rank === 1 ? "🏆 今週のトップ" :
          rank <= 3 ? "🔥 上位ランクイン" :
          rank <= 5 ? "✨ TOP5入り" :
          "📘 まだまだ挑戦";

        myRank.innerHTML = `
          <div style="font-size:11px; color:rgba(234,240,255,.60); font-weight:800;">${title}</div>
          <div style="font-size:26px; font-weight:1000; line-height:1; margin:4px 0 5px;">${escapeHtml(String(mine.rank ?? "-"))}位</div>
          <div style="font-size:15px; font-weight:900;">${escapeHtml(String(mine.points ?? 0))}点</div>
        `;
      } else {
        myRank.innerHTML = `<div class="msg">（まだデータなし）</div>`;
      }
    }

    // クラス対抗
    let classRows = [];
    if (typeof api.fetchClassWeeklyRanking === "function") {
      classRows = await api.fetchClassWeeklyRanking(weekId, 20);
    }

    if (classRank) {
      classRank.innerHTML = classRows.length
        ? classRows.slice(0, 5).map((r, i) => fmtClassRowHtml(i, r)).join("")
        : `<div class="msg">（まだデータなし）</div>`;
    }

    // コンパクト目標表示
    if (classGoal) {
      if (classRows.length) {
        const avg = Number(classRows[0].avg_score) || 0;
        const bronze = Math.max(0, 30 - avg).toFixed(1);
        const silver = Math.max(0, 50 - avg).toFixed(1);
        const gold = Math.max(0, 70 - avg).toFixed(1);
        const bar = makePlainBar(avg, 70, 16);

        classGoal.innerHTML = `
          <div style="
            background:rgba(255,255,255,.04);
            border:1px solid rgba(255,255,255,.06);
            border-radius:10px;
            padding:8px 10px;
            margin-bottom:8px;
            font-size:12px;
          ">
            <div style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              gap:8px;
              margin-bottom:4px;
            ">
              <div style="font-weight:1000;">クラス平均</div>
              <div style="font-weight:1000;">${escapeHtml(avg.toFixed(1))}点</div>
            </div>

            <div style="
              font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
              letter-spacing:.05em;
              margin-bottom:5px;
              color:rgba(255,255,255,.92);
              white-space:nowrap;
            ">${bar}</div>

            <div style="
              color:rgba(234,240,255,.68);
              font-size:11px;
              line-height:1.2;
              font-weight:800;
            ">
              70点満点の進み具合 / 銅まで${bronze} / 銀まで${silver} / 金まで${gold}
            </div>
          </div>
        `;
      } else {
        classGoal.innerHTML = `
          <div class="msg" style="font-size:11px;">
            クラス平均の進み具合 / 銅30点 / 銀50点 / 金70点
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
        <div class="msg" style="font-size:11px;">
          クラス平均の進み具合 / 銅30点 / 銀50点 / 金70点
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
