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
    ">
      <div style="font-size:${is1 ? "64px" : "48px"};font-weight:1000;text-align:center;">
        ${rankIcon(i)}
      </div>

      <div>
        <div style="font-size:${is1 ? "46px" : "36px"};font-weight:1000;">
          ${escapeHtml(name)}
        </div>
        <div style="font-size:${is1 ? "22px" : "18px"};opacity:.8;">
          COMBO ${combo} ・ ${scoreLabel(pts)}
        </div>
      </div>

      <div style="font-size:${is1 ? "56px" : "44px"};font-weight:1000;color:#ffd54a;">
        ${pts}点
      </div>
    </div>
  `;
}

/* ===== クラス対抗（修正版） ===== */
function fmtClassRowHtml(i, row){
  const score = Number(row?.score ?? 0);
  const avg = Number(row?.avg_score ?? 0);
  const participants = Number(row?.participants ?? 0);
  const classSize = Number(row?.class_size ?? 0);
  const classCode = row?.class_code || "-";
  const eligible = row?.eligible !== false;

  return `
    <div style="
      padding:18px;
      border-radius:16px;
      margin-bottom:12px;
      background:rgba(255,255,255,.06);
    ">
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
      ">
        <div style="font-size:32px;font-weight:1000;">
          ${rankIcon(i)} ${escapeHtml(classCode)}
          ${!eligible ? "（参考）" : ""}
        </div>

        <div style="
          font-size:36px;
          font-weight:1000;
          color:#9ecbff;
        ">
          ${score.toFixed(1)}点
        </div>
      </div>

      <div style="
        margin-top:6px;
        font-size:16px;
        opacity:.8;
      ">
        平均${avg.toFixed(1)}点 / ${participants}人 / ${classSize}人中
      </div>
    </div>
  `;
}

/* ===== あなたカード ===== */
function renderMyCard(mine){
  if(!mine){
    return `<div>まだ順位がありません</div>`;
  }

  const rank = Number(mine.rank ?? 0);
  const points = Number(mine.points ?? mine.score ?? 0);

  return `
    <div style="text-align:center;">
      <div style="font-size:20px;">YOUR RANK</div>
      <div style="font-size:72px;font-weight:1000;">${rank}位</div>
      <div style="font-size:40px;color:#ffd54a;">${points}点</div>
    </div>
  `;
}

/* ===== クラス1位表示（修正版） ===== */
function renderClassGoal(klass){
  const el = byId2("classGoal");
  if(!el) return;

  if(!klass?.length){
    el.textContent = "クラスデータはまだありません";
    return;
  }

  const top = klass[0];

  el.textContent =
    `現在1位：${top.class_code}（${Number(top.score ?? 0).toFixed(1)}点）`;
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
  }
}

window.loadRankings = loadRankings;

document.addEventListener("DOMContentLoaded", () => {
  const t = setInterval(async () => {
    if(!window.api) return;
    clearInterval(t);
    await loadRankings();
  }, 50);
});
