"use strict";

/**
 * ranking.js
 * - 個人Top5
 * - 自分の順位
 * - クラス対抗（平均）
 * - メダル装飾強化版
 * - 1位王冠・光演出つき
 * - コンパクト版
 */

console.log("[ranking] loaded! (royal-ranking-compact)");

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
  if (i === 0) return "👑";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return `${i + 1}`;
}

function rankLabel(i) {
  if (i === 0) return "CHAMPION";
  if (i === 1) return "2ND PLACE";
  if (i === 2) return "3RD PLACE";
  return `TOP ${i + 1}`;
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
      bg: "linear-gradient(135deg, rgba(255,215,0,.24), rgba(255,170,0,.07))",
      border: "rgba(255,215,0,.34)",
      glow: "0 0 22px rgba(255,215,0,.14)"
    };
  }

  if (n >= 240) {
    return {
      key: "silver",
      icon: "🥈",
      label: "銀ランク",
      bg: "linear-gradient(135deg, rgba(220,220,235,.20), rgba(160,170,200,.07))",
      border: "rgba(220,220,235,.26)",
      glow: "0 0 18px rgba(220,220,235,.09)"
    };
  }

  if (n >= 180) {
    return {
      key: "bronze",
      icon: "🥉",
      label: "銅ランク",
      bg: "linear-gradient(135deg, rgba(205,127,50,.22), rgba(140,90,40,.07))",
      border: "rgba(205,127,50,.28)",
      glow: "0 0 16px rgba(205,127,50,.09)"
    };
  }

  return {
    key: "normal",
    icon: "🎯",
    label: "挑戦中",
    bg: "linear-gradient(135deg, rgba(255,255,255,.07), rgba(255,255,255,.03))",
    border: "rgba(255,255,255,.10)",
    glow: "0 0 0 rgba(0,0,0,0)"
  };
}

function getNextGoal(avg) {
  const n = Number(avg) || 0;

  if (n < 180) {
    return { icon: "🥉", label: "銅ランク", remain: (180 - n).toFixed(1), desc: "まずは銅ランク" };
  }
  if (n < 240) {
    return { icon: "🥈", label: "銀ランク", remain: (240 - n).toFixed(1), desc: "次は銀ランク" };
  }
  if (n < 300) {
    return { icon: "🥇", label: "金ランク", remain: (300 - n).toFixed(1), desc: "あと少しで金" };
  }
  return { icon: "👑", label: "王者クラス", remain: "0.0", desc: "最高ランク到達中" };
}

function fmtTopRowHtml(i, row) {
  const name = row.nickname || row.player_id || row.user_id || "-";
  const pts = Number(row.points ?? row.score ?? 0);
  const combo = Number(row.max_combo ?? 0);
  const badge = rankBadge(i);
  const label = rankLabel(i);

  let bg = "rgba(255,255,255,.04)";
  let border = "rgba(255,255,255,.07)";
  let shadow = "0 6px 14px rgba(0,0,0,.10)";
  let accent = "rgba(234,240,255,.62)";

  if (i === 0) {
    bg = "linear-gradient(90deg, rgba(255,215,0,.22), rgba(255,215,0,.07), rgba(255,255,255,.02))";
    border = "rgba(255,215,0,.32)";
    shadow = "0 0 20px rgba(255,215,0,.12), 0 8px 16px rgba(0,0,0,.12)";
    accent = "rgba(255,227,130,.92)";
  } else if (i === 1) {
    bg = "linear-gradient(90deg, rgba(220,220,235,.16), rgba(220,220,235,.05))";
    border = "rgba(220,220,235,.22)";
  } else if (i === 2) {
    bg = "linear-gradient(90deg, rgba(205,127,50,.16), rgba(205,127,50,.05))";
    border = "rgba(205,127,50,.22)";
  }

  return `
    <div style="
      display:grid;
      grid-template-columns:34px 1fr auto;
      gap:8px;
      align-items:center;
      padding:8px 9px;
      border-radius:12px;
      background:${bg};
      border:1px solid ${border};
      margin-bottom:5px;
      box-shadow:${shadow};
      position:relative;
      overflow:hidden;
    ">
      ${i === 0 ? `
        <div style="
          position:absolute;
          top:0;
          right:0;
          width:70px;
          height:100%;
          background:linear-gradient(90deg, transparent, rgba(255,255,255,.07));
          pointer-events:none;
        "></div>
      ` : ""}

      <div style="
        font-weight:1000;
        font-size:15px;
        text-align:center;
        color:#fff;
        line-height:1;
      ">${badge}</div>

      <div style="min-width:0;">
        <div style="
          font-weight:1000;
          font-size:12px;
          line-height:1.05;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        ">${escapeHtml(String(name))}</div>

        <div style="
          color:${accent};
          font-size:9px;
          font-weight:900;
          margin-top:1px;
          letter-spacing:.03em;
        ">${label}</div>

        <div style="
          color:rgba(234,240,255,.58);
          font-size:9px;
          font-weight:800;
          margin-top:1px;
        ">
          COMBO ${escapeHtml(String(combo))} ・ ${escapeHtml(scoreLabel(pts))}
        </div>
      </div>

      <div style="text-align:right;">
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
  const avg = Number(row.avg_score ?? 0);
  const players = Number(row.players ?? 0);
  const best = Number(row.best_score ?? 0);
  const badge = rankBadge(i);

  const tint =
    i === 0 ? "rgba(255,215,0,.10)" :
    i === 1 ? "rgba(220,220,235,.08)" :
    i === 2 ? "rgba(205,127,50,.10)" :
    "rgba(255,255,255,.04)";

  return `
    <div style="
      padding:7px 8px;
      border-radius:10px;
      background:${tint};
      border:1px solid rgba(255,255,255,.06);
      margin-bottom:4px;
    ">
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:8px;
        margin-bottom:2px;
      ">
        <div style="font-weight:1000; font-size:11px;">
          ${badge} ${escapeHtml(String(row.class_code || "-"))}
        </div>
        <div style="font-size:11px; font-weight:1000;">
          平均${escapeHtml(avg.toFixed(1))}点
        </div>
      </div>
      <div style="
        color:rgba(234,240,255,.64);
        font-size:9px;
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
      padding:10px;
      margin-bottom:6px;
      box-shadow:${stage.glow};
      position:relative;
      overflow:hidden;
    ">
      ${stage.key === "gold" ? `
        <div style="
          position:absolute;
          top:0;
          right:0;
          width:90px;
          height:100%;
          background:linear-gradient(90deg, transparent, rgba(255,255,255,.10));
          pointer-events:none;
        "></div>
      ` : ""}

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:8px;
        margin-bottom:8px;
      ">
        <div style="
          display:flex;
          align-items:center;
          gap:6px;
          font-weight:1000;
          font-size:13px;
        ">
          <span style="font-size:18px;">${stage.icon}</span>
          <span>${stage.label}</span>
        </div>

        <div style="
          font-size:20px;
          font-weight:1000;
          line-height:1;
        ">
          ${escapeHtml(avg.toFixed(1))}点
        </div>
      </div>

      <div style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:6px;
        margin-bottom:6px;
      ">
        <div style="
          background:rgba(255,255,255,.06);
          border:1px solid rgba(255,255,255,.08);
          border-radius:10px;
          padding:7px;
        ">
          <div style="font-size:9px; color:rgba(234,240,255,.66); font-weight:800;">現在</div>
          <div style="font-size:14px; font-weight:1000; margin-top:2px;">
            ${stage.icon} ${stage.label}
          </div>
        </div>

        <div style="
          background:rgba(255,255,255,.06);
          border:1px solid rgba(255,255,255,.08);
          border-radius:10px;
          padding:7px;
        ">
          <div style="font-size:9px; color:rgba(234,240,255,.66); font-weight:800;">次の目標</div>
          <div style="font-size:13px; font-weight:1000; margin-top:2px;">
            ${next.icon} ${next.label}
          </div>
          <div style="font-size:10px; color:rgba(234,240,255,.76); font-weight:800; margin-top:1px;">
            ${next.remain === "0.0" ? next.desc : `あと ${next.remain}点`}
          </div>
        </div>
      </div>

      <div style="
        background:rgba(255,255,255,.05);
        border:1px solid rgba(255,255,255,.08);
        border-radius:10px;
        padding:8px;
        margin-bottom:6px;
      ">
        <div style="font-size:10px; color:rgba(234,240,255,.68); font-weight:900; margin-bottom:4px;">
          クラス目標
        </div>
        <div style="
          display:flex;
          justify-content:space-between;
          gap:8px;
          font-size:11px;
          font-weight:1000;
        ">
          <span>🥉 180</span>
          <span>🥈 240</span>
          <span>🥇 300</span>
        </div>
      </div>

      <div style="
        display:flex;
        justify-content:space-between;
        gap:8px;
        font-size:10px;
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
        margin-top:6px;
        font-size:10px;
        color:rgba(234,240,255,.68);
        font-weight:800;
      ">
        ひとつ上まで あと ${escapeHtml(String(gap))}点
      </div>
    `;
  }

  let title = "📘 まだまだ挑戦";
  let badge = "✨";
  let bg = "linear-gradient(135deg, rgba(255,255,255,.06), rgba(255,255,255,.03))";
  let border = "rgba(255,255,255,.08)";
  let shadow = "0 6px 14px rgba(0,0,0,.10)";

  if (myRank === 1) {
    title = "今週の王者";
    badge = "👑";
    bg = "linear-gradient(135deg, rgba(255,215,0,.22), rgba(255,170,0,.08))";
    border = "rgba(255,215,0,.30)";
    shadow = "0 0 22px rgba(255,215,0,.13), 0 8px 16px rgba(0,0,0,.12)";
  } else if (myRank <= 3) {
    title = "上位ランクイン";
    badge = "🔥";
    bg = "linear-gradient(135deg, rgba(255,120,80,.16), rgba(255,255,255,.03))";
  } else if (myRank <= 5) {
    title = "TOP5入り";
    badge = "✨";
    bg = "linear-gradient(135deg, rgba(120,180,255,.16), rgba(255,255,255,.03))";
  }

  return `
    <div style="
      background:${bg};
      border:1px solid ${border};
      border-radius:12px;
      padding:10px;
      box-shadow:${shadow};
      position:relative;
      overflow:hidden;
    ">
      ${myRank === 1 ? `
        <div style="
          position:absolute;
          top:0;
          right:0;
          width:90px;
          height:100%;
          background:linear-gradient(90deg, transparent, rgba(255,255,255,.10));
          pointer-events:none;
        "></div>
      ` : ""}

      <div style="
        display:flex;
        align-items:center;
        justify-content:center;
        gap:5px;
        font-size:12px;
        color:rgba(234,240,255,.76);
        font-weight:900;
        margin-bottom:6px;
      ">
        <span>${badge}</span>
        <span>${title}</span>
      </div>

      <div style="
        text-align:center;
        font-size:30px;
        font-weight:1000;
        line-height:1;
        margin:1px 0 6px;
      ">
        ${escapeHtml(String(myRank))}位
      </div>

      <div style="
        text-align:center;
        font-size:18px;
        font-weight:1000;
      ">
        ${escapeHtml(String(myPoints))}点
      </div>

      ${nextGapHtml}
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
