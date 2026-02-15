(() => {

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo(0, 0);

  const cards = document.querySelectorAll("[data-card]");

  function closeAll(except) {
    cards.forEach(card => {
      if (card === except) return;
      card.classList.remove("is-open");
    });
  }

  cards.forEach(card => {
    const btn = card.querySelector(".card-btn");
    btn.addEventListener("click", () => {
      const isOpen = card.classList.contains("is-open");
      closeAll(card);
      card.classList.toggle("is-open", !isOpen);
    });
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-card]")) {
      closeAll(null);
    }
  });

})();
