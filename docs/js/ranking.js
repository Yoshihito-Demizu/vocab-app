// docs/js/ranking.js
console.log("[ranking] loaded! (safe-init + auto-wire)");

/* global api */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const setText = (id, text) => { const el = $(id); if (el) el.textContent = String(text ?? ""); };

  // ✅ USE_MOCK が未定義でも window.USE_MOCK を見に行く
  function isMock() {
    try { return !!(window.USE_MOCK); } catch { return false; }
  }

  // ===== week_id（YYYY-Www）=====
  function getISOWeekId(d = new Date()) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    const yyyy = date.getUTCFullYear();
    const ww = String(weekNo).padStart(2, "0");
    return `${yyyy}-W${ww}`;
  }

  // ===== local fallback =====
  const KEY = "vocabTA_v1";
  function loadDB() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } }

  function toArrayWeekly(db, weekId) {
    const m = (db.weekly && db.weekly[weekId]) ? db.weekly[weekId] : {};
    return Object.entries(m).map(([user_id, v]) => ({ user_id, ...v }));
  }

  function renderTop10Local(list, usersMap) {
    const box = $("weeklyTop");
    if (!box) return;
    box.innerHTML = "";

    const top = list
      .slice()
      .sort((a, b) => (b.points - a.points) || (b.correct - a.correct))
      .slice(0, 10);

    if (top.length === 0) { box.textContent = "（まだデータなし）"; return; }

    const ol = document.createElement("ol");
    top.forEach((r, i) => {
      const u = usersMap[r.user_id] || { nickname: r.user_id };
      const li = document.createElement("li");
      li.textContent = `${i + 1}. ${u.nickname} — ${r.points}点（○${r.correct} / ×${r.wrong}）`;
      ol.appendChild(li);
    });
    box.appendChild(ol);
  }

  function renderMyRankLocal(list, usersMap, userId) {
    const box = $("myRank");
    if (!box) return;

    const sorted = list
      .slice()
      .sort((a, b) => (b.points - a.points) || (b.correct - a.correct));

    const idx = sorted.findIndex(x => x.user_id === userId);
    if (idx < 0) { box.textContent = "（まだデータなし）"; return; }

    const me = sorted[idx];
    const u = usersMap[userId] || { nickname: userId };
    box.innerHTML =
      `あなた：<b>${u.nickname}</b>　順位：<b>${idx + 1}</b>位　` +
      `スコア：<b>${me.points}</b>点（○${me.correct} / ×${me.wrong}）`;
  }

  // ===== supabase render =====
  function renderTop10Supabase(list) {
    const box = $("weeklyTop");
    if (!box) return;
    box.innerHTML = "";

    if (!list || list.length === 0) {
      box.textContent = "（まだデータなし）";
      return;
    }

    const ol = document.createElement("ol");
    list.forEach((r, i) => {
      const li = document.createElement("li");
      const name = r.nickname || r.user_id;
      li.textContent = `${i + 1}. ${name} — ${r.points}点（○${r.correct} / ×${r.wrong}）`;
      ol.appendChild(li);
    });
    box.appendChild(ol);
  }

  function renderMyRankSupabase(me) {
    const box = $("myRank");
    if (!box) return;

    if (!me) {
      box.textContent = "（まだデータなし / ログインしてない可能性）";
      return;
    }
    box.innerHTML =
      `順位：<b>${me.rank}</b>位　スコア：<b>${me.points}</b>点（○${me.correct} / ×${me.wrong}）`;
  }

  async function loadWeekOptions() {
    const sel = $("weekSelect");
    if (!sel) return;

    let weeks = [];
    try {
      if (!isMock()) weeks = await api.fetchWeekOptions();
      else weeks = Object.keys(loadDB().weekly || {});
    } catch {
      weeks = Object.keys(loadDB().weekly || {});
    }

    const now = getISOWeekId();
    if (!weeks.includes(now)) weeks.unshift(now);
    weeks = Array.from(new Set(weeks)).sort().reverse();

    sel.innerHTML = "";
    weeks.forEach((w) => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      sel.appendChild(opt);
    });
  }

  async function loadRankings() {
    setText("rankMsg", "読み込み中…");

    const sel = $("weekSelect");
    const weekId = sel?.value || getISOWeekId();

    // ✅ supabase優先（prod）
    if (!isMock()) {
      try {
        const top = await api.fetchPersonalWeeklyTop(weekId);
        renderTop10Supabase(top);

        const me = await api.fetchMyWeeklyRank(weekId);
        renderMyRankSupabase(me);

        setText("rankMsg", `OK（${weekId} / prod）`);
        return;
      } catch (e) {
        console.warn("[ranking] supabase failed -> fallback local:", e);
        setText("rankMsg", `prod失敗→localへ（${weekId}）`);
      }
    }

    // ✅ local fallback
    const db = loadDB();
    const usersMap = db.users || {};
    const weeklyList = toArrayWeekly(db, weekId);

    renderTop10Local(weeklyList, usersMap);
    const myId = await api.getMyUserId(); // mockならu1
    renderMyRankLocal(weeklyList, usersMap, myId);

    setText("rankMsg", `OK（${weekId} / local）`);
  }

  // ✅ 画面に要素がある時だけ初期化
  async function initRankingUI() {
    const pane = $("rankPane");
    const sel = $("weekSelect");
    const btn = $("rankReloadBtn");
    if (!pane || !sel || !btn) {
      console.log("[ranking] no ranking DOM -> skip init");
      return;
    }

    btn.addEventListener("click", () => loadRankings());
    sel.addEventListener("change", () => loadRankings());

    await loadWeekOptions();
    await loadRankings();
  }

  window.loadWeekOptions = loadWeekOptions;
  window.loadRankings = loadRankings;
  window.initRankingUI = initRankingUI;

  window.addEventListener("DOMContentLoaded", () => {
    initRankingUI().catch((e) => console.warn("[ranking] init failed:", e));
  });
})();
