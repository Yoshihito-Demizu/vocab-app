"use strict";

/**
 * ranking.js
 * - 個人Top5
 * - 自分の順位
 * - クラス対抗（平均）
 * - メダル装飾強化版
 */

console.log("[ranking] loaded! (medal-style)");

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
  return `${i + 1}`;
}

function scoreLabel(points) {
  const p = Number(points) || 0;
  if (p >= 300) return "LEGEND";
  if (p >= 240) return "EXCELLENT";
  if (p >= 180) return "GREAT";
  if (p >= 120) return "GOOD";
  return "TRY";
}

function getClassStage(avg) {
  const n = Number(avg) || 0;

  if (n >= 300) {
    return {
      key: "gold",
      icon: "🥇",
      label: "金ランク",
      bg: "linear-gradient(135deg, rgba(255,215,0,.24), rgba(255,170,0,.08))",
      border: "rgba(255,215,0,.35)",
      glow: "0 0 24px rgba(255,215,0,.15)"
    };
  }

  if (n >= 240) {
    return {
      key: "silver",
      icon: "🥈",
      label: "銀ランク",
      bg: "linear-gradient(135deg, rgba(220,220,235,.20), rgba(160,170,200,.08))",
      border: "rgba(220,220,235,.28)",
      glow: "0 0 22px rgba(220,220,235,.10)"
    };
  }

  if (n >= 180) {
    return {
      key: "bronze",
      icon: "🥉",
      label: "銅ランク",
      bg: "linear-gradient(135deg, rgba(205,127,50,.22), rgba(140,90,40,.08))",
      border: "rgba(205,127,50,.30)",
      glow: "0 0 20px rgba(205,127,50,.10)"
    };
  }

  return {
    key: "normal",
    icon: "🎯",
    label: "挑戦中",
    bg: "linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.03))",
    border: "rgba(255,255,255,.10)",
    glow: "0 0 0 rgba(0,0,0,0)"
  };
}

function getNextGoal(avg) {
  const n = Number(avg) || 0;

  if (n < 180) {
    return {
      icon: "🥉",
      label: "銅ランク",
      remain: (180 - n).toFixed(1),
      desc: "まずは銅ランクを目指そう"
    };
  }

  if (n < 240) {
    return {
      icon: "🥈",
      label: "銀ランク",
      remain: (240 - n).toFixed(1),
      desc: "ここから銀ランクへ"
    };
  }

  if (n < 300) {
    return {
      icon: "🥇",
      label: "金ランク",
      remain: (300 - n).toFixed(1),
      desc: "あと少しで金ランク"
    };
  }

  return {
    icon: "👑",
    label: "金ランク到達",
    remain: "0.0",
    desc: "最高ランク達成中"
  };
}

function fmtTopRowHtml(i, row) {
  const name = row.nickname || row.player_id || row.user_id || "-";
  const pts = Number(row.points ?? row.score ?? 0);
  const combo = Number(row.max_combo ?? 0);
  const badge = rankBadge(i);

  const bg =
    i === 0 ? "linear-gradient(90deg, rgba(255,215,0,.20), rgba(255,215,0,.06))" :
    i === 1 ? "linear-gradient(90deg, rgba(220,220,235,.16), rgba(220,220,235,.05))" :
    i === 2 ? "linear-gradient(90deg, rgba(205,127,50,.18), rgba(205,127,50,.05))" :
    "rgba(255,255,255,.04)";

  const border =
    i === 0 ? "rgba(255,215,0,.30)" :
    i === 1 ? "rgba(220,220,235,.24)" :
    i === 2 ? "rgba(205,127,50,.24)" :
    "rgba(255,255,255,.07)";

  return `
    <div style="
      display:grid;
      grid-template-columns:36px 1fr auto;
      gap:10px;
      align-items:center;
      padding:9px 10px;
      border-radius:12px;
      background:${bg};
      border:1px solid ${border};
      margin-bottom:6px;
      box-shadow:0 8px 18px rgba(0,0,0,.12);
    ">
      <div style="
        font-weight:1000;
        font-size:15px;
        text-align:center;
        color:#fff;
      ">${badge}</div>

      <div style="min-width:0;">
        <div style="
          font-weight:1000;
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
        ">
          COMBO ${escapeHtml(String(combo))} ・ ${escapeHtml(scoreLabel(pts))}
        </div>
      </div>

      <div style="text-align:right;">
        <div style="
          font-weight:1000;
          font-size:16px;
          line-height:1;
        ">${escapeHtml(String(pts))}点</div>
      </div>
    </div>
  `;
}

function fmtClassRowHtml(i, row) {
  const avg = Number(row.avg_score ?? 0);
  const players = Number(row.players ?? 0);
  const best = Number(row.best_score ?? 0);
  const badge = rankBadge(i);

  return `
    <div style="
      padding:8px 10px;
      border-radius:10px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.06);
      margin-bottom:5px;
    ">
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:8px;
        margin-bottom:3px;
      ">
        <div style="font-weight:1000; font-size:12px;">
          ${badge} ${escapeHtml(String(row.class_code || "-"))}
        </div>
        <div style="font-size:12px; font-weight:1000;">
          平均${escapeHtml(avg.toFixed(1))}点
        </div>
      </div>
      <div style="
        color:rgba(234,240,255,.65);
        font-size:10px;
        font-weight:700;
      ">
        ${escapeHtml(String(players))}人 / 最高${escapeHtml(String(best))}点
      </div>
    </div>
  `;
}

function renderClassGoal(row) {
  const avg = Number(row.avg_score ?? 0);
  const players = Number(row.players ?? 0);
  const best = Number(row.best_score ?? 0);

  const stage = getClassStage(avg);
  const next = getNextGoal(avg);

  return `
    <div style="
      background:${stage.bg};
      border:1px solid ${stage.border};
      border-radius:14px;
      padding:12px;
      margin-bottom:8px;
      box-shadow:${stage.glow};
    ">
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        margin-bottom:10px;
      ">
        <div style="
          display:flex;
          align-items:center;
          gap:8px;
          font-weight:1000;
          font-size:15px;
        ">
          <span style="font-size:20px;">${stage.icon}</span>
          <span>${stage.label}</span>
        </div>

        <div style="
          font-size:22px;
          font-weight:1000;
          line-height:1;
        ">
          ${escapeHtml(avg.toFixed(1))}点
        </div>
      </div>

      <div style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
        margin-bottom:8px;
      ">
        <div style="
          background:rgba(255,255,255,.06);
          border:1px solid rgba(255,255,255,.08);
          border-radius:12px;
          padding:9px;
        ">
          <div style="font-size:10px; color:rgba(234,240,255,.66); font-weight:800;">現在の状態</div>
          <div style="font-size:16px; font-weight:1000; margin-top:3px;">
            ${stage.icon} ${stage.label}
          </div>
        </div>

        <div style="
          background:rgba(255,255,255,.06);
          border:1px solid rgba(255,255,255,.08);
          border-radius:12px;
          padding:9px;
        ">
          <div style="font-size:10px; color:rgba(234,240,255,.66); font-weight:800;">次の目標</div>
          <div style="font-size:15px; font-weight:1000; margin-top:3px;">
            ${next.icon} ${next.label}
          </div>
          <div style="font-size:11px; color:rgba(234,240,255,.75); font-weight:800; margin-top:2px;">
            ${next.remain === "0.0" ? next.desc : `あと ${next.remain}点`}
          </div>
        </div>
      </div>

      <div style="
        background:rgba(255,255,255,.05);
        border:1px solid rgba(255,255,255,.08);
        border-radius:12px;
        padding:9px;
        margin-bottom:8px;
      ">
        <div style="font-size:11px; color:rgba(234,240,255,.68); font-weight:800; margin-bottom:4px;">
          ランク目安
        </div>
        <div style="
          display:flex;
          justify-content:space-between;
          gap:8px;
          font-size:11px;
          font-weight:900;
        ">
          <span>🥉 180</span>
          <span>🥈 240</span>
          <span>🥇 300</span>
        </div>
      </div>

      <div style="
        display:flex;
        justify-content:space-between;
        gap:10px;
        font-size:11px;
        color:rgba(234,240,255,.76);
        font-weight:800;
      ">
        <span>参加 ${escapeHtml(String(players))}人</span>
        <span>最高 ${escapeHtml(String(best))}点</span>
      </div>
    </div>
  `;
}

function renderMyCard(mine, topRows) {
  if (!mine) {
    return `<div class="msg">（まだデータなし）</div>`;
  }

  const myRank = Number(mine.rank ?? 0);
  const myPoints = Number(mine.points ?? 0);

  let nextGapHtml = "";
  if (Array.isArray(topRows) && myRank >= 2 && topRows[myRank - 2]) {
    const above = Number(topRows[myRank - 2].points ?? 0);
    const gap = Math.max(0, above - myPoints);
    nextGapHtml = `
      <div style="
        margin-top:8px;
        font-size:11px;
        color:rgba(234,240,255,.68);
        font-weight:800;
      ">
        ひとつ上まで あと ${escapeHtml(String(gap))}点
      </div>
    `;
  }

  const title =
    myRank === 1 ? "🏆 今週のトップ" :
    myRank <= 3 ? "🔥 上位ランクイン" :
    myRank <= 5 ? "✨ TOP5入り" :
    "📘 まだまだ挑戦";

  return `
    <div style="font-size:12px; color:rgba(234,240,255,.62); font-weight:800;">${title}</div>
    <div style="font-size:30px; font-weight:1000; line-height:1; margin:6px 0 6px;">${escapeHtml(String(myRank))}位</div>
    <div style="font-size:18px; font-weight:1000;">${escapeHtml(String(myPoints))}点</div>
    ${nextGapHtml}
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
    const topRows = Array.isArray(top) ? top.slice(0, 5) : [];

    if (weeklyTop) {
      weeklyTop.innerHTML = topRows.length
        ? topRows.map((r, i) => fmtTopRowHtml(i, r)).join("")
        : `<div class="msg">（まだデータなし）</div>`;
    }

    const mine = await api.fetchMyWeeklyRank(weekId);
    if (myRank) {
      myRank.innerHTML = renderMyCard(mine, topRows);
    }

    let classRows = [];
    if (typeof api.fetchClassWeeklyRanking === "function") {
      classRows = await api.fetchClassWeeklyRanking(weekId, 20);
    }

    if (classGoal) {
      classGoal.innerHTML = classRows.length
        ? renderClassGoal(classRows[0])
        : `<div class="msg">（まだデータなし）</div>`;
    }

    if (classRank) {
      classRank.innerHTML = classRows.length
        ? classRows.slice(0, 5).map((r, i) => fmtClassRowHtml(i, r)).join("")
        : `<div class="msg">（まだデータなし）</div>`;
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
    if (classGoal) classGoal.innerHTML = `<div class="msg">（まだデータなし）</div>`;
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
