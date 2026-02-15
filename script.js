(() => {
  // Stop the “opens at bottom” / weird restoration
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  // Splash -> index
  const enterBtn = document.getElementById("enterBtn");
  if (enterBtn) {
    enterBtn.addEventListener("click", () => {
      document.body.classList.add("fade-out");
      setTimeout(() => (window.location.href = "./index.html"), 420);
    });
  }

  // Expand cards (one open at a time)
  const cards = Array.from(document.querySelectorAll("[data-card]"));
  if (cards.length) {
    const closeAll = (except) => {
      cards.forEach((card) => {
        if (card === except) return;
        card.classList.remove("is-open");
        const btn = card.querySelector(".card-btn");
        const details = card.querySelector(".details");
        if (btn) btn.setAttribute("aria-expanded", "false");
        if (details) details.setAttribute("aria-hidden", "true");
      });
    };

    cards.forEach((card) => {
      const btn = card.querySelector(".card-btn");
      const details = card.querySelector(".details");
      if (!btn || !details) return;

      btn.addEventListener("click", () => {
        const isOpen = card.classList.contains("is-open");
        closeAll(card);
        card.classList.toggle("is-open", !isOpen);
        btn.setAttribute("aria-expanded", String(!isOpen));
        details.setAttribute("aria-hidden", String(isOpen));
      });
    });

    // Click outside closes
    document.addEventListener("click", (e) => {
      const el = e.target;
      if (!(el instanceof Element)) return;
      if (!el.closest("[data-card]")) closeAll(null);
    });
  }
})();
