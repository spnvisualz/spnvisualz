import { getLenis } from "../motion/scrollTimeline.js";

export function initNav() {
  const header = document.getElementById("siteHeader");
  const toggle = document.getElementById("menuToggle");
  const menu = document.getElementById("mobileMenu");

  window.addEventListener(
    "scroll",
    () => header?.classList.toggle("is-scrolled", window.scrollY > 20),
    { passive: true }
  );

  const setOpen = (open) => {
    document.body.classList.toggle("menu-open", open);
    toggle?.setAttribute("aria-expanded", String(open));
    menu?.setAttribute("aria-hidden", String(!open));
    if (open) menu?.removeAttribute("inert");
    else menu?.setAttribute("inert", "");
    if (open) getLenis()?.stop();
    else getLenis()?.start();
  };

  toggle?.addEventListener("click", () => setOpen(!document.body.classList.contains("menu-open")));
  menu?.querySelectorAll("[data-menu-link], [data-menu-project]").forEach((el) =>
    el.addEventListener("click", () => setOpen(false))
  );
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("menu-open")) setOpen(false);
  });

  // In-page anchor links go through Lenis so the smooth-scroll system stays
  // the single source of truth (no native jump fighting the Lenis raf loop).
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      getLenis()?.scrollTo(target, { offset: -20 });
    });
  });
}
