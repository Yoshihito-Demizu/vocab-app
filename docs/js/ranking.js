"use strict";

function byId2(id) {
  return document.getElementById(id);
}

function escapeHtml(s) {
  return String(s ?? "")
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

function scoreLabel(points) {
  const p = Number(points) || 0;
  if (p >= 300) return "LEGEND";
  if (p >= 240) return "EXCELLENT";
  if (p >= 180) return "GREAT";
  return "TRY";
}

function setRankMsg(text) {
  const el = byId2("rankMsg");
  if (el) el.textContent = text || "";
}

function getSelectedWeek() {
  const sel = byId2("weekSelect");
  const now = window.api?.getWeekIdNow?.() || "";
  if (!sel) return now;
  return sel.value || now;
}

function fmtTopRowHtml(i, row) {
  const name = row?.nickname || row?.player_id || "-";
  const pts = Number(row?.points ?? row?.score ?? 0);
  const combo = Number(row?.max_combo ?? 0);
  const is1 = i === 0;

  return `
    <div style="
      display:grid;
      grid-template-columns:${is1 ? "100px" : "80px"} 1fr auto;
      align-items:center;
      padding:${is1 ? "26px" : "20px"};
      border-radius:18px;
      margin-bottom:14px;
      background:${is1 ? "linear-gradient(90deg,rgba(255,215,0,.25),rgba(255,215,0,.08))" : "rgba(255,255,255,.07)"};
      animation:pop .3s ease;
    ">
      <div style="
        font-size:${is1 ? "64px" : "48px"};
        font-weight:1000;
        text-align:center;
      ">
        ${rankIcon(i)}
      </div>

      <div>
        <div style="
          font-size:${is1 ? "46px" : "36px"};
          font-weight:1000;
          line-height:1.1;
          word-break:break-word;
        ">
          ${escapeHtml(name)}
        </div>

        <div style="
          font-size:${is1 ? "22px" : "18px"};
          opacity:.8;
          margin-top:6px;
        ">
          COMBO ${combo} ・ ${scoreLabel(pts)}
        </div>
      </div>

      <div style="
        font-size:${is1 ? "56px" : "44px"};
        font-weight:1000;
        background:linear-gradient(180deg,#fff,#ffd54a);
        -webkit-background-clip:text;
        color:transparent;
        text-shadow:0 0 18px rgba(255,215,0,.4);
        white-space:nowrap;
      ">
        ${pts}点
      </div>
    </div>
  `;
}

function fmtClassRowHtml(i, row) {
  const avg = Number(row?.avg_score ?? 0);
  const classCode = row?.class_code || "-";

  return `
    <div style="
      padding:18px;
      border-radius:16px;
      margin-bottom:12px;
      background:rgba(255,255,255,.06);
      animation:pop .3s ease;
    ">
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
      ">
        <div style="
          font-size:32px;
          font-weight:1000;
          word-break:break-word;
        ">
          ${rankIcon(i)} ${escapeHtml(classCode)}
        </div>

        <div style="
          font-size:36px;
          font-weight:1000;
          background:linear-gradient(180deg,#fff,#9ecbff);
          -webkit-background-clip:text;
          color:transparent;
          white-space:nowrap;
        ">
          ${avg.toFixed(1)}点
        </div>
      </div>
    </div>
  `;
}

function renderMyCard(mine) {
  if (!mine || !Number.isFinite(Number(mine.rank))) {
    return `
      <div style="
        padding:20px;
        border-radius:18px;
        background:rgba(255,255,255,.05);
        text-align:center;
      ">
        <div style="font-size:20px;font-weight:900;opacity:.9;">まだ順位がありません</div>
        <div style="font-size:14px;opacity:.7;margin-top:8px;">1回プレイすると表示されます</div>
      </div>
    `;
  }

  const rank = Number(mine.rank);
  const points = Number(mine.points ?? mine.score ?? 0);

  return `
    <div style="
      padding:20px;
      border-radius:18px;
      background:linear-gradient(135deg,rgba(255,215,0,.25),rgba(255,255,255,.05));
      text-align:center;
      animation:pop .3s ease;
      min-height:220px;
      display:flex;
      flex-direction:column;
      justify-content:center;
      align-items:center;
    ">
      <div style="font-size:48px;font-weight:1000;">
        ${rank}位
      </div>

      <div style="
        font-size:36px;
        font-weight:1000;
        margin-top:10px;
        color:#ffd54a;
        text-shadow:0 0 12px rgba(255,215,0,.5);
      ">
        ${points}点
      </div>
    </div>
  `;
}

function renderClassGoal(klass) {
  const el = byId2("classGoal");
  if (!el) return;

  if (!Array.isArray(klass) || klass.length === 0) {
    el.textContent = "クラスデータはまだありません";
    return;
  }

  const top = klass[0];
  const classCode = top?.class_code || "-";
  const avg = Number(top?.avg_score ?? 0);
  el.textContent = `現在1位：${classCode}（平均 ${avg.toFixed(1)}点）`;
}

function fillWeekSelect(weeks, selectedWeek) {
  const sel = byId2("weekSelect");
  if (!sel) return;

  const safeWeeks = Array.isArray(weeks) && weeks.length ? weeks : [selectedWeek];
  const uniq = [...new Set(safeWeeks.filter(Boolean))];

  sel.innerHTML = uniq
    .map((w) => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`)
    .join("");

  sel.value = uniq.includes(selectedWeek) ? selectedWeek : uniq[0] || "";
}

async function loadWeekOptions() {
  const currentWeek = window.api?.getWeekIdNow?.() || "";
  const weeks = [];

  try {
    if (typeof window.api?.fetchWeekOptions === "function") {
      const res = await window.api.fetchWeekOptions();
      if (Array.isArray(res)) {
        for (const w of res) weeks.push(String(w));
      }
    } else if (typeof window.api?.getWeekOptions === "function") {
      const res = await window.api.getWeekOptions();
      if (Array.isArray(res)) {
        for (const w of res) weeks.push(String(w));
      }
    }
  } catch (e) {
    console.warn("[ranking] loadWeekOptions fallback:", e);
  }

  if (currentWeek) weeks.unshift(currentWeek);
  fillWeekSelect(weeks, currentWeek);

  if (weeks.length <= 1) {
    setRankMsg(currentWeek ? `${currentWeek} を表示中` : "今週を表示中");
  }
}

async function loadRankings() {
  const weeklyTopEl = byId2("weeklyTop");
  const myRankEl = byId2("myRank");
  const classRankEl = byId2("classRank");

  const week = getSelectedWeek();

  try {
    setRankMsg("ランキング読み込み中...");

    if (weeklyTopEl) weeklyTopEl.innerHTML = "読み込み中...";
    if (myRankEl) myRankEl.innerHTML = "読み込み中...";
    if (classRankEl) classRankEl.innerHTML = "読み込み中...";

    const topPromise =
      typeof window.api?.fetchWeeklyTop === "function"
        ? window.api.fetchWeeklyTop(week)
        : Promise.resolve([]);

    const minePromise =
      typeof window.api?.fetchMyWeeklyRank === "function"
        ? window.api.fetchMyWeeklyRank(week)
        : Promise.resolve(null);

    const classPromise =
      typeof window.api?.fetchClassWeeklyRanking === "function"
        ? window.api.fetchClassWeeklyRanking(week, 10)
        : Promise.resolve([]);

    const [top, mine, klass] = await Promise.all([
      topPromise,
      minePromise,
      classPromise
    ]);

    const topRows = Array.isArray(top) ? top.slice(0, 10) : [];
    const classRows = Array.isArray(klass) ? klass.slice(0, 10) : [];

    if (weeklyTopEl) {
      weeklyTopEl.innerHTML = topRows.length
        ? topRows.map((row, i) => fmtTopRowHtml(i, row)).join("")
        : "（まだデータなし）";
    }

    if (myRankEl) {
      myRankEl.innerHTML = renderMyCard(mine);
    }

    if (classRankEl) {
      classRankEl.innerHTML = classRows.length
        ? classRows.map((row, i) => fmtClassRowHtml(i, row)).join("")
        : "（まだデータなし）";
    }

    renderClassGoal(classRows);
    setRankMsg(week ? `${week} のランキング` : "ランキング表示中");
  } catch (e) {
    console.warn("[ranking] loadRankings failed:", e);

    if (weeklyTopEl) weeklyTopEl.innerHTML = "（取得失敗）";
    if (myRankEl) myRankEl.innerHTML = "（取得失敗）";
    if (classRankEl) classRankEl.innerHTML = "（取得失敗）";

    const classGoal = byId2("classGoal");
    if (classGoal) classGoal.textContent = "クラスランキング取得に失敗しました";

    setRankMsg("ランキング取得に失敗");
  }
}

if (!document.getElementById("ranking-pop-style")) {
  const style = document.createElement("style");
  style.id = "ranking-pop-style";
  style.textContent = `
    @keyframes pop{
      0%{transform:scale(.95);opacity:.6;}
      100%{transform:scale(1);opacity:1;}
    }
  `;
  document.head.appendChild(style);
}

window.loadWeekOptions = loadWeekOptions;
window.loadRankings = loadRankings;

document.addEventListener("DOMContentLoaded", () => {
  const timer = setInterval(async () => {
    if (!window.api) return;
    clearInterval(timer);

    await loadWeekOptions();
    await loadRankings();
  }, 50);
});
