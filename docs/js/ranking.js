"use strict";

/**
 * ranking.js
 * - 個人Top10
 * - 自分の順位
 * - クラス対抗（平均）
 * - 目標表示
 * - Plain text風の進捗表示（説明つき・コンパクト版）
 * - Top3メダルつき
 */

console.log("[ranking] loaded! (game-like-ranking)");

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

function fmtRowHtml(i, row) {
  const name = row.nickname || row.user_id || "-";
  const pts = row.points ?? row.score ?? 0;
  const combo = row.max_combo ?? 0;
  const badge = rankBadge(i);
  const glow =
    i === 0 ? "rgba(255,215,0,.16)" :
    i === 1 ? "rgba(220,220,235,.12)" :
    i === 2 ? "rgba(205,127,50,.14)" :
    "rgba(255,255,255,.04)";

  return `
    <div style="
      display:grid;
      grid-template-columns:36px 1fr auto;
      gap:8px;
      align-items:center;
      padding:8px 10px;
      border-radius:12px;
      background:${glow};
      border:1px solid rgba(255,255,255,.08);
      margin-bottom:6px;
      box-shadow:0 8px 18px rgba(0,0,0,.14);
    ">
      <div style="
        font-weight:1000;
        font-size:15px;
        text-align:center;
        color:#fff;
      ">${badge}</div>

      <div style="min-width:0;">
        <div style="
          font-weight:900;
          font-size:13px;
          line-height:1.1;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        ">${escapeHtml(String(name))}</div>
        <div style="
          color:rgba(234,240,255,.62);
          font-size:10px;
          font-weight:800;
          margin-top:2px;
          letter-spacing:.02em;
        ">COMBO ${escapeHtml(String(combo))} ・ ${escapeHtml(scoreLabel(pts))}</div>
      </div>

      <div style="
        text-align:right;
        white-space:nowrap;
      ">
        <div style="
          font-weight:1000;
          font-size:15px;
          line-height:1;
        ">${escapeHtml(String(pts))}点</div>
      </div>
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
      padding:8px 10px;
      border-radius:12px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.07);
      margin-bottom:6px;
      line-height:1.2;
    ">
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:8px;
        margin-bottom:2px;
      ">
        <div style="font-weight:1000; font-size:13px;">
          ${badge} ${escapeHtml(String(row.class_code || "-"))}
        </div>
        <div style="
          font-size:11px;
          color:rgba(234,240,255,.65);
          font-weight:800;
        ">平均${escapeHtml(String(avg))}点</div>
      </div>
      <div style="
        color:rgba(234,240,255,.68);
        font-size:11px;
        font-weight:700;
      ">
        ${escapeHtml(String(players))}人 / 最高${escapeHtml(String(best))}点
      </div>
    </div>
  `;
}

function makePlainBar(current, target, width = 12) {
  const ratio = Math.max(0, Math.min(1, current / target));
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return `${"█".repeat(filled)}${"░".repeat(empty)}`;
}

function makeGoalLine(icon, label, current, target) {
  const remain = Math.max(0, target - current).toFixed(1);
  const bar = makePlainBar(current, target, 12);

  return `
    <div style="
      display:grid;
      grid-template-columns:20px 28px 72px 1fr;
      gap:8px;
      align-items:center;
      font-size:12px;
      line-height:1.1;
      margin-bottom:6px;
    ">
      <div>${icon}</div>
      <div style="font-weight:900;">${label}</div>
      <div style="
        color:rgba(234,240,255,.88);
        font-weight:900;
        white-space:nowrap;
      ">あと ${remain}</div>
      <div style="
        font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
        letter-spacing:.04em;
        white-space:nowrap;
        color:rgba(255,255,255,.92);
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
        const rank = Number(mine.rank) || 0;
        const title =
          rank === 1 ? "🏆 今週のトップ" :
          rank <= 3 ? "🔥 上位ランクイン" :
          rank <= 10 ? "✨ TOP10入り" :
          "📘 まだまだ挑戦";

        myRank.innerHTML = `
          <div style="font-size:12px; color:rgba(234,240,255,.62); font-weight:800;">${title}</div>
          <div style="font-size:28px; font-weight:1000; line-height:1; margin:4px 0 6px;">${escapeHtml(String(mine.rank ?? "-"))}位</div>
          <div style="font-size:16px; font-weight:900;">${escapeHtml(String(mine.points ?? 0))}点</div>
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
            background:rgba(255,255,255,.04);
            border:1px solid rgba(255,255,255,.06);
            border-radius:10px;
            padding:9px 10px;
            margin-bottom:8px;
          ">
            <div style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              gap:8px;
              margin-bottom:8px;
            ">
              <div style="font-size:13px; font-weight:1000;">今週の目標</div>
              <div style="font-size:11px; color:rgba(234,240,255,.64); font-weight:800;">
                クラス平均 ${escapeHtml(avg.toFixed(1))}点
              </div>
            </div>

            <div style="
              font-size:11px;
              color:rgba(234,240,255,.62);
              font-weight:800;
              margin-bottom:8px;
            ">
              目標点に対して、今どこまで近づいたかを表しています
            </div>

            ${makeGoalLine("🥉", "銅", avg, 30)}
            ${makeGoalLine("🥈", "銀", avg, 50)}
            ${makeGoalLine("🥇", "金", avg, 70)}
          </div>
        `;
      } else {
        classGoal.innerHTML = `
          <div class="msg" style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">
現在のクラス平均に対する進み具合
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
現在のクラス平均に対する進み具合
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
