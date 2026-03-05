// docs/js/main.js
/* global api */
"use strict";

console.log("[main] loaded! (buttons+login+ranking)");

// ✅ グローバル汚染しない（$ / byId を二重宣言しない）
(() => {
  const byId = (id) => document.getElementById(id);

  const setLoginMsg = (t) => {
    const el = byId("loginMsg");
    if (el) el.textContent = t || "";
  };

  const refreshLoginBox = async () => {
    const box = byId("loginBox");
    if (!box) return;

    // mock ならログインUIは隠す
    if (api?.isMock?.()) {
      box.classList.add("hidden");
      return;
    }
    box.classList.remove("hidden");

    try {
      const uid = await api.getMyUserId();
      setLoginMsg(uid ? `ログイン中：${uid}` : "未ログイン（本番送信にはログインが必要）");
    } catch (e) {
      setLoginMsg("未ログイン（本番送信にはログインが必要）");
    }
  };

  // ===== ランキングを読み込む（存在しない時は何もしない）=====
  const refreshRanking = async () => {
    try {
      if (typeof window.loadWeekOptions !== "function") return;
      if (typeof window.loadRankings !== "function") return;

      await window.loadWeekOptions();
      await window.loadRankings();
    } catch (e) {
      console.warn("[main] refreshRanking failed:", e);
      const msg = byId("rankMsg");
      if (msg) msg.textContent = "ランキング取得に失敗";
    }
  };

  // ===== ボタン配線 =====
  byId("startBtn")?.addEventListener("click", () => window.startGame?.());
  byId("retryBtn")?.addEventListener("click", () => window.startGame?.());
  byId("stopBtn")?.addEventListener("click", () => window.endGame?.());

  // ランキング更新
  byId("rankReloadBtn")?.addEventListener("click", async () => {
    await refreshRanking();
  });

  // 週変更で更新
  byId("weekSelect")?.addEventListener("change", async () => {
    if (typeof window.loadRankings === "function") await window.loadRankings();
  });

  // ===== ログイン =====
  byId("loginBtn")?.addEventListener("click", async () => {
    try {
      const loginId = byId("loginId")?.value || "";
      const pw = byId("loginPw")?.value || "";
      if (!loginId || !pw) {
        setLoginMsg("ログインIDとパスワードを入れてね");
        return;
      }
      const res = await api.signIn(loginId, pw);
      setLoginMsg(res?.message || "ログイン完了");
      await refreshLoginBox();
      await refreshRanking();
    } catch (e) {
      setLoginMsg(e?.message || "ログイン失敗");
    }
  });

  byId("logoutBtn")?.addEventListener("click", async () => {
    try {
      await api.signOut();
      setLoginMsg("ログアウトしました");
      await refreshLoginBox();
      await refreshRanking();
    } catch (e) {
      setLoginMsg(e?.message || "ログアウト失敗");
    }
  });

  // ===== 初期化 =====
  (async () => {
    await refreshLoginBox();
    await refreshRanking();

    // ✅ quiz.js が結果画面表示タイミングで呼べるように
    window.onResultShown = async () => {
      await refreshRanking();
    };
  })();
})();
