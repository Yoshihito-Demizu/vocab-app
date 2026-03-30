"use strict";

console.log("[ranking] loaded! (result ranking enhanced)");

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

function rankIcon(i) {
  if (i === 0) return "👑";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return String(i + 1);
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
      icon: "🥇",
      label: "金ランク",
      bg: "linear-gradient(135deg, rgba(255,215,0,.20), rgba(255,170,0,.06))",
      border: "rgba(255,215,0,.30)"
    };
  }

  if (n >= 240) {
    return {
      icon: "🥈",
      label: "銀ランク",
      bg: "linear-gradient(135deg, rgba(220,220,235,.16), rgba(160,170,200,.06))",
      border: "rgba(220,220,235,.24)"
    };
  }

  if (n >= 180) {
    return {
      icon: "🥉",
      label: "銅ランク",
      bg: "linear-gradient(135deg, rgba(205,127,50,.18), rgba(140,90,40,.06))",
      border: "rgba(205,127,50,.24)"
    };
  }

  return {
    icon: "🎯",
    label: "挑戦中",
    bg: "linear-gradient(135deg, rgba(255,255,255,.06), rgba(255,255,255,.03))",
    border: "rgba(255,255,255,.10)"
  };
}

function getNextGoal(avg) {
  const n = Number(avg) || 0;

  if (n < 180) return { icon: "🥉", label: "銅", remain: (180 - n).toFixed(1) };
  if (n < 240) return { icon: "🥈", label: "銀", remain: (240 - n).toFixed(1) };
  if (n < 300) return { icon: "🥇", label: "金", remain: (300 - n).toFixed(1) };
  return { icon: "👑", label: "王者", remain: "0.0" };
}

function makeMiniProgress(current, target) {
  const ratio = Math.max(0, Math.min(1, current / target));
  const width = Math.round(ratio * 100);

  return `
    <div style="
      height:10px;
      background:rgba(255,255,255,.10);
      border-radius:999px;
      overflow:hidden;
      margin-top:6px;
      border:1px solid rgba(255,255,255,.05);
    ">
      <div style="
        height:100%;
        width:${width}%;
        background:linear-gradient(90deg, rgba(255,255,255,.95), rgba(190,220,255,.92));
        border-radius:999px;
        box-shadow:0 0 14px rgba(255,255,255,.20);
      "></div>
    </div>
  `;
}

function formatWeekJapanese(weekId) {
  const m = String(weekId || "").match(/^(\d{4})-W(\d{2})$/);
  if (!m) return weekId || "-";

  const year = Number(m[1]);
  const week = Number(m[2]);

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (week - 1) * 7);

  const month = monday.getUTCMonth() + 1;
  const day = monday.getUTCDate();
  const weekInMonth = Math.floor((day - 1) / 7) + 1;

  return `${month}月${weekInMonth}週`;
}

function ensureRankingFxStyle() {
  if (document.getElementById("rankingFxStyle")) return;

  const style = document.createElement("style");
  style.id = "rankingFxStyle";
  style.textContent = `
    @keyframes rankingPopIn {
      0% {
        opacity: 0;
        transform: scale(.97);
      }
      100% {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes championGlow {
      0% {
        filter: drop-shadow(0 0 0 rgba(255,215,0,.00));
      }
      100% {
        filter: drop-shadow(0 0 14px rgba(255,215,0,.28));
      }
    }

    @keyframes scoreShineGold {
      0% {
        text-shadow:
          0 0 0 rgba(255,215,0,0),
          0 0 0 rgba(255,255,255,0);
      }
      100% {
        text-shadow:
          0 0 12px rgba(255,215,0,.32),
          0 0 24px rgba(255,255,255,.12);
      }
    }

    @keyframes scoreShineBlue {
      0% {
        text-shadow:
          0 0 0 rgba(120,180,255,0),
          0 0 0 rgba(255,255,255,0);
      }
      100% {
        text-shadow:
          0 0 10px rgba(120,180,255,.26),
          0 0 18px rgba(255,255,255,.10);
      }
    }

    .ranking-pop {
      animation: rankingPopIn .30s ease both;
      transform-origin: center center;
    }

    .ranking-champion {
      animation:
        rankingPopIn .30s ease both,
        championGlow .60s ease-out both;
      transform-origin: center center;
    }

    .ranking-score-gold {
      animation: scoreShineGold .60s ease-out both;
      background: linear-gradient(180deg, #fff6bf 0%, #ffd24d 55%, #ffb400 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .ranking-score-blue {
      animation: scoreShineBlue .50s ease-out both;
      background: linear-gradient(180deg, #f2f7ff 0%, #9ec7ff 55%, #68a8ff 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
  `;
  document.head.appendChild(style);
}

function fmtTopRowHtml(i, row) {
  const name = row.nickname || row.player_id || row.user_id || "-";
  const pts = Number(row.points ?? row.score ?? 0);
  const combo = Number(row.max_combo ?? 0);
  const badge = rankIcon(i);
  const label = rankLabel(i);
  const strong = i === 0;

  let bg = "rgba(255,255,255,.05)";
  let border = "rgba(255,255,255,.08)";
  let shadow = "0 10px 24px rgba(0,0,0,.12)";
  let accent = "rgba(234,240,255,.70)";
  let scoreClass = "ranking-score-blue";
  let wrapClass = "ranking-pop";
  let rankFont = "34px";
  let nameFont = "26px";
  let labelFont = "13px";
  let metaFont = "13px";
  let scoreFont = "34px";
  let padding = "16px 18px";
  let minHeight = "96px";
  let gridCols = "56px 1fr auto";

  if (i === 0) {
    bg = "linear-gradient(90deg, rgba(255,215,0,.24), rgba(255,215,0,.10), rgba(255,255,255,.03))";
    border = "rgba(255,215,0,.34)";
    shadow = "0 0 24px rgba(255,215,0,.10), 0 16px 32px rgba(0,0,0,.16)";
    accent = "rgba(255,236,170,.96)";
    scoreClass = "ranking-score-gold";
    wrapClass = "ranking-champion";
    rankFont = "48px";
    nameFont = "34px";
    labelFont = "16px";
    metaFont = "16px";
    scoreFont = "48px";
    padding = "24px 24px";
    minHeight = "148px";
    gridCols = "74px 1fr auto";
  } else if (i === 1) {
    bg = "linear-gradient(90deg, rgba(220,220,235,.16), rgba(220,220,235,.05))";
    border = "rgba(220,220,235,.22)";
  } else if (i === 2) {
    bg = "linear-gradient(90deg, rgba(205,127,50,.16), rgba(205,127,50,.05))";
    border = "rgba(205,127,50,.22)";
  }

  return `
    <div class="${wrapClass}" style="
      display:grid;
      grid-template-columns:${gridCols};
      gap:14px;
      align-items:center;
      padding:${padding};
      border-radius:18px;
      background:${bg};
      border:1px solid ${border};
      margin-bottom:12px;
      box-shadow:${shadow};
      position:relative;
      overflow:hidden;
      min-height:${minHeight};
    ">
      ${strong ? `
        <div style="
          position:absolute;
          top:0;
          right:0;
          width:140px;
          height:100%;
          background:linear-gradient(90deg, transparent, rgba(255,255,255,.10));
          pointer-events:none;
        "></div>
      ` : ""}

      <div style="
        font-weight:1000;
        font-size:${rankFont};
        text-align:center;
        color:#fff;
        line-height:1;
      ">${badge}</div>

      <div style="min-width:0;">
        <div style="
          font-weight:1000;
          font-size:${nameFont};
          line-height:1.06;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        ">${escapeHtml(String(name))}</div>

        <div style="
          color:${accent};
          font-size:${labelFont};
          font-weight:900;
          margin-top:6px;
          letter-spacing:.04em;
        ">${label}</div>

        <div style="
          color:rgba(234,240,255,.72);
          font-size:${metaFont};
          font-weight:800;
          margin-top:5px;
        ">
          COMBO ${escapeHtml(String(combo))} ・ ${escapeHtml(scoreLabel(pts))}
        </div>
      </div>

      <div style="text-align:right;">
        <div class="${scoreClass}" style="
          font-weight:1000;
          font-size:${scoreFont};
          line-height:1;
          white-space:nowrap;
        ">${escapeHtml(String(pts))}点</div>
      </div>
    </div>
  `;
}

function fmtClassRowHtml(i, row) {
  const avg = Number(row.avg_score ?? 0);
  const players = Number(row.players ?? 0);
  const best = Number(row.best_score ?? 0);
  const badge = rankIcon(i);

  let tint = "rgba(255,255,255,.04)";
  let border = "rgba(255,255,255,.08)";
  let scoreClass = "ranking-score-blue";

  if (i === 0) {
    tint = "linear-gradient(90deg, rgba(255,215,0,.16), rgba(255,215,0,.05), rgba(255,255,255,.02))";
    border = "rgba(255,215,0,.26)";
    scoreClass = "ranking-score-gold";
  } else if (i === 1) {
    tint = "linear-gradient(90deg, rgba(220,220,235,.12), rgba(220,220,235,.04))";
    border = "rgba(220,220,235,.18)";
  } else if (i === 2) {
    tint = "linear-gradient(90deg, rgba(205,127,50,.12), rgba(205,127,50,.04))";
    border = "rgba(205,127,50,.18)";
  }

  return `
    <div class="ranking-pop" style="
      padding:14px 16px;
      border-radius:14px;
      background:${tint};
      border:1px solid ${border};
      margin-bottom:8px;
      box-shadow:0 8px 18px rgba(0,0,0,.10);
    ">
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        margin-bottom:4px;
      ">
        <div style="
          font-weight:1000;
          font-size:18px;
          line-height:1.15;
        ">
          ${badge} ${escapeHtml(String(row.class_code || "-"))}
        </div>
        <div class="${scoreClass}" style="
          font-size:20px;
          font-weight:1000;
          line-height:1;
          white-space:nowrap;
        ">
          平均${escapeHtml(avg.toFixed(1))}点
        </div>
      </div>

      <div style="
        color:rgba(234,240,255,.72);
        font-size:12px;
        font-weight:800;
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
    <div class="ranking-pop" style="
      background:${stage.bg};
      border:1px solid ${stage.border};
      border-radius:18px;
      padding:14px 16px;
      margin-bottom:10px;
      position:relative;
      overflow:hidden;
      box-shadow:0 12px 28px rgba(0,0,0,.12);
    ">
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        margin-bottom:12px;
      ">
        <div style="
          display:flex;
          align-items:center;
          gap:8px;
          font-weight:1000;
          font-size:22px;
        ">
          <span style="font-size:26px;">${stage.icon}</span>
          <span>${stage.label}</span>
        </div>

        <div class="ranking-score-blue" style="
          font-size:34px;
          font-weight:1000;
          line-height:1;
          white-space:nowrap;
        ">
          ${escapeHtml(avg.toFixed(1))}点
        </div>
      </div>

      <div style="
        display:grid;
        grid-template-columns:1fr 1fr 1fr;
        gap:12px;
        margin-bottom:12px;
      ">
        <div>
          <div style="font-size:14px; font-weight:900;">🥉 180</div>
          ${makeMiniProgress(avg, 180)}
        </div>
        <div>
          <div style="font-size:14px; font-weight:900;">🥈 240</div>
          ${makeMiniProgress(avg, 240)}
        </div>
        <div>
          <div style="font-size:14px; font-weight:900;">🥇 300</div>
          ${makeMiniProgress(avg, 300)}
        </div>
      </div>

      <div style="
        display:flex;
        justify-content:space-between;
        gap:10px;
        font-size:14px;
        color:rgba(234,240,255,.84);
        font-weight:800;
        margin-bottom:8px;
      ">
        <span>次: ${next.icon} ${next.label}</span>
        <span>${next.remain === "0.0" ? "達成中" : `あと ${next.remain}点`}</span>
      </div>

      <div style="
        display:flex;
        justify-content:space-between;
        gap:10px;
        font-size:13px;
        color:rgba(234,240,255,.74);
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
        font-size:13px;
        color:rgba(234,240,255,.74);
        font-weight:800;
      ">
        上まで ${escapeHtml(String(gap))}点
      </div>
    `;
  }

  let title = "挑戦中";
  let badge = "✨";
  let bg = "linear-gradient(135deg, rgba(255,255,255,.06), rgba(255,255,255,.03))";
  let border = "rgba(255,255,255,.08)";
  let scoreClass = "ranking-score-blue";

  if (myRank === 1) {
    title = "王者";
    badge = "👑";
    bg = "linear-gradient(135deg, rgba(255,215,0,.22), rgba(255,170,0,.08))";
    border = "rgba(255,215,0,.28)";
    scoreClass = "ranking-score-gold";
  } else if (myRank <= 3) {
    title = "上位";
    badge = "🔥";
    bg = "linear-gradient(135deg, rgba(255,120,80,.16), rgba(255,255,255,.03))";
  } else if (myRank <= 5) {
    title = "TOP5";
    badge = "✨";
    bg = "linear-gradient(135deg, rgba(120,180,255,.16), rgba(255,255,255,.03))";
  }

  return `
    <div class="ranking-pop" style="
      background:${bg};
      border:1px solid ${border};
      border-radius:16px;
      padding:14px 14px 12px;
      position:relative;
      overflow:hidden;
      box-shadow:0 10px 24px rgba(0,0,0,.12);
      min-height:132px;
    ">
      <div style="
        display:flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        font-size:14px;
        color:rgba(234,240,255,.82);
        font-weight:900;
        margin-bottom:8px;
      ">
        <span>${badge}</span>
        <span>${title}</span>
      </div>

      <div style="
        text-align:center;
        font-size:40px;
        font-weight:1000;
        line-height:1;
        margin:0 0 8px;
      ">
        ${escapeHtml(String(myRank))}位
      </div>

      <div class="${scoreClass}" style="
        text-align:center;
        font-size:28px;
        font-weight:1000;
        line-height:1;
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
      opt.textContent = formatWeekJapanese(w);
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
      rankMsg.textContent = `OK（${formatWeekJapanese(weekId)}）`;
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
  ensureRankingFxStyle();

  const tick = setInterval(async () => {
    if (!window.api) return;
    clearInterval(tick);
    await loadWeekOptions();
    await loadRankings();
  }, 50);
});
