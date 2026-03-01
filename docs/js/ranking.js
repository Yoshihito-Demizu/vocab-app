// docs/js/ranking.js
/* global api */
"use strict";

console.log("[ranking] loaded! (safe-init + api-aligned)");

function $(id) { return document.getElementById(id); }

const els = {
  pane: $("rankPane"),
  weekSelect: $("weekSelect"),
  reloadBtn: $("rankReloadBtn"),
  msg: $("rankMsg"),
  weeklyTop: $("weeklyTop"),
  myRank: $("myRank"),
};

function setMsg(text) {
  if (!els.msg) return;
  els.msg.textContent = text;
}

function renderTop(rows) {
  if (!els.weeklyTop) return;
  if (!rows || rows.length === 0) {
    els.weeklyTop.textContent = "（まだデータなし）";
    return;
  }
  const lines = rows.map((r, i) => {
    const name = r.nickname ?? r.user_id ?? "unknown";
    const pts = r.points ?? r.best_score ?? r.score ?? 0;
    return `${i + 1}. ${name} — ${pts}点`;
  });
  els.weeklyTop.textContent = lines.join("\n");
}

function renderMine(r) {
  if (!els.myRank) return;
  if (!r) { els.myRank.textContent = "（まだデータなし）"; return; }
  const name = r.nickname ?? r.user_id ?? "you";
  const pts = r.points ?? r.best_score ?? r.score ?? 0;
  const rank = r.rank ?? r.rnk ?? "?";
  els.myRank.textContent = `順位：${rank}位　スコア：${pts}点（${name}）`;
}

async function loadWeeksDefault() {
  if (!els.weekSelect) return;
  try {
    const weeks = await api.fetchWeekOptions();
    const now = api.getWeekIdNow();

    els.weekSelect.innerHTML = "";
    const list = (weeks && weeks.length ? weeks : [now]).slice(0, 40);

    for (const w of list) {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      if (w === now) opt.selected = true;
      els.weekSelect.appendChild(opt);
    }
  } catch (e) {
    console.warn("[ranking] fetchWeekOptions failed:", e);
    // 最低限：今週だけ出す
    const now = api.getWeekIdNow();
    els.weekSelect.innerHTML = `<option value="${now}">${now}</option>`;
  }
}

async function loadRankings(weekId) {
  try {
    setMsg("loading...");
    els.weeklyTop.textContent = "（取得中）";
    els.myRank.textContent = "（取得中）";

    const top = await api.fetchWeeklyTop(weekId);
    renderTop(top);

    const mine = await api.fetchMyWeeklyRank(weekId);
    renderMine(mine);

    setMsg(`OK (${weekId})`);
  } catch (e) {
    console.warn("[ranking] loadRankings failed:", e);
    setMsg(`NG (${weekId})`);
    if (els.weeklyTop) els.weeklyTop.textContent = "（取得失敗）";
    if (els.myRank) els.myRank.textContent = "（取得失敗）";
  }
}

async function initRankingUI() {
  if (!els.pane || !els.weekSelect || !els.reloadBtn) return;

  await loadWeeksDefault();

  const w = els.weekSelect.value || api.getWeekIdNow();
  await loadRankings(w);

  els.reloadBtn.addEventListener("click", async () => {
    const ww = els.weekSelect.value || api.getWeekIdNow();
    await loadRankings(ww);
  });

  els.weekSelect.addEventListener("change", async () => {
    const ww = els.weekSelect.value || api.getWeekIdNow();
    await loadRankings(ww);
  });
}

window.initRankingUI = initRankingUI;
