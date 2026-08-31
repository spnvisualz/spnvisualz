import "./styles/base.css";
import "./styles/nav.css";
import "./styles/hero.css";
import "./styles/work.css";
import "./styles/services.css";
import "./styles/pricing.css";
import "./styles/misc.css";

import { createMasterScroll, ScrollTrigger } from "./motion/scrollTimeline.js";
import { mountPlanetScene } from "./three/sceneMount.js";
import { initNav } from "./nav/nav.js";
import { initReveals } from "./motion/reveal.js";
import { initWorkSequence } from "./work/workSequence.js";
import { initServices } from "./services/services.js";
import { initPricing } from "./pricing/pricing.js";
import { initOrderDialog } from "./contact/orderDialog.js";

function boot() {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  createMasterScroll({ reduceMotion });
  const scene = mountPlanetScene();
  initNav();

  // initWorkSequence sets the work section's real (much taller) height
  // synchronously. Everything that creates ScrollTrigger instances keyed to
  // document position — chapter states, reveals — must run after that and
  // after an explicit refresh, or they compute against a too-short
  // pre-layout document and misfire on load (observed: chapter HUD landing
  // on the wrong chapter, and full-page scroll jumps).
  initWorkSequence();
  ScrollTrigger.refresh();

  scene?.initJourney?.();
  initReveals();
  initPricing();
  const orderDialog = initOrderDialog();
  initServices({ onOrder: (product) => orderDialog.open(product) });

  const bootEl = document.getElementById("originBoot");
  if (bootEl) {
    setTimeout(() => {
      bootEl.style.opacity = "0";
      setTimeout(() => bootEl.remove(), 600);
    }, 1100);
  }

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  document.body.classList.remove("is-loading");

  requestAnimationFrame(() => ScrollTrigger.refresh());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
