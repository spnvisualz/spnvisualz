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

  const showcase = document.getElementById("showcase");
  const showcaseTrack = document.getElementById("showcaseTrack");

  if (showcase && showcaseTrack) {

    const videos = showcaseTrack.querySelectorAll("video");

    function updateShowcaseScroll() {

      const rect = showcase.getBoundingClientRect();
      const totalPanels = videos.length;

      const scrollAmount = Math.min(
        Math.max(-rect.top, 0),
        window.innerHeight * (totalPanels - 1)
      );

      const horizontalMove =
        scrollAmount * (window.innerWidth / window.innerHeight);

      showcaseTrack.style.transform = `translateX(-${horizontalMove}px)`;

      const activeIndex = Math.round(scrollAmount / window.innerHeight);

      videos.forEach((video, i) => {
        if (i === activeIndex) {
          if (video.paused) video.play();
        } else {
          video.pause();
        }
      });
    }

    window.addEventListener("scroll", updateShowcaseScroll);
    window.addEventListener("resize", updateShowcaseScroll);
  }

})();
