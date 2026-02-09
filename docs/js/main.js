// docs/js/main.js
console.log("[main] loaded!");

function bind() {
  document.getElementById("startBtn")
    ?.addEventListener("click", () => window.startGame?.());

  document.getElementById("retryBtn")
    ?.addEventListener("click", () => window.startGame?.());

  document.getElementById("stopBtn")
    ?.addEventListener("click", () => window.endGame?.());
}

// DOMが完全にできてから結線（超重要）
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bind);
} else {
  bind();
}
