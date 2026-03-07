"use strict";

/**
 * docs/js/main.js
 * - ボタン配線
 * - ログイン / ログアウト
 * - ランキング読み込み
 * - nickname を「2-3-01」形式で保存
 */

console.log("[main] loaded! (buttons+login+ranking+B-id-classcode)");

// グローバル汚染回避
(() => {
  const byId = (id) => document.getElementById(id);

  const setLoginMsg = (t) => {
    const el = byId("loginMsg");
    if (el) el.textContent = t || "";
  };

  // loginId -> class_code
  // 例: 2-3-01-k9f2 -> 2-3
  function parseClassCodeFromLoginId(loginId) {
    const s = String(loginId || "").trim().toLowerCase();
    const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{1,2})-[a-z0-9]{4}$/);
    if (!m) return null;
    return `${m[1]}-${m[2]}`;
  }

  // loginId -> nickname
  // 例: 2-3-01-k9f2 -> 2-3-01
  function makeNicknameFromLoginId(loginId) {
    const s = String(loginId || "").trim().toLowerCase();
    const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{1,2})-[a-z0-9]{4}$/);
    if (!m) return s;

    const g = m[1];
    const c = m[2];
    const n = m[3].padStart(2, "0");
    return `${g}-${c}-${n}`;
  }

  // ログイン表示更新
  const refreshLoginBox = async () => {
    const box = byId("loginBox");
    if (!box) return;

    if (window.api?.isMock?.()) {
      box.classList.add("hidden");
      return;
    }

    box.classList.remove("hidden");

    try {
      const uid = await window.api.getMyUserId();
      setLoginMsg(uid ? `ログイン中：${uid}` : "未ログイン（本番送信にはログインが必要）");
    } catch (e) {
      setLoginMsg("未ログイン（本番送信にはログインが必要）");
    }
  };

  // ランキング更新
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

  // ボタン配線
  byId("startBtn")?.addEventListener("click", () => window.startGame?.());
  byId("retryBtn")?.addEventListener("click", () => window.startGame?.());
  byId("stopBtn")?.addEventListener("click", () => window.endGame?.());

  byId("rankReloadBtn")?.addEventListener("click", async () => {
    await refreshRanking();
  });

  byId("weekSelect")?.addEventListener("change", async () => {
    if (typeof window.loadRankings === "function") {
      await window.loadRankings();
    }
  });

  // ログイン
  byId("loginBtn")?.addEventListener("click", async () => {
    try {
      const loginId = byId("loginId")?.value || "";
      const pw = byId("loginPw")?.value || "";

      if (!loginId || !pw) {
        setLoginMsg("ログインIDとパスワードを入れてください");
        return;
      }

      const res = await window.api.signIn(loginId, pw);
      if (!res?.ok) {
        setLoginMsg(res?.message || "ログイン失敗");
        return;
      }

      const classCode = parseClassCodeFromLoginId(loginId);
      const nickname = makeNicknameFromLoginId(loginId);

      if (classCode) {
        await window.api.upsertProfile({
          nickname: nickname,
          classCode: classCode,
        });
      }

      setLoginMsg("ログイン成功");
      await refreshLoginBox();
      await refreshRanking();
    } catch (e) {
      setLoginMsg(e?.message || "ログイン失敗");
    }
  });

  // ログアウト
  byId("logoutBtn")?.addEventListener("click", async () => {
    try {
      await window.api.signOut();
      setLoginMsg("ログアウトしました");
      await refreshLoginBox();
      await refreshRanking();
    } catch (e) {
      setLoginMsg(e?.message || "ログアウト失敗");
    }
  });

  // 初期化
  (async () => {
    await refreshLoginBox();
    await refreshRanking();

    window.onResultShown = async () => {
      await refreshRanking();
    };
  })();
})();
