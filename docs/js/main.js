// docs/js/main.js
console.log("[main] loaded!");

document.getElementById("startBtn")?.addEventListener("click", () => window.startGame?.());
document.getElementById("retryBtn")?.addEventListener("click", () => window.startGame?.());
document.getElementById("stopBtn")?.addEventListener("click", () => window.endGame?.());
