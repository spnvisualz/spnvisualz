(() => {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  const cards = Array.from(document.querySelectorAll("[data-card]"));

  const closeAll = (except) => {
    cards.forEach((card) => {
      if (except && card === except) return;
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

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const isOpen = card.classList.contains("is-open");
      closeAll(card);
      card.classList.toggle("is-open", !isOpen);
      btn.setAttribute("aria-expanded", String(!isOpen));
      details.setAttribute("aria-hidden", String(isOpen));
    });
  });

  document.addEventListener("click", (e) => {
    const el = e.target;
    if (!(el instanceof Element)) return;
    if (!el.closest("[data-card]")) closeAll(null);
  });
})();
