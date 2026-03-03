// docs/js/ranking.js
/* global api */
"use strict";

console.log("[ranking] loaded! (safe-init + api-only)");

function $(id) { return document.getElementById(id); }

const els = {
  weekSelect: $("weekSelect"),
  reloadBtn: $("rankReloadBtn"),
  msg: $("rankMsg"),
  weeklyTop: $("weeklyTop"),
  myRank: $("myRank"),
};

function setMsg(text) {
  if (els.msg) els.msg.textContent = text;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTop10(rows) {
  if (!els.weeklyTop) return;
  if (!rows || rows.length === 0) {
    els.weeklyTop.textContent = "（まだデータなし）";
    return;
  }

  const lines = rows.slice(0, 10).map((r, i) => {
    const name = escapeHtml(r.nickname ?? r.user_id ?? "");
    const pts = Number(r.points ?? r.best_score ?? r.score ?? 0);
    const combo = Number(r.best_combo ?? r.max_combo ?? 0);
    return `${i + 1}. ${name} — ${pts}点（COMBO:${combo}）`;
  });

  els.weeklyTop.textContent = lines.join("\n");
  els.weeklyTop.style.whiteSpace = "pre-line";
}

function renderMe(row) {
  if (!els.myRank) return;
  if (!row) {
    els.myRank.textContent = "（まだデータなし）";
    return;
  }
  const rank = row.rank ?? row.rnk ?? "—";
  const pts = Number(row.points ?? row.best_score ?? row.score ?? 0);
  const combo = Number(row.best_combo ?? row.max_combo ?? 0);
  els.myRank.textContent = `順位：${rank}位　スコア：${pts}点（COMBO:${combo}）`;
}

async function getWeekOptionsSafe() {
  // api.jsに関数があるならそれを使う（MOCK/PRODもそこで吸収）
  if (api && typeof api.fetchWeekOptions === "function") {
    return await api.fetchWeekOptions();
  }

  // ない場合：今週だけ入れておく
  if (api && typeof api.getWeekIdNow === "function") {
    return [api.getWeekIdNow()];
  }
  return [];
}

async function loadRankings(weekId) {
  try {
    setMsg("loading...");

    // Top10
    let top = [];
    if (api && typeof api.fetchWeeklyTop === "function") {
      top = await api.fetchWeeklyTop(weekId);
    } else if (api && typeof api.fetchPersonalWeeklyTop === "function") {
      // 旧名互換（念のため）
      top = await api.fetchPersonalWeeklyTop(weekId);
    } else {
      throw new Error("api.fetchWeeklyTop が見つからない（api.js差し替え漏れ）");
    }
    renderTop10(top);

    // 自分
    let me = null;
    if (api && typeof api.fetchMyWeeklyRank === "function") {
      me = await api.fetchMyWeeklyRank(weekId);
    }
    renderMe(me);

    setMsg(`OK（${weekId}）`);
  } catch (e) {
    console.warn("[ranking] loadRankings failed:", e);
    renderTop10([]);
    renderMe(null);
    setMsg("（取得失敗）");

    // ありがちな原因を一言だけ表示（長文は出さない）
    // e が Object の場合があるので message を拾える範囲で拾う
    const msg = (e && (e.message || e.error_description || e.details || e.hint)) ? (e.message || e.error_description || e.details || e.hint) : "";
    if (msg && els.weeklyTop) {
      els.weeklyTop.textContent = `（取得失敗）\n${msg}`;
      els.weeklyTop.style.whiteSpace = "pre-line";
    }
  }
}

async function initRankingUI() {
  try {
    // 要素が無いページでは何もしない
    if (!els.weekSelect || !els.reloadBtn) return;

    const weeks = await getWeekOptionsSafe();
    const now = (api && typeof api.getWeekIdNow === "function") ? api.getWeekIdNow() : "";

    // selectを埋める
    els.weekSelect.innerHTML = "";
    const list = (weeks && weeks.length) ? weeks : (now ? [now] : []);
    for (const w of list) {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      els.weekSelect.appendChild(opt);
    }

    // 初期選択
    if (now) els.weekSelect.value = now;

    // イベント
    els.reloadBtn.addEventListener("click", () => {
      loadRankings(els.weekSelect.value || now);
    });
    els.weekSelect.addEventListener("change", () => {
      loadRankings(els.weekSelect.value || now);
    });

    // 初回
    await loadRankings(els.weekSelect.value || now);
  } catch (e) {
    console.warn("[ranking] init failed:", e);
    setMsg("（ランキング初期化失敗）");
  }
}

window.initRankingUI = initRankingUI;

document.addEventListener("DOMContentLoaded", () => {
  // api.js の読み込み順が正しければここで api は生きてる
  if (!window.api) console.warn("[ranking] api is missing at DOMContentLoaded");
  initRankingUI();
});
