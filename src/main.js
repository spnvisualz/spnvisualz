import "./styles/base.css";
import "./styles/nav.css";
import "./styles/origin.css";
import "./styles/work.css";
import "./styles/services.css";
import "./styles/pricing.css";
import "./styles/misc.css";

import { createMasterScroll, ScrollTrigger } from "./motion/scrollTimeline.js";
import { mountSceneDirector, bindFacetToServices, bindPlanetToContact } from "./three/SceneDirector.js";
import { initWorkSequence } from "./work/workSequence.js";
import { initNav } from "./nav/nav.js";
import { initMagnetic } from "./nav/magnetic.js";
import { initReveals } from "./motion/reveal.js";
import { initServices } from "./services/services.js";
import { initPricing } from "./pricing/pricing.js";
import { initOrderDialog } from "./contact/orderDialog.js";

function boot() {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  createMasterScroll({ reduceMotion });
  initNav();

  // Work is real DOM content now, so its height comes from the content
  // itself — there is no JS-sized spacer to measure, and nothing whose
  // height changes out from under the scroll position later.
  initWorkSequence({ reduceMotion });

  const director = mountSceneDirector();
  bindFacetToServices(director);
  bindPlanetToContact(director);

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

  // Mobile browsers change innerHeight when the address bar collapses,
  // firing resize mid-scroll. Refreshing ScrollTrigger on those events is
  // what made the page jump — every trigger recalculates against a
  // viewport that is only transiently different. Only respond to a real
  // width change (an actual orientation change or window resize); ignore
  // height-only changes entirely.
  let lastWidth = window.innerWidth;
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 250);
  });

  requestAnimationFrame(() => ScrollTrigger.refresh());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
