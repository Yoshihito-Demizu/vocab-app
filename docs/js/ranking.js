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

function formatStudentDisplay(value){
  if(!value) return "-";

  const s = String(value).trim();
  const m = s.match(/^([A-Z]?)(\d+)-(\d+)-(\d+)(.*)$/i);
  if(!m) return s;

  const prefix = (m[1] || "").toUpperCase();
  const grade = m[2];
  const cls = Number(m[3]);
  const number = m[4];
  const rest = m[5] || "";

  if(prefix === "H"){
    const map = ["A","B","C","D","E","F"];
    return `H${grade}-${map[cls - 1] || cls}-${number}${rest}`;
  }

  return `${prefix}${grade}-${cls}-${number}${rest}`;
}

/* ===== Top10 ===== */
function fmtTopRowHtml(i, row){
  const rawName = row?.nickname || row?.player_id || "-";
  const name = formatStudentDisplay(rawName);
  const pts = Number(row?.points ?? row?.score ?? 0);
  const combo = Number(row?.max_combo ?? 0);
  const is1 = i === 0;

  return `
    <div style="
      display:grid;
      grid-template-columns:${is1 ? "90px" : "72px"} 1fr auto;
      align-items:center;
      padding:${is1 ? "16px" : "12px"};
      border-radius:14px;
      margin-bottom:10px;
      background:${is1 ? "linear-gradient(90deg,rgba(255,215,0,.18),rgba(255,215,0,.06))" : "rgba(255,255,255,.06)"};
      animation:pop .3s ease;
      gap:10px;
    ">
      <div style="
        font-size:${is1 ? "44px" : "34px"};
        font-weight:1000;
        text-align:center;
        line-height:1;
      ">
        ${rankIcon(i)}
      </div>

      <div>
        <div style="
          font-size:${is1 ? "28px" : "22px"};
          font-weight:1000;
          line-height:1.1;
          word-break:break-word;
        ">
          ${escapeHtml(name)}
        </div>

        <div style="
          font-size:${is1 ? "15px" : "13px"};
          opacity:.8;
          margin-top:4px;
        ">
          COMBO ${combo} ・ ${scoreLabel(pts)}
        </div>
      </div>

      <div style="
        font-size:${is1 ? "34px" : "28px"};
        font-weight:1000;
        background:linear-gradient(180deg,#fff,#ffd54a);
        -webkit-background-clip:text;
        color:transparent;
        text-shadow:0 0 14px rgba(255,215,0,.35);
        white-space:nowrap;
      ">
        ${pts}点
      </div>
    </div>
  `;
}

/* ===== クラス対抗：学期・参加率込み ===== */
function fmtClassRowHtml(i, row){
  const score = Number(row?.final_score ?? row?.avg_score ?? 0);
  const avg = Number(row?.avg_score ?? 0);
  const total = Number(row?.term_total ?? 0);
  const participants = Number(row?.participants ?? 0);
  const classSize = Number(row?.class_size ?? 0);
  const rate = classSize > 0 ? Math.round((participants / classSize) * 100) : 0;
  const classCode = formatClassDisplay(row?.class_code || "-");

  return `
    <div style="
      padding:12px;
      border-radius:14px;
      margin-bottom:10px;
      background:rgba(255,255,255,.06);
      animation:pop .3s ease;
    ">
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
      ">
        <div style="
          font-size:24px;
          font-weight:1000;
          word-break:break-word;
          line-height:1.1;
        ">
          ${rankIcon(i)} ${escapeHtml(classCode)}
        </div>

        <div style="
          font-size:28px;
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
        margin-top:6px;
        font-size:13px;
        opacity:.82;
        line-height:1.35;
      ">
        平均${avg.toFixed(1)}点 / 参加${participants}人 / 参加率${rate}% / 合計${total}点
      </div>
    </div>
  `;
}

/* ===== あなたカード ===== */
function renderMyCard(termStatus, termRange, weeklyMine, weeklyTop){
  const el = byId2("myRank");
  if(!el) return;

  if(termStatus){
    const termPoints = Number(termStatus.term_best_total ?? termStatus.total_points ?? 0);
    const myPosition = Number(termStatus.rank ?? 0);
    const diffToFirst = Number(termStatus.diff_to_first ?? 0);

    el.innerHTML = `
      <div style="
        border-radius:18px;
        padding:16px;
        background:
          radial-gradient(circle at 50% 18%, rgba(255,245,180,.22), transparent 26%),
          linear-gradient(135deg, rgba(255,215,0,.18), rgba(255,255,255,.04) 55%, rgba(255,215,0,.08));
        border:1px solid rgba(255,215,0,.18);
        display:grid;
        grid-template-columns:1fr 1fr 1fr;
        gap:12px;
      ">
        <div style="border-radius:14px;padding:12px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.10);text-align:center;">
          <div style="font-size:12px; opacity:.82; margin-bottom:6px;">学期ポイント</div>
          <div style="font-size:28px; font-weight:1000; line-height:1.1;">${termPoints}点</div>
        </div>

        <div style="border-radius:14px;padding:12px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);text-align:center;">
          <div style="font-size:12px; opacity:.82; margin-bottom:6px;">現在</div>
          <div style="font-size:28px; font-weight:1000; line-height:1.1;">${myPosition}位</div>
        </div>

        <div style="border-radius:14px;padding:12px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);text-align:center;">
          <div style="font-size:12px; opacity:.82; margin-bottom:6px;">1位まであと</div>
          <div style="font-size:28px; font-weight:1000; line-height:1.1;">${diffToFirst}点</div>
        </div>
      </div>
    `;
    return;
  }

  if(weeklyMine){
    const rank = Number(weeklyMine.rank ?? 0);
    const points = Number(weeklyMine.points ?? weeklyMine.score ?? 0);
    const first = Array.isArray(weeklyTop) && weeklyTop.length
      ? Number(weeklyTop[0]?.points ?? weeklyTop[0]?.score ?? 0)
      : points;
    const diff = Math.max(0, first - points);

    el.innerHTML = `
      <div style="
        border-radius:18px;
        padding:16px;
        background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.10);
        display:grid;
        grid-template-columns:1fr 1fr 1fr;
        gap:12px;
      ">
        <div style="border-radius:14px;padding:12px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.10);text-align:center;">
          <div style="font-size:12px; opacity:.82; margin-bottom:6px;">学期ポイント</div>
          <div style="font-size:28px; font-weight:1000; line-height:1.1;">${points}点</div>
        </div>

        <div style="border-radius:14px;padding:12px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);text-align:center;">
          <div style="font-size:12px; opacity:.82; margin-bottom:6px;">現在</div>
          <div style="font-size:28px; font-weight:1000; line-height:1.1;">${rank}位</div>
        </div>

        <div style="border-radius:14px;padding:12px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);text-align:center;">
          <div style="font-size:12px; opacity:.82; margin-bottom:6px;">1位まであと</div>
          <div style="font-size:28px; font-weight:1000; line-height:1.1;">${diff}点</div>
        </div>
      </div>
    `;
    return;
  }

  el.innerHTML = "（まだデータなし）";
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
  const score = Number(top.final_score ?? top.avg_score ?? 0);

  el.textContent = `現在1位：${formatClassDisplay(top.class_code)}（${score.toFixed(1)}点）`;
}

/* ===== Top3共通 ===== */
function renderTop3List(targetId, rows, valueKey, formatter){
  const el = byId2(targetId);
  if(!el) return;

  if(!rows?.length){
    el.innerHTML = "（まだデータなし）";
    return;
  }

  el.innerHTML = rows.slice(0,3).map((r,i)=>{
    const val = Number(r?.[valueKey] ?? 0);
    return `
      <div style="
        display:flex;
        justify-content:space-between;
        gap:8px;
        align-items:center;
        padding:8px 0;
        border-bottom:${i < 2 ? "1px solid rgba(255,255,255,.08)" : "none"};
      ">
        <div style="
          font-size:14px;
          font-weight:900;
          line-height:1.2;
          min-width:0;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        ">
          ${rankIcon(i)} ${formatStudentDisplay(r?.nickname || r?.player_id || "-")}
        </div>
        <div style="
          font-size:16px;
          font-weight:1000;
          white-space:nowrap;
        ">
          ${formatter ? formatter(val) : val}
        </div>
      </div>
    `;
  }).join("");
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
  try{
    const now = window.api?.getWeekIdNow?.() || "";
    let weeks = [];

    if(typeof window.api?.fetchWeekOptions === "function"){
      weeks = await window.api.fetchWeekOptions();
    }

    if(!Array.isArray(weeks) || !weeks.length){
      weeks = [now];
    }

    fillWeekSelect(weeks, now);
  }catch(e){
    console.warn("[ranking] loadWeekOptions failed:", e);
    const now = window.api?.getWeekIdNow?.() || "";
    fillWeekSelect([now], now);
  }
}

/* ===== メイン ===== */
async function loadRankings(){
  const week = getSelectedWeek();

  try{
    setRankMsg("読み込み中...");

    const termRange = window.api?.getCurrentTermRange?.() || null;
    const client = window.client || null;

    const weeklyTopPromise = window.api.fetchWeeklyTop?.(week) ?? [];
    const myWeeklyPromise = window.api.fetchMyWeeklyRank?.(week) ?? null;

    const classRankPromise = client && termRange
      ? client.rpc("get_public_term_class_ranking", {
          p_start: termRange.start_at,
          p_end: termRange.end_at,
          p_limit: 10
        }).then(({data, error}) => {
          if(error) throw error;
          return data || [];
        })
      : Promise.resolve([]);

    const myTermPromise = window.api.fetchMyTermBestStatus?.(termRange) ?? null;
　　const termBestScorePromise = client && termRange
  ? client.rpc("get_public_term_single_best_ranking", {
      p_start: termRange.start_at,
      p_end: termRange.end_at,
      p_limit: 3
    }).then(({data, error}) => {
      if(error) throw error;
      return data || [];
    })
  : Promise.resolve([]);
    const termTopPromise = client && termRange
      ? client.rpc("get_public_term_best_ranking", {
          p_start: termRange.start_at,
          p_end: termRange.end_at,
          p_limit: 3
        }).then(({data, error}) => {
          if(error) throw error;
          return data || [];
        })
      : Promise.resolve([]);

    const effortTopPromise = client && termRange
      ? client.rpc("get_public_term_effort_ranking", {
          p_start: termRange.start_at,
          p_end: termRange.end_at,
          p_limit: 3
        }).then(({data, error}) => {
          if(error) throw error;
          return data || [];
        })
      : Promise.resolve([]);

    const [
  weeklyTop,
  myWeekly,
  classRank,
  myTerm,
  termBestScore,
  termTop,
  effortTop
] = await Promise.all([
  weeklyTopPromise,
  myWeeklyPromise,
  classRankPromise,
  myTermPromise,
  termBestScorePromise,
  termTopPromise,
  effortTopPromise
]);

    const topRows = Array.isArray(weeklyTop) ? weeklyTop.slice(0, 10) : [];
    const classRows = Array.isArray(classRank) ? classRank.slice(0, 10) : [];

    byId2("weeklyTop").innerHTML =
      topRows.length
        ? topRows.map((row, i) => fmtTopRowHtml(i, row)).join("")
        : "（まだデータなし）";

    renderMyCard(myTerm, termRange, myWeekly, topRows);

    byId2("classRank").innerHTML =
      classRows.length
        ? classRows.map((row, i) => fmtClassRowHtml(i, row)).join("")
        : "（まだデータなし）";

    renderClassGoal(classRows);

  　renderTop3List("weeklyTop3", termBestScore, "best_score", (v) => `${v}点`);
    renderTop3List("termTop3", termTop, "term_best_total", (v) => `${v}点`);
    renderTop3List("effortTop3", effortTop, "finished_count", (v) => `${v}回`);

    setRankMsg(`${termRange?.label || week} のランキング`);
  }catch(e){
    console.warn("[ranking] loadRankings failed:", e);
    setRankMsg("取得失敗");

    if(byId2("weeklyTop")) byId2("weeklyTop").innerHTML = "（取得失敗）";
    if(byId2("myRank")) byId2("myRank").innerHTML = "（取得失敗）";
    if(byId2("classRank")) byId2("classRank").innerHTML = "（取得失敗）";
    if(byId2("weeklyTop3")) byId2("weeklyTop3").innerHTML = "（取得失敗）";
    if(byId2("termTop3")) byId2("termTop3").innerHTML = "（取得失敗）";
    if(byId2("effortTop3")) byId2("effortTop3").innerHTML = "（取得失敗）";
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
