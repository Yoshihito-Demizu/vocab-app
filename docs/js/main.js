// docs/js/main.js
console.log("[main] loaded! (buttons+login+ranking)");

/* global api */

// $ は衝突しやすいので使わない
function byId(id){ return document.getElementById(id); }

function setLoginMsg(t){
  const el = byId("loginMsg");
  if (el) el.textContent = t || "";
}

async function refreshLoginBox(){
  const box = byId("loginBox");
  if (!box) return;

  if (api?.isMock?.()) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");

  const uid = await api.getMyUserId();
  setLoginMsg(uid ? `ログイン中：${uid}` : "未ログイン（本番送信にはログインが必要）");
}

// ===== ランキングを読み込む（存在しない時は何もしない）=====
async function refreshRanking(){
  try{
    if (typeof window.loadWeekOptions !== "function") return;
    if (typeof window.loadRankings !== "function") return;

    await window.loadWeekOptions();
    await window.loadRankings();
  } catch(e){
    console.warn("[main] refreshRanking failed:", e);
    const msg = byId("rankMsg");
    if (msg) msg.textContent = "ランキング取得に失敗";
  }
}

// ===== ボタン =====
byId("startBtn")?.addEventListener("click", () => window.startGame?.());
byId("retryBtn")?.addEventListener("click", () => window.startGame?.());
byId("stopBtn")?.addEventListener("click", () => window.endGame?.());

// ランキングの更新ボタン
byId("rankReloadBtn")?.addEventListener("click", async () => {
  await refreshRanking();
});

// 週を変えたら自動更新
byId("weekSelect")?.addEventListener("change", async () => {
  if (typeof window.loadRankings === "function") await window.loadRankings();
});

// ===== ログイン =====
byId("loginBtn")?.addEventListener("click", async () => {
  try{
    const loginId = byId("loginId")?.value || "";
    const pw = byId("loginPw")?.value || "";
    if (!loginId || !pw) { setLoginMsg("ログインIDとパスワードを入れてね"); return; }
    const res = await api.signIn(loginId, pw);
    setLoginMsg(res.message || "");
    await refreshLoginBox();
  } catch(e){
    setLoginMsg(e?.message || "ログイン失敗");
  }
});

byId("logoutBtn")?.addEventListener("click", async () => {
  try{
    await api.signOut();
    setLoginMsg("ログアウトしました");
    await refreshLoginBox();
  } catch(e){
    setLoginMsg(e?.message || "ログアウト失敗");
  }
});

// ===== 初期化 =====
(async () => {
  await refreshLoginBox();
  await refreshRanking();

  // quiz.js 側が window.onResultShown() を呼ぶ想定
  window.onResultShown = async () => {
    await refreshRanking();
  };
})();
