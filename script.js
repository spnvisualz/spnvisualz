(() => {
  // Prevent scroll jump on refresh / navigation
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  // Splash enter -> smooth fade transition
  const enterBtn = document.getElementById("enterBtn");
  if (enterBtn) {
    enterBtn.addEventListener("click", () => {
      document.body.classList.add("fade-out");
      window.setTimeout(() => {
        window.location.href = "./index.html";
      }, 450);
    });
  }
})();
