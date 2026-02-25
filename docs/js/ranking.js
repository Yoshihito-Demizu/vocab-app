// docs/js/ranking.js
console.log("[ranking] loaded! (safe-init + auto-wire)");

(function () {
  "use strict";

  // ========= DOM helpers =========
  function $(id) { return document.getElementById(id); }
  function setText(id, text, cls = "") {
    const el = $(id);
    if (!el) return;
    if (cls) el.className = cls;
    el.textContent = String(text ?? "");
  }

  // ========= safe getters =========
  function isMockMode() {
    // USE_MOCK が未定義で落ちるのを防ぐ
    return !!window.USE_MOCK;
  }

  async function waitForApi(timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.api) return window.api;
      await new Promise(r => setTimeout(r, 50));
    }
    throw new Error("api が見つかりません（api.js が読めていない/エラーで止まっている可能性）");
  }

  // ========= week_id =========
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

  // ========= local fallback =========
  const KEY = "vocabTA_v1";

  function loadDB() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch { return {}; }
  }
  function saveDB(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }
  function ensureUser(db, userId) {
    db.users = db.users || {};
    if (!db.users[userId]) db.users[userId] = { nickname: `user-${userId}`, grade: 0, class_no: 0 };
  }
  function ensureWeekly(db, weekId) {
    db.weekly = db.weekly || {};
    db.weekly[weekId] = db.weekly[weekId] || {};
  }
  function ensureTotal(db, userId) {
    db.total = db.total || {};
    db.total[userId] = db.total[userId] || { points: 0, correct: 0, wrong: 0 };
  }

  // quiz側から使う可能性がある（MOCK用の記録）
  async function recordAttempt({ userId, weekId, is_correct, points }) {
    const db = loadDB();
    ensureUser(db, userId);
    ensureWeekly(db, weekId);
    ensureTotal(db, userId);

    const w = (db.weekly[weekId][userId] ||= { points: 0, correct: 0, wrong: 0 });
    if (is_correct) { w.points += Number(points || 0); w.correct += 1; }
    else { w.wrong += 1; }

    const t = db.total[userId];
    if (is_correct) { t.points += Number(points || 0); t.correct += 1; }
    else { t.wrong += 1; }

    saveDB(db);
  }

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

  // ========= supabase render =========
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

  // ========= weekSelect =========
  async function loadWeekOptions() {
    const sel = $("weekSelect");
    if (!sel) return;

    const api = await waitForApi();

    let weeks = [];
    if (!isMockMode() && api.fetchWeekOptions) {
      try {
        weeks = await api.fetchWeekOptions();
      } catch (e) {
        console.warn("[ranking] fetchWeekOptions failed -> local fallback", e);
      }
    }

    if (!weeks || weeks.length === 0) {
      const db = loadDB();
      weeks = Object.keys(db.weekly || {});
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

  // ========= main =========
  async function loadRankings() {
    setText("rankMsg", "読み込み中…", "msg");

    const sel = $("weekSelect");
    const weekId = sel?.value || getISOWeekId();

    const api = await waitForApi();

    // ---- prod: supabase優先 ----
    if (!isMockMode() && api.fetchPersonalWeeklyTop && api.fetchMyWeeklyRank) {
      try {
        const top = await api.fetchPersonalWeeklyTop(weekId);
        renderTop10Supabase(top);

        const me = await api.fetchMyWeeklyRank(weekId);
        renderMyRankSupabase(me);

        setText("rankMsg", `OK（${weekId}）`, "msg");
        return;
      } catch (e) {
        console.warn("[ranking] supabase failed -> fallback local:", e);
      }
    }

    // ---- fallback: local ----
    const db = loadDB();
    const usersMap = db.users || {};
    const weeklyList = toArrayWeekly(db, weekId);

    renderTop10Local(weeklyList, usersMap);

    let myId = "u1";
    try { myId = await api.getMyUserId(); } catch { /* ignore */ }

    renderMyRankLocal(weeklyList, usersMap, myId);

    setText("rankMsg", `OK（${weekId} / local）`, "msg");
  }

  // ========= auto-wire =========
  async function initRankingUI() {
    // rankPane がない画面では何もしない
    if (!$("rankPane")) return;

    try {
      await loadWeekOptions();
      await loadRankings();

      $("rankReloadBtn")?.addEventListener("click", () => loadRankings());
      $("weekSelect")?.addEventListener("change", () => loadRankings());

      // 結果画面が表示されたタイミングでも更新したい
      // （retry→結果→ランキング更新が漏れないように）
      const resultPane = $("resultPane");
      if (resultPane) {
        const obs = new MutationObserver(() => {
          // hidden が外れたら読み込み
          const hidden = resultPane.classList.contains("hidden");
          if (!hidden) {
            loadWeekOptions().then(loadRankings).catch(() => null);
          }
        });
        obs.observe(resultPane, { attributes: true, attributeFilter: ["class"] });
      }
    } catch (e) {
      console.warn("[ranking] init failed:", e);
      setText("rankMsg", "ランキング初期化失敗（コンソール確認）", "msg");
    }
  }

  // 公開（他JSからも使える）
  window.loadWeekOptions = loadWeekOptions;
  window.loadRankings = loadRankings;
  window.__recordAttempt = recordAttempt;
  window.initRankingUI = initRankingUI;

  // DOM準備後に初期化
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRankingUI);
  } else {
    initRankingUI();
  }
})();
