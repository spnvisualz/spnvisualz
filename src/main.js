import "./styles/base.css";
import "./styles/nav.css";
import "./styles/origin.css";
import "./styles/work.css";
import "./styles/services.css";
import "./styles/pricing.css";
import "./styles/misc.css";

import { createMasterScroll, ScrollTrigger } from "./motion/scrollTimeline.js";
import { mountSceneDirector, bindFacetToServices, bindPlanetToContact } from "./three/SceneDirector.js";
import { bindWorkOverlay } from "./work/workOverlay.js";
import { PROJECTS } from "./work/projects.js";
import { initNav } from "./nav/nav.js";
import { initMagnetic } from "./nav/magnetic.js";
import { initReveals } from "./motion/reveal.js";
import { initServices } from "./services/services.js";
import { initPricing } from "./pricing/pricing.js";
import { initOrderDialog } from "./contact/orderDialog.js";

function sizeWorkSpacer() {
  const spacer = document.getElementById("workSpacer");
  if (!spacer) return;
  spacer.style.height = `${window.innerHeight * PROJECTS.length * 0.95}px`;
}

function boot() {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  // The work section's real (much taller) height must exist BEFORE Lenis
  // is even constructed, not just before ScrollTrigger runs — Lenis reads
  // document dimensions at init, and creating it against a still-short
  // document (before #workSpacer is sized) produced a scroll jump on load
  // even with ScrollTrigger.refresh() called correctly afterward.
  sizeWorkSpacer();
  window.scrollTo(0, 0);

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  createMasterScroll({ reduceMotion });
  initNav();
  ScrollTrigger.refresh();

  const director = mountSceneDirector();
  bindFacetToServices(director);
  bindPlanetToContact(director);
  bindWorkOverlay(director);

  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate(self) {
      const bar = document.getElementById("pageProgress")?.firstElementChild;
      if (bar) bar.style.transform = `scaleX(${self.progress})`;
    }
  });

  initReveals();
  initMagnetic();
  initPricing();
  const orderDialog = initOrderDialog();
  initServices({ onOrder: (product) => orderDialog.open(product) });

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  document.body.classList.remove("is-loading");

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      sizeWorkSpacer();
      ScrollTrigger.getAll().forEach((st) => st.refresh());
    }, 200);
  });

  requestAnimationFrame(() => ScrollTrigger.refresh());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
