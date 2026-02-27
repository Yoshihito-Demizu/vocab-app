// docs/js/ranking.js
/* global api */
"use strict";

console.log("[ranking] loaded! (safe-init + api-aligned)");

function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function setHTML(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

function disable(el, v) {
  if (!el) return;
  el.disabled = !!v;
  el.style.opacity = v ? "0.6" : "1";
  el.style.pointerEvents = v ? "none" : "auto";
}

function getDefaultWeekId() {
  try { return api.getWeekIdNow(); } catch { return ""; }
}

function renderTop10(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return `<div class="msg">（まだデータなし）</div>`;
  }

  // 期待する形：{ user_id, nickname, points, correct, wrong, best_combo ... } など
  return `<ol style="margin:6px 0 0 18px; padding:0;">${
    list.slice(0, 10).map((r, i) => {
      const name = esc(r.nickname || r.user_id || `#${i + 1}`);
      const pts = Number(r.points ?? r.score ?? 0);
      const correct = r.correct != null ? `（○${r.correct}` : "";
      const wrong = r.wrong != null ? ` / ×${r.wrong}` : "";
      const suffix = (r.correct != null || r.wrong != null) ? `${correct}${wrong}）` : "";
      const combo = (r.best_combo != null) ? ` / maxC:${r.best_combo}` : "";
      return `<li style="margin:4px 0;">${name} — <b>${pts}</b>点${suffix}${combo}</li>`;
    }).join("")
  }</ol>`;
}

function renderMyRank(row) {
  if (!row) return `<div class="msg">（まだデータなし）</div>`;
  const rank = row.rank != null ? row.rank : "—";
  const pts = Number(row.points ?? row.score ?? 0);
  const name = esc(row.nickname || row.user_id || "you");
  const combo = (row.best_combo != null) ? ` / maxC:${row.best_combo}` : "";
  return `<div class="msg">順位：<b>${esc(rank)}</b>位　${name}　スコア：<b>${pts}</b>点${combo}</div>`;
}

async function loadWeeksIntoSelect(weekSelect, defaultWeek) {
  // mockでもUIは壊さずに「今週だけ」を入れておく
  let weeks = [];
  try {
    weeks = await api.fetchWeekOptions();
  } catch (e) {
    console.warn("[ranking] fetchWeekOptions failed:", e);
    weeks = [];
  }

  const nowWeek = defaultWeek || getDefaultWeekId() || "";
  if (!weeks.includes(nowWeek) && nowWeek) weeks.unshift(nowWeek);
  if (weeks.length === 0 && nowWeek) weeks = [nowWeek];

  weekSelect.innerHTML = "";
  for (const w of weeks) {
    const opt = document.createElement("option");
    opt.value = w;
    opt.textContent = w;
    weekSelect.appendChild(opt);
  }

  if (defaultWeek && weeks.includes(defaultWeek)) weekSelect.value = defaultWeek;
  else if (nowWeek) weekSelect.value = nowWeek;

  return weekSelect.value || "";
}

async function loadRankings(weekId) {
  const rankMsg = $("rankMsg");
  const weeklyTop = $("weeklyTop");
  const myRank = $("myRank");

  setText("rankMsg", "loading...");
  setText("weeklyTop", "loading...");
  setText("myRank", "loading...");

  // mockは「データなし」で良い（本番だけランキング表示の想定）
  if (api.isMock && api.isMock()) {
    setText("rankMsg", "MOCK（ランキングは本番のみ）");
    setHTML("weeklyTop", `<div class="msg">（まだデータなし）</div>`);
    setHTML("myRank", `<div class="msg">（まだデータなし）</div>`);
    return;
  }

  // prod
  try {
    const top = await api.fetchWeeklyTop(weekId);
    setHTML("weeklyTop", renderTop10(top));
  } catch (e) {
    console.warn("[ranking] fetchWeeklyTop failed:", e);
    setHTML("weeklyTop", `<div class="msg">（取得失敗）</div>`);
  }

  try {
    const me = await api.fetchMyWeeklyRank(weekId);
    setHTML("myRank", renderMyRank(me));
  } catch (e) {
    console.warn("[ranking] fetchMyWeeklyRank failed:", e);
    setHTML("myRank", `<div class="msg">（取得失敗）</div>`);
  }

  setText("rankMsg", `OK（${weekId}）`);
}

async function initRankingUI() {
  // index.html に rankPane が無い構成もあり得るので安全に抜ける
  const rankPane = $("rankPane");
  const weekSelect = $("weekSelect");
  const reloadBtn = $("rankReloadBtn");

  if (!rankPane || !weekSelect || !reloadBtn) {
    console.log("[ranking] rank UI not found -> skip init");
    return;
  }

  // apiが来るまで待つ（script順が狂っても落ちない）
  if (!window.api) {
    console.warn("[ranking] api missing at init");
    setText("rankMsg", "api missing");
    return;
  }

  // clientReady待ちはapi内でやるが、ここでも軽く待っておくと初回が安定
  try {
    if (window.clientReady && typeof window.clientReady.then === "function") {
      await window.clientReady;
    }
  } catch { /* ignore */ }

  disable(reloadBtn, true);
  disable(weekSelect, true);

  const defaultWeek = getDefaultWeekId();
  const selected = await loadWeeksIntoSelect(weekSelect, defaultWeek);

  disable(reloadBtn, false);
  disable(weekSelect, false);

  // 初回ロード
  await loadRankings(selected);

  // 週変更で自動更新
  weekSelect.addEventListener("change", async () => {
    const w = weekSelect.value;
    await loadRankings(w);
  });

  // 更新ボタン
  reloadBtn.addEventListener("click", async () => {
    const w = weekSelect.value || getDefaultWeekId();
    await loadRankings(w);
  });
}

// DOM準備後に初期化
window.addEventListener("DOMContentLoaded", () => {
  initRankingUI().catch((e) => {
    console.warn("[ranking] init failed:", e);
    setText("rankMsg", "init failed");
  });
});

// 外から呼べるようにしておく（必要なら）
window.__reloadRanking = async (weekId) => {
  const w = weekId || ($("weekSelect") ? $("weekSelect").value : getDefaultWeekId());
  await loadRankings(w);
};
