import "./styles/base.css";
import "./styles/nav.css";
import "./styles/consent.css";
import "./styles/origin.css";
import "./styles/work.css";
import "./styles/services.css";
import "./styles/pricing.css";
import "./styles/misc.css";

import { createMasterScroll, getLenis, ScrollTrigger } from "./motion/scrollTimeline.js";
import { mountSceneDirector, bindFacetToServices, bindPlanetToContact } from "./three/SceneDirector.js";
import { initWorkSequence } from "./work/workSequence.js";
import { initNav } from "./nav/nav.js";
import { initMagnetic } from "./nav/magnetic.js";
import { initReveals } from "./motion/reveal.js";
import { initServices } from "./services/services.js";
import { initPricing } from "./pricing/pricing.js";
import { initOrderDialog } from "./contact/orderDialog.js";

function boot() {
  // Setting history.scrollRestoration directly is not enough. ScrollTrigger
  // snapshots the value at *import* time — which happens before boot() runs —
  // and restores its snapshot later, putting "auto" back. The browser then
  // restores the previous scroll offset on reload, which on this very tall
  // page meant refreshing could drop a visitor thousands of pixels down.
  // clearScrollMemory updates ScrollTrigger's snapshot and history together,
  // so the setting actually sticks.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  ScrollTrigger.clearScrollMemory("manual");
  window.scrollTo(0, 0);

  // …which also wiped every deep link into this page. contact.html sends
  // visitors to /#contact, the Visual Lab footer to /#work and /#services,
  // and all of them arrived at the top of the homepage instead, because the
  // reset above runs after the browser's own hash scroll. The intro makes
  // that unavoidable — the page is held at overflow:hidden while it plays,
  // so there is nothing to scroll to yet. Remember the target now and go
  // there once the page can actually move (see startWorld).
  const deepLinkTarget = (() => {
    const hash = location.hash;
    if (!hash || hash.length < 2) return null;
    try {
      return document.querySelector(hash);
    } catch {
      return null; // a hash that is not a valid selector
    }
  })();

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const lenis = createMasterScroll({ reduceMotion });
  initNav();

  // Lenis owns the scroll, and it measures the document when it is
  // constructed. The intro holds the page with html{overflow:hidden},
  // and this runs underneath it — main.js cannot execute until the
  // Three.js chunk has arrived, which is long after the overlay went up.
  // So Lenis was measuring a page that could not scroll, caching a limit
  // of zero, and keeping it after the lock came off: the wheel and touch
  // did nothing on the homepage while programmatic scrolling still
  // worked, which is why this got past the first round of testing.
  // Park it explicitly now and re-measure once the page is really free.
  if (window.__spnIntroActive) lenis?.stop();

  // Work is real DOM content now, so its height comes from the content
  // itself — there is no JS-sized spacer to measure, and nothing whose
  // height changes out from under the scroll position later.
  initWorkSequence({ reduceMotion });

  // The 3D layer waits for the intro to finish.
  //
  // Building the renderer, compiling four shader programs and uploading
  // the planet texture is the heaviest thing this page does, and doing it
  // while the arrival is flying costs exactly the frames the arrival is
  // there to make an impression with. Deferring it is only safe because
  // the background is CSS now (body::before in base.css): a late scene
  // mount changes nothing on screen, where it used to mean black.
  //
  // If intro.js never loaded, __spnIntroActive is undefined and this runs
  // straight away. The timeout is the third case — the flag was set but
  // the event never came — so a broken intro cannot cost the whole scene.
  let worldStarted = false;
  // Anything that needs a page which is measured, scrollable and fully
  // wired waits here. startWorld can run synchronously — a visitor who has
  // already seen the intro this session never gets one — and that is well
  // before the dialogs below exist, so this cannot be a direct call.
  const afterWorld = [];
  const whenWorldReady = (fn) => (worldStarted ? fn() : afterWorld.push(fn));

  const startWorld = () => {
    if (worldStarted) return;
    worldStarted = true;
    // Order matters: the scroll lock is already off by the time the
    // intro fires its event, so re-measuring here sees the real document.
    const scroll = getLenis();
    scroll?.resize();
    scroll?.start();

    // Measure again once everything that changes page height has settled.
    // Lenis caches scroll limits, and a limit captured before webfonts
    // swap or the work posters lay out is a limit that no longer matches
    // the page.
    window.addEventListener("load", () => getLenis()?.resize(), { once: true });
    document.fonts?.ready?.then(() => getLenis()?.resize()).catch(() => {});

    const director = mountSceneDirector();
    bindFacetToServices(director);
    bindPlanetToContact(director);
    ScrollTrigger.refresh();

    afterWorld.splice(0).forEach((fn) => fn());
  };

  if (window.__spnIntroActive) {
    window.addEventListener("spn:intro-done", startWorld, { once: true });
    setTimeout(() => {
      // The intro normally clears this itself. If it hung, the page is
      // still scroll-locked, and refreshing ScrollTrigger against a page
      // that cannot scroll measures every trigger against a max of zero.
      document.documentElement.classList.remove("intro-active");
      window.__spnIntroActive = false;
      startWorld();
    }, 8000);
  } else {
    startWorld();
  }

  // Safety net, not a diagnosis.
  //
  // A stale Lenis measurement leaves the wheel and trackpad completely
  // dead while the scrollbar still works, because the scrollbar drives
  // native scroll and everything else goes through Lenis. That exact
  // failure has been reported on desktop and could not be reproduced
  // here, so rather than leave a visitor on a page they cannot scroll,
  // watch for the signature — a wheel gesture that moves nothing on a
  // document that is clearly scrollable — and re-measure once.
  let wheelProbe = 0;
  window.addEventListener("wheel", () => {
    const before = window.scrollY;
    clearTimeout(wheelProbe);
    wheelProbe = setTimeout(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const atBottom = before >= max - 2;
      if (max > 50 && !atBottom && window.scrollY === before) getLenis()?.resize();
    }, 200);
  }, { passive: true });

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
  const services = initServices({ onOrder: (product) => orderDialog.open(product) });

  // /websites/ sells four packages and every one of its buttons links to
  // /?order=Website%20Basic and friends; booking.html redirects to
  // /?order=Custom%20Project; the Visual Lab articles link to
  // /?service=Logo%20Design#services. Nothing on this page had ever read
  // either parameter, so all of them landed on the homepage and stopped —
  // the packages page's only call to action did nothing at all.
  //
  // Deferred like the deep link: opening a modal underneath the intro
  // overlay would put the form somewhere the visitor cannot reach it.
  whenWorldReady(() => {
    // The hash first, so the page is already at the right section behind
    // whatever opens on top of it. Read after ScrollTrigger's refresh, so
    // the offset comes off the final layout rather than a stale one.
    if (deepLinkTarget) {
      const top = deepLinkTarget.getBoundingClientRect().top + window.scrollY;
      const scroll = getLenis();
      // force, because Lenis declines a scrollTo issued this soon after
      // start(); immediate, because the visitor asked for a destination,
      // not a nine-thousand-pixel journey to it.
      if (scroll) scroll.scrollTo(top, { immediate: true, force: true });
      else window.scrollTo(0, top);
    }

    const params = new URLSearchParams(location.search);
    const order = params.get("order");
    if (order) {
      // billing only comes from the website packages, where it is the
      // difference between the monthly and the yearly price.
      const billing = params.get("billing");
      orderDialog.open(order, { billing: billing === "yearly" || billing === "monthly" ? billing : "" });
      return;
    }
    // ?service= carries #services with it, so the visitor is already
    // looking at the right section; this opens the one they came for.
    const service = params.get("service");
    if (service) services.openProduct(service);
  });

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
