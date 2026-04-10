"use strict";

function byId2(id){ return document.getElementById(id); }

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function rankIcon(i){
  if(i===0) return "👑";
  if(i===1) return "🥈";
  if(i===2) return "🥉";
  return i + 1;
}

function scoreLabel(p){
  p = Number(p) || 0;
  if(p >= 300) return "LEGEND";
  if(p >= 240) return "EXCELLENT";
  if(p >= 180) return "GREAT";
  return "TRY";
}

function setRankMsg(t){
  const el = byId2("rankMsg");
  if(el) el.textContent = t || "";
}

function getSelectedWeek(){
  const sel = byId2("weekSelect");
  const now = window.api?.getWeekIdNow?.() || "";
  if(!sel) return now;
  return sel.value || now;
}

function formatClassDisplay(code){
  if(!code) return "-";

  const m = String(code).trim().match(/^([A-Z]?)(\d+)-(\d+)$/i);
  if(!m) return String(code);

  const prefix = (m[1] || "").toUpperCase();
  const grade = m[2];
  const cls = Number(m[3]);

  if(prefix === "H"){
    const map = ["A","B","C","D","E","F"];
    return `H${grade}-${map[cls - 1] || cls}`;
  }

  return `${prefix}${grade}-${cls}`;
}

/* ===== Top10 ===== */
function fmtTopRowHtml(i, row){
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

/* ===== クラス対抗 ===== */
function fmtClassRowHtml(i, row){
  const score = Number(row?.score ?? 0);
  const avg = Number(row?.avg_score ?? 0);
  const participants = Number(row?.participants ?? row?.players ?? 0);
  const classSize = Number(row?.class_size ?? 0);
  const classCode = formatClassDisplay(row?.class_code || "-");
  const eligible = row?.eligible !== false;

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
          ${rankIcon(i)} ${escapeHtml(classCode)}${!eligible ? "（参考）" : ""}
        </div>

        <div style="
          font-size:36px;
          font-weight:1000;
          background:linear-gradient(180deg,#fff,#9ecbff);
          -webkit-background-clip:text;
          color:transparent;
          white-space:nowrap;
        ">
          ${score.toFixed(1)}点
        </div>
      </div>

      <div style="
        margin-top:8px;
        font-size:16px;
        opacity:.82;
        line-height:1.35;
      ">
        平均${avg.toFixed(1)}点 / 参加${participants}人 / ${classSize}人中
      </div>
    </div>
  `;
}

/* ===== あなたカード ===== */
function renderMyCard(mine){
  if(!mine){
    return `
      <div style="
        min-height:420px;
        border-radius:28px;
        display:flex;
        align-items:center;
        justify-content:center;
        text-align:center;
        background:
          radial-gradient(circle at 50% 20%, rgba(255,215,0,.18), transparent 35%),
          linear-gradient(135deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
        border:1px solid rgba(255,255,255,.10);
        color:rgba(255,255,255,.75);
        font-size:26px;
        font-weight:900;
      ">
        まだ順位がありません
      </div>
    `;
  }

  const rank = Number(mine.rank ?? 0);
  const points = Number(mine.points ?? mine.score ?? 0);

  return `
    <div style="
      min-height:420px;
      border-radius:28px;
      padding:24px;
      position:relative;
      overflow:hidden;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      text-align:center;
      background:
        radial-gradient(circle at 50% 18%, rgba(255,245,180,.28), transparent 26%),
        linear-gradient(135deg, rgba(255,215,0,.38), rgba(255,255,255,.04) 55%, rgba(255,215,0,.12));
      border:1px solid rgba(255,215,0,.28);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.12),
        0 0 34px rgba(255,215,0,.18),
        0 18px 45px rgba(0,0,0,.22);
      animation:pop .35s ease;
    ">
      <div style="
        position:absolute;
        inset:auto -30% 62% -30%;
        height:120px;
        background:linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent);
        transform:rotate(-8deg);
        pointer-events:none;
      "></div>

      <div style="
        font-size:18px;
        font-weight:900;
        letter-spacing:.08em;
        opacity:.92;
        margin-bottom:20px;
      ">
        YOUR RANK
      </div>

      <div style="
        font-size:90px;
        font-weight:1000;
        line-height:1;
        margin-bottom:20px;
        display:flex;
        align-items:flex-end;
        justify-content:center;
        gap:6px;
        color:#f3f6ff;
        text-shadow:
          0 0 10px rgba(255,255,255,.18),
          0 0 28px rgba(255,215,0,.18);
      ">
        <span>${rank}</span>
        <span style="font-size:48px; line-height:1;">位</span>
      </div>

      <div style="
        width:80px;
        height:3px;
        border-radius:999px;
        background:linear-gradient(90deg,transparent,#ffd54a,transparent);
        margin-bottom:24px;
      "></div>

      <div style="
        font-size:54px;
        font-weight:1000;
        line-height:1.1;
        color:#ffd54a;
        text-shadow:
          0 0 12px rgba(255,215,0,.45),
          0 0 24px rgba(255,215,0,.18);
      ">
        ${points}点
      </div>
    </div>
  `;
}

/* ===== クラス1位表示 ===== */
function renderClassGoal(klass){
  const el = byId2("classGoal");
  if(!el) return;

  if(!klass?.length){
    el.textContent = "クラスデータはまだありません";
    return;
  }

  const top = klass[0];
  const score = Number(top.score ?? 0);

  el.textContent = `現在1位：${formatClassDisplay(top.class_code)}（${score.toFixed(1)}点）`;
}

/* ===== 週セレクト ===== */
function fillWeekSelect(weeks, selected){
  const sel = byId2("weekSelect");
  if(!sel) return;

  const list = [...new Set((weeks || []).filter(Boolean))];
  sel.innerHTML = list.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join("");
  sel.value = list.includes(selected) ? selected : (list[0] || "");
}

async function loadWeekOptions(){
  const now = window.api?.getWeekIdNow?.() || "";
  const weeks = [now];
  fillWeekSelect(weeks, now);
}

/* ===== メイン ===== */
async function loadRankings(){
  const week = getSelectedWeek();

  try{
    setRankMsg("読み込み中...");

    const [top, mine, klass] = await Promise.all([
      window.api.fetchWeeklyTop?.(week) ?? [],
      window.api.fetchMyWeeklyRank?.(week) ?? null,
      window.api.fetchClassWeeklyRanking?.(week, 10) ?? []
    ]);

    const topRows = Array.isArray(top) ? top.slice(0, 10) : [];
    const classRows = Array.isArray(klass) ? klass.slice(0, 10) : [];

    byId2("weeklyTop").innerHTML =
      topRows.length
        ? topRows.map((row, i) => fmtTopRowHtml(i, row)).join("")
        : "（まだデータなし）";

    byId2("myRank").innerHTML = renderMyCard(mine);

    byId2("classRank").innerHTML =
      classRows.length
        ? classRows.map((row, i) => fmtClassRowHtml(i, row)).join("")
        : "（まだデータなし）";

    renderClassGoal(classRows);
    setRankMsg(`${week} のランキング`);
  }catch(e){
    console.warn("[ranking] loadRankings failed:", e);
    setRankMsg("取得失敗");

    if(byId2("weeklyTop")) byId2("weeklyTop").innerHTML = "（取得失敗）";
    if(byId2("myRank")) byId2("myRank").innerHTML = "（取得失敗）";
    if(byId2("classRank")) byId2("classRank").innerHTML = "（取得失敗）";
  }
}

/* ===== スタイル注入 ===== */
if(!document.getElementById("ranking-style")){
  const style = document.createElement("style");
  style.id = "ranking-style";
  style.innerHTML = `
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
  const t = setInterval(async () => {
    if(!window.api) return;
    clearInterval(t);
    await loadWeekOptions();
    await loadRankings();
  }, 50);
});
