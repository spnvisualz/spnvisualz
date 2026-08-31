import { gsap, ScrollTrigger } from "../motion/scrollTimeline.js";

// Chapter states for SPN-1. Each chapter section drives the planet's
// position/scale/spin/energy via a scrubbed ScrollTrigger timeline, so the
// planet is a continuously choreographed participant in the journey rather
// than a static hero decoration. Numbers are in the planet group's local
// units (radius 1 sphere); x/y are roughly NDC-ish given the fixed camera.
const CHAPTER_STATES = {
  origin:   { x: 1.35, y: 0.05, z: 0,     scale: 1.05, spin: 1,    energy: 0.5  },
  studio:   { x: 2.6,  y: 0.3,  z: -2.2,  scale: 0.55, spin: 0.6,  energy: 0.22 },
  work:     { x: -2.7, y: -0.2, z: -1.2,  scale: 0.7,  spin: 1.4,  energy: 0.85 },
  services: { x: -1.7, y: 0.55, z: -1.1,  scale: 0.4,  spin: 0.5,  energy: 0.32 },
  pricing:  { x: 3.85, y: -0.85,z: -1.2,  scale: 0.3,  spin: 0.5,  energy: 0.28 },
  process:  { x: 0,    y: 1.6,  z: -2.8,  scale: 0.26, spin: 0.4,  energy: 0.25 },
  lab:      { x: -3.4, y: 1.3,  z: -1.8,  scale: 0.38, spin: 0.9,  energy: 0.6  },
  contact:  { x: 0,    y: 0,    z: 0.6,   scale: 1.25, spin: 1.1,  energy: 1    }
};

export function initPlanetJourney(planet, { reduceMotion = false } = {}) {
  if (!planet) return;

  const state = { x: CHAPTER_STATES.origin.x, y: CHAPTER_STATES.origin.y, z: CHAPTER_STATES.origin.z, scale: CHAPTER_STATES.origin.scale, energy: CHAPTER_STATES.origin.energy };
  planet.mesh.position.set(state.x, state.y, state.z);
  planet.mesh.scale.setScalar(state.scale);
  planet.setEnergy(state.energy);
  planet.spinMultiplier = CHAPTER_STATES.origin.spin;

  const chapters = Array.from(document.querySelectorAll("[data-chapter]"));
  const hudName = document.getElementById("hudName");
  const hudIndex = document.getElementById("hudIndex");
  const hudProgress = document.getElementById("hudProgress");
  const hud = document.getElementById("signalHud");

  chapters.forEach((section, i) => {
    const key = section.dataset.chapter;
    const target = CHAPTER_STATES[key];
    if (!target) return;

    ScrollTrigger.create({
      trigger: section,
      start: "top center",
      end: "bottom center",
      onEnter: () => setChapterHud(section, i),
      onEnterBack: () => setChapterHud(section, i)
    });

    // spin/rotation-speed is applied discretely on chapter entry (see
    // setChapterHud below), not continuously scrubbed like position/scale —
    // strip it before handing the rest to GSAP as tween targets.
    const { spin, ...tweenTarget } = target;

    if (reduceMotion) {
      // Reduced motion: chapter states still change (so the planet stays
      // "alive" across the journey per brief), just via a cross-fade
      // instead of scroll-scrubbed movement.
      ScrollTrigger.create({
        trigger: section,
        start: "top 60%",
        onEnter: () => gsap.to(state, { ...tweenTarget, duration: 0.8, ease: "power2.out", onUpdate: applyState }),
        onEnterBack: () => gsap.to(state, { ...tweenTarget, duration: 0.8, ease: "power2.out", onUpdate: applyState })
      });
      return;
    }

    // The planet arrives at its chapter state during the approach to the
    // section and then holds there — it must never still be mid-transition
    // (and potentially drifting across readable content) while someone is
    // actually reading that chapter.
    gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top bottom",
        end: "top 55%",
        scrub: 1.1
      }
    }).to(state, { ...tweenTarget, ease: "none", onUpdate: applyState }, 0);
  });

  function applyState() {
    planet.mesh.position.set(state.x, state.y, state.z);
    planet.mesh.scale.setScalar(state.scale);
    planet.setEnergy(state.energy);
  }

  function setChapterHud(section, index) {
    const key = section.dataset.chapter;
    const target = CHAPTER_STATES[key];
    if (target) planet.spinMultiplier = target.spin;
    if (hudName) hudName.textContent = section.dataset.chapterName || key;
    if (hudIndex) hudIndex.textContent = String(index + 1).padStart(2, "0");
    // The origin chapter already has its own footer row in that exact
    // corner — the HUD only announces itself once the journey has actually
    // moved past it, so the two never compete for the same 24px corner.
    if (hud) hud.classList.toggle("is-visible", key !== "origin");
  }

  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate(self) {
      if (hudProgress) hudProgress.style.width = `${(self.progress * 100).toFixed(1)}%`;
      const pageProgress = document.getElementById("pageProgress")?.firstElementChild;
      if (pageProgress) pageProgress.style.transform = `scaleX(${self.progress})`;
    }
  });
}
