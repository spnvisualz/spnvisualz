(() => {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  // Splash -> enter transition
  const enterBtn = document.getElementById("enterBtn");
  if (enterBtn) {
    window.scrollTo(0, 0);
    enterBtn.addEventListener("click", () => {
      document.body.classList.add("fade-out");
      setTimeout(() => (window.location.href = "./index.html"), 450);
    });
  }

  // Expandable pricing cards
  const cards = document.querySelectorAll(".price-card.expandable");
  if (!cards.length) return;

  const closeAll = (except) => {
    cards.forEach((card) => {
      if (card === except) return;
      card.classList.remove("is-open");
      const btn = card.querySelector(".card-toggle");
      const details = card.querySelector(".card-details");
      if (btn) btn.setAttribute("aria-expanded", "false");
      if (details) details.setAttribute("aria-hidden", "true");
    });
  };

  cards.forEach((card) => {
    const btn = card.querySelector(".card-toggle");
    const details = card.querySelector(".card-details");
    if (!btn || !details) return;

    btn.addEventListener("click", () => {
      const isOpen = card.classList.contains("is-open");
      closeAll(card);
      card.classList.toggle("is-open", !isOpen);
      btn.setAttribute("aria-expanded", String(!isOpen));
      details.setAttribute("aria-hidden", String(isOpen));
    });
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    const el = e.target;
    if (!(el instanceof Element)) return;
    if (!el.closest(".price-card.expandable")) closeAll(null);
  });
})();
