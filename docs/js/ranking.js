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
  return i+1;
}

function scoreLabel(p){
  p=Number(p)||0;
  if(p>=300) return "LEGEND";
  if(p>=240) return "EXCELLENT";
  if(p>=180) return "GREAT";
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

/* ===== Top ===== */
function fmtTopRowHtml(i,row){
  const name=row?.nickname||row?.player_id||"-";
  const pts=Number(row?.points??row?.score??0);
  const combo=Number(row?.max_combo??0);
  const is1=i===0;

  return `
    <div style="
      display:grid;
      grid-template-columns:${is1?"100px":"80px"} 1fr auto;
      align-items:center;
      padding:${is1?"26px":"20px"};
      border-radius:18px;
      margin-bottom:14px;
      background:${is1?"linear-gradient(90deg,rgba(255,215,0,.25),rgba(255,215,0,.08))":"rgba(255,255,255,.07)"};
      animation:pop .3s ease;
    ">

      <div style="
        font-size:${is1?"64px":"48px"};
        font-weight:1000;
        text-align:center;
      ">
        ${rankIcon(i)}
      </div>

      <div>
        <div style="
          font-size:${is1?"46px":"36px"};
          font-weight:1000;
          line-height:1.1;
        ">
          ${escapeHtml(name)}
        </div>

        <div style="
          font-size:${is1?"22px":"18px"};
          opacity:.8;
          margin-top:6px;
        ">
          COMBO ${combo} ・ ${scoreLabel(pts)}
        </div>
      </div>

      <div style="
        font-size:${is1?"56px":"44px"};
        font-weight:1000;
        background:linear-gradient(180deg,#fff,#ffd54a);
        -webkit-background-clip:text;
        color:transparent;
        text-shadow:0 0 18px rgba(255,215,0,.4);
      ">
        ${pts}点
      </div>

    </div>
  `;
}

/* ===== クラス ===== */
function fmtClassRowHtml(i,row){
  const avg=Number(row?.avg_score??0);

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
      ">
        <div style="font-size:32px;font-weight:1000;">
          ${rankIcon(i)} ${row?.class_code||"-"}
        </div>

        <div style="
          font-size:36px;
          font-weight:1000;
          background:linear-gradient(180deg,#fff,#9ecbff);
          -webkit-background-clip:text;
          color:transparent;
        ">
          ${avg.toFixed(1)}点
        </div>
      </div>
    </div>
  `;
}

/* ===== ★ あなたカード（復活版） ===== */
function renderMyCard(mine){
  if(!mine){
    return `
      <div style="
        padding:20px;
        border-radius:18px;
        background:rgba(255,255,255,.05);
        text-align:center;
      ">
        まだ順位がありません
      </div>
    `;
  }

  return `
    <div style="
      padding:26px;
      border-radius:22px;
      background:linear-gradient(135deg,rgba(255,215,0,.35),rgba(255,255,255,.05));
      text-align:center;
      animation:pop .3s ease;
      height:100%;
      display:flex;
      flex-direction:column;
      justify-content:center;
      align-items:center;
      box-shadow:0 0 30px rgba(255,215,0,.25);
    ">

      <div style="
        font-size:64px;
        font-weight:1000;
        line-height:1;
        margin-bottom:10px;
      ">
        ${mine.rank}位
      </div>

      <div style="
        font-size:42px;
        font-weight:1000;
        color:#ffd54a;
        text-shadow:0 0 18px rgba(255,215,0,.6);
      ">
        ${mine.points}点
      </div>

    </div>
  `;
}

/* ===== 目標表示 ===== */
function renderClassGoal(klass){
  const el = byId2("classGoal");
  if(!el) return;

  if(!klass?.length){
    el.textContent="クラスデータはまだありません";
    return;
  }

  const top=klass[0];
  el.textContent=`現在1位：${top.class_code}（平均 ${Number(top.avg_score).toFixed(1)}点）`;
}

/* ===== 週セレクト ===== */
function fillWeekSelect(weeks,selected){
  const sel=byId2("weekSelect");
  if(!sel) return;

  const list=[...new Set(weeks.filter(Boolean))];

  sel.innerHTML=list.map(w=>`<option value="${w}">${w}</option>`).join("");
  sel.value=list.includes(selected)?selected:list[0];
}

async function loadWeekOptions(){
  const now=window.api?.getWeekIdNow?.()||"";
  const weeks=[now];
  fillWeekSelect(weeks,now);
}

/* ===== メイン ===== */
async function loadRankings(){
  const week=getSelectedWeek();

  try{
    setRankMsg("読み込み中...");

    const [top,mine,klass]=await Promise.all([
      window.api.fetchWeeklyTop?.(week) ?? [],
      window.api.fetchMyWeeklyRank?.(week) ?? null,
      window.api.fetchClassWeeklyRanking?.(week,10) ?? []
    ]);

    byId2("weeklyTop").innerHTML =
      top?.slice(0,10).map(fmtTopRowHtml).join("") || "（まだデータなし）";

    byId2("myRank").innerHTML = renderMyCard(mine);

    byId2("classRank").innerHTML =
      klass?.slice(0,10).map(fmtClassRowHtml).join("") || "（まだデータなし）";

    renderClassGoal(klass);
    setRankMsg(`${week} のランキング`);

  }catch(e){
    console.warn(e);
    setRankMsg("取得失敗");
  }
}

/* ===== 起動 ===== */
if(!document.getElementById("ranking-style")){
  const style=document.createElement("style");
  style.id="ranking-style";
  style.innerHTML=`
    @keyframes pop{
      0%{transform:scale(.95);opacity:.6;}
      100%{transform:scale(1);opacity:1;}
    }
  `;
  document.head.appendChild(style);
}

window.loadWeekOptions = loadWeekOptions;
window.loadRankings = loadRankings;

document.addEventListener("DOMContentLoaded",()=>{
  const t=setInterval(async()=>{
    if(!window.api)return;
    clearInterval(t);
    await loadWeekOptions();
    await loadRankings();
  },50);
});
