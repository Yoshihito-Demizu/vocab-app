// docs/js/main.js
console.log("[main] loaded! (buttons+login)");

/* global api */

function $(id){ return document.getElementById(id); }

function setLoginMsg(t){
  const el = $("loginMsg");
  if (el) el.textContent = t || "";
}

async function refreshLoginBox(){
  // MOCKならログイン欄を隠す（事故らない）
  const box = $("loginBox");
  if (!box) return;

  if (api.isMock()) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");

  const uid = await api.getMyUserId();
  setLoginMsg(uid ? `ログイン中：${uid}` : "未ログイン（本番送信にはログインが必要）");
}

$("startBtn")?.addEventListener("click", () => window.startGame?.());
$("retryBtn")?.addEventListener("click", () => window.startGame?.());
$("stopBtn")?.addEventListener("click", () => window.endGame?.());

$("loginBtn")?.addEventListener("click", async () => {
  try{
    const loginId = $("loginId")?.value || "";
    const pw = $("loginPw")?.value || "";
    if (!loginId || !pw) { setLoginMsg("ログインIDとパスワードを入れてね"); return; }
    const res = await api.signIn(loginId, pw);
    setLoginMsg(res.message || "");
    await refreshLoginBox();
  } catch(e){
    setLoginMsg(e?.message || "ログイン失敗");
  }
});

$("logoutBtn")?.addEventListener("click", async () => {
  try{
    await api.signOut();
    setLoginMsg("ログアウトしました");
    await refreshLoginBox();
  } catch(e){
    setLoginMsg(e?.message || "ログアウト失敗");
  }
});

refreshLoginBox();
