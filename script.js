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

/* NAV SCROLL EFFECT */
const nav = document.querySelector(".nav");

window.addEventListener("scroll", () => {
  if(window.scrollY > 40){
    nav.classList.add("scrolled");
  } else {
    nav.classList.remove("scrolled");
  }
});

/* ACTIVE LINK AUTO-DETECT */
const links = document.querySelectorAll(".nav-links a");
const currentPath = window.location.pathname;

links.forEach(link => {
  if(currentPath.includes(link.getAttribute("href"))){
    link.classList.add("active");
  }
});
/* =============================
   INTRO VIDEO — PERFECT VERSION
============================= */

document.addEventListener("DOMContentLoaded", () => {

  const intro = document.getElementById("intro");
  const video = document.getElementById("introVideo");

  if (!intro || !video) return;

  let faded = false;

  const fadeOut = () => {
    if (faded) return;
    faded = true;

    intro.classList.add("fade-out");
    setTimeout(() => intro.remove(), 1000);
  };

  // When metadata loads, we know video duration
  video.addEventListener("loadedmetadata", () => {

    // Safety fallback (duration + 0.3 buffer)
    const duration = video.duration * 1000 + 300;

    setTimeout(fadeOut, duration);
  });

  // Fade exactly when video ends
  video.addEventListener("ended", fadeOut);

  // Try autoplay
  video.play().catch(() => {
    // If autoplay blocked, user must tap
  });

});
