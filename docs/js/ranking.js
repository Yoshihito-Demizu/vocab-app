"use strict";

/* ========= 共通 ========= */

function byId(id){ return document.getElementById(id); }

function esc(s){
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
  return i+1;
}

function fmtName(row){
  return esc(row?.nickname || row?.player_id || "-");
}

/* ========= Top10（既存） ========= */

function renderWeeklyTop(rows){
  const el = byId("weeklyTop");
  if(!el) return;

  if(!rows?.length){
    el.innerHTML = "（まだデータなし）";
    return;
  }

  el.innerHTML = rows.slice(0,10).map((r,i)=>`
    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
      <div>${rankIcon(i)} ${fmtName(r)}</div>
      <div>${Number(r.points ?? r.score ?? 0)}点</div>
    </div>
  `).join("");
}

/* ========= クラス ========= */

function renderClass(rows){
  const el = byId("classRank");
  if(!el) return;

  if(!rows?.length){
    el.innerHTML = "（まだデータなし）";
    return;
  }

  el.innerHTML = rows.slice(0,10).map((r,i)=>`
    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
      <div>${rankIcon(i)} ${esc(r.class_code)}</div>
      <div>${Number(r.score ?? 0).toFixed(1)}点</div>
    </div>
  `).join("");
}

/* ========= あなた ========= */

function renderMyCard(term, weekly, top){
  const el = byId("myRank");
  if(!el) return;

  if(!weekly){
    el.innerHTML = "（まだデータなし）";
    return;
  }

  const my = Number(weekly.points ?? weekly.score ?? 0);
  const first = Number(top?.[0]?.points ?? 0);
  const diff = Math.max(0, first - my);

  const termPoints = Number(term?.term_best_total ?? 0);
  const rank = term?.rank ?? "-";

  el.innerHTML = `
    学期ポイント：${termPoints}点<br>
    現在：${rank}位<br>
    1位まであと：${diff}点
  `;
}

/* ========= 🔥 追加：表彰 ========= */

function renderTop3(id, rows, key){
  const el = byId(id);
  if(!el) return;

  if(!rows?.length){
    el.innerHTML = "（まだデータなし）";
    return;
  }

  el.innerHTML = rows.slice(0,3).map((r,i)=>{
    const val = Number(r[key] ?? r.points ?? r.score ?? 0);
    return `
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <div>${rankIcon(i)} ${fmtName(r)}</div>
        <div>${val}</div>
      </div>
    `;
  }).join("");
}

/* ========= メイン ========= */

async function loadRankings(){
  const week = window.api.getWeekIdNow();
  const term = window.api.getCurrentTermRange();

  try{
    const [
      weeklyTop,
      myWeekly,
      classRank,
      termTop,
      effortTop,
      myTerm
    ] = await Promise.all([
      window.api.fetchWeeklyTop(week),
      window.api.fetchMyWeeklyRank(week),
      window.api.fetchClassWeeklyRanking(week,10),
      window.client.rpc("get_public_term_best_ranking", {
        p_start: term.start_at,
        p_end: term.end_at,
        p_limit: 3
      }).then(r=>r.data),

      window.client.rpc("get_public_term_effort_ranking", {
        p_start: term.start_at,
        p_end: term.end_at,
        p_limit: 3
      }).then(r=>r.data),

      window.api.fetchMyTermBestStatus(term)
    ]);

    renderWeeklyTop(weeklyTop);
    renderClass(classRank);
    renderMyCard(myTerm, myWeekly, weeklyTop);

    // 🔥 表彰
    renderTop3("weeklyTop3", weeklyTop, "points");
    renderTop3("termTop3", termTop, "term_best_total");
    renderTop3("effortTop3", effortTop, "finished_count");

  }catch(e){
    console.warn("ranking error", e);
  }
}

/* ========= 起動 ========= */

document.addEventListener("DOMContentLoaded", ()=>{
  const t = setInterval(()=>{
    if(!window.api) return;
    clearInterval(t);
    loadRankings();
  },50);
});
