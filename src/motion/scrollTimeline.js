import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// The single authoritative scroll/motion system for the whole site.
//
// Everything that used to compute its own scroll progress independently
// (the old app.js depth layers, cinematic-journey.js's chapter engine,
// cosmic-flight.js's internal scroll listener) is retired. Lenis owns the
// actual scroll position; GSAP's ticker drives Lenis's raf loop; Lenis
// reports back into ScrollTrigger.update. Every scroll-linked effect on the
// page — planet state, typography, parallax, pinned scenes — is a
// ScrollTrigger instance, so there is exactly one source of truth for
// "how far through the journey are we."
let lenis = null;
let started = false;

export function createMasterScroll({ reduceMotion = false } = {}) {
  if (started) return lenis;
  started = true;

  lenis = new Lenis({
    duration: reduceMotion ? 0.1 : 1.15,
    smoothWheel: !reduceMotion,
    syncTouch: false, // native touch scroll on mobile — smoothed inertia is a desktop-input feel, not a touch one
    autoRaf: false
  });

  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  ScrollTrigger.defaults({ scroller: window });

  return lenis;
}

export function getLenis() {
  return lenis;
}

export { gsap, ScrollTrigger };
