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

// On some browsers/environments `window.innerHeight` (and CSS viewport
// units like svh) can briefly report 0 right at DOMContentLoaded, before
// the browser has actually attached real viewport metrics to the page —
// harmless for most code, but every measurement this site's camera
// corridor depends on (chapter heights, the Work section's spacer, the
// nav's Work menu-link landing point) is taken exactly once, synchronously,
// at mount. Caught against a zero-height viewport, that one-time snapshot
// is permanently wrong for the rest of the session — a menu jump lands
// nowhere near a project, or the corridor's depth math drifts out of step
// with the real scroll-to-camera mapping. Waiting for a real, non-zero
// viewport (and for fonts, which also shift text-block heights) before
// taking any of those measurements fixes the cause, not the symptom.
function waitForStableLayout() {
  const fontsReady = document.fonts?.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  const layoutReady = new Promise((resolve) => {
    // Require the same non-zero size across several consecutive frames,
    // not just a single non-zero reading — a viewport that's merely
    // *changing* (address-bar collapse, a host UI still attaching real
    // metrics) can pass through a wrong-but-nonzero size on its way to
    // the real one, and a single-frame check happily measures against
    // that in-between value instead of waiting for it to actually settle.
    let lastW = -1;
    let lastH = -1;
    let stableFrames = 0;
    (function check() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w > 0 && h > 0 && w === lastW && h === lastH) {
        stableFrames += 1;
        if (stableFrames >= 5) {
          resolve();
          return;
        }
      } else {
        stableFrames = 0;
      }
      lastW = w;
      lastH = h;
      requestAnimationFrame(check);
    })();
  });
  return Promise.race([
    Promise.all([fontsReady, layoutReady]),
    new Promise((resolve) => setTimeout(resolve, 3000))
  ]);
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

  waitForStableLayout().then(() => {
    // Re-measure against the now-confirmed-real viewport before anything
    // (SceneDirector included) reads layout — the very first call above
    // may have run against a zero/transient viewport.
    sizeWorkSpacer();
    const director = mountSceneDirector();
    bindFacetToServices(director);
    bindPlanetToContact(director);
    bindWorkOverlay(director);
    ScrollTrigger.refresh();
  });

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
