"use strict";

/**
 * ranking.js
 * 個人ランキング + クラス対抗 + 目標表示
 */

console.log("[ranking] loaded! (class-goal)");

function byId2(id){
  return document.getElementById(id);
}

function fmtRow(i, row) {
  const name = row.nickname || row.user_id || "-";
  const pts = row.points ?? row.score ?? 0;
  const combo = row.max_combo ?? 0;
  return `${i + 1}. ${name} — ${pts}点（COMBO ${combo}）`;
}

/* 週セレクト */
async function loadWeekOptions(){
  const weekSelect = byId2("weekSelect");
  if (!weekSelect) return;

  try{
    const now = api.getWeekIdNow();

    const weeks = await api.fetchWeekOptions();
    const sorted = [...weeks].sort().reverse();
    const use = sorted.length ? sorted : [now];

    weekSelect.innerHTML = "";

    for(const w of use){
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      if(w === now) opt.selected = true;
      weekSelect.appendChild(opt);
    }

  }catch(e){
    console.warn("[ranking] loadWeekOptions failed:", e);
  }
}

/* ランキング表示 */
async function loadRankings(){

  const weekSelect = byId2("weekSelect");
  const weeklyTop = byId2("weeklyTop");
  const myRank = byId2("myRank");
  const rankMsg = byId2("rankMsg");

  const classRank = byId2("classRank");
  const classGoal = byId2("classGoal");

  if(!weekSelect) return;

  try{

    const weekId = weekSelect.value || api.getWeekIdNow();

    /* Top10 */
    const top = await api.fetchWeeklyTop(weekId);

    weeklyTop.textContent = top.length
      ? top.map((r,i)=>fmtRow(i,r)).join("\n")
      : "（まだデータなし）";

    /* 自分 */
    const mine = await api.fetchMyWeeklyRank(weekId);

    myRank.textContent = mine
      ? `順位：${mine.rank ?? "-"}位　スコア：${mine.points ?? 0}点`
      : "（まだデータなし）";

    /* クラス対抗 */
    let classRows = [];

    if(api.fetchClassWeeklyRanking){
      classRows = await api.fetchClassWeeklyRanking(weekId,20);
    }

    if(classRank){

      classRank.textContent = classRows.length
        ? classRows.map((r,i)=>
          `${i+1}. ${r.class_code} — 平均${r.avg_score}点（${r.players}人 / 最高${r.best_score}）`
        ).join("\n")
        : "（まだデータなし）";
    }

    /* ===== 目標表示 ===== */

    if(classGoal && classRows.length){

      const avg = Number(classRows[0].avg_score) || 0;

      const bronze = Math.max(0,30-avg).toFixed(1);
      const silver = Math.max(0,50-avg).toFixed(1);
      const gold = Math.max(0,70-avg).toFixed(1);

      classGoal.innerHTML = `
<div style="margin-bottom:8px;font-weight:700;">今週の目標</div>

<div style="display:flex;gap:12px;font-size:14px">

<div style="background:#3b2a1a;padding:6px 10px;border-radius:8px">
🥉 銅まで ${bronze}
</div>

<div style="background:#2f2f38;padding:6px 10px;border-radius:8px">
🥈 銀まで ${silver}
</div>

<div style="background:#3b3412;padding:6px 10px;border-radius:8px">
🥇 金まで ${gold}
</div>

</div>
`;
    }

    rankMsg.textContent = `OK（${weekId}）`;

  }catch(e){

    console.warn("[ranking] loadRankings failed:", e);

    rankMsg.textContent = "ランキング取得に失敗";

    if(weeklyTop) weeklyTop.textContent = "（まだデータなし）";
    if(myRank) myRank.textContent = "（まだデータなし）";
    if(classRank) classRank.textContent = "（まだデータなし）";
  }
}

/* main.js から呼ぶ */
window.loadWeekOptions = loadWeekOptions;
window.loadRankings = loadRankings;

/* 初期化 */
document.addEventListener("DOMContentLoaded",()=>{

  const tick = setInterval(async()=>{

    if(!window.api) return;

    clearInterval(tick);

    await loadWeekOptions();
    await loadRankings();

  },50);

});
