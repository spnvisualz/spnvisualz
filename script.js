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

/* Custom cursor halo */
document.addEventListener('DOMContentLoaded', () => {
  // Create a halo element that follows the pointer
  const halo = document.createElement('div');
  halo.id = 'cursor-halo';
  document.body.appendChild(halo);
  // Hide the native cursor to enhance the premium feel
  document.body.style.cursor = 'none';
  window.addEventListener('mousemove', (e) => {
    // Translate the halo to the pointer location
    halo.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  });
});

// ---------------------------------------------------------------------------
// Parallax background movement
//
// To add subtle depth to the page without sacrificing performance, certain
// decorative layers are assigned the class `parallax`.  This listener
// translates those elements slightly on scroll, scaling the movement to a
// fraction of the scroll distance.  The effect is subtle and only applied
// when the page contains such elements (e.g. hero backgrounds).

const parallaxEls = document.querySelectorAll('.parallax');
if (parallaxEls.length) {
  window.addEventListener('scroll', () => {
    // Multiply scrollY by a small factor for a gentle effect
    const offsetY = window.scrollY * 0.05;
    parallaxEls.forEach(el => {
      el.style.transform = `translateY(${offsetY}px)`;
    });
  });
}
