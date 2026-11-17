import { createRenderer } from "./createRenderer.js";
import { assessDeviceTier } from "./deviceTier.js";
import { Orbital, studioEnvironment } from "./scenes/Orbital.js";
import { FacetObject } from "./scenes/FacetObject.js";
import { Starfield } from "./scenes/Starfield.js";
import { gsap, ScrollTrigger, getLenis } from "../motion/scrollTimeline.js";

// The 3D layer, after Selected Work moved into the DOM.
//
// It used to also own a long camera "corridor" that Work's video planes
// lived inside. That coupling is gone: the camera no longer travels, so
// nothing here depends on measuring page height, and there is no way for
// scroll and camera to fall out of step. What remains is atmosphere —
// the hero orbital, the starfield and the Services object —
// each bound to its own section by a plain ScrollTrigger.
//
// A fixed vertical FOV projects a fixed world-space object to very
// different apparent sizes depending on aspect: an object comfortably
// framed at 1440x900 overflows a 390x844 phone, because horizontal FOV
// scales with aspect while vertical FOV stays constant. Every
// distance-from-camera below is scaled by this factor.
const REFERENCE_ASPECT = 1440 / 900;
function distanceScale(camera) {
  return Math.max(1, REFERENCE_ASPECT / camera.aspect);
}

export function mountSceneDirector() {
  const canvas = document.getElementById("worldCanvas");
  if (!canvas) return null;

  const tier = assessDeviceTier();
  if (tier.tier === "minimal") {
    document.documentElement.classList.add("no-webgl");
    return { tier };
  }

  const { renderer, scene, camera, onTick } = createRenderer({ canvas, maxDpr: tier.maxDpr });
  camera.position.set(0, 0, 9);
  camera.fov = 34;
  camera.updateProjectionMatrix();

  // The hero's centrepiece. It sits in the middle of the opening frame
  // and leaves upward, a little slower than the page, as the hero scrolls
  // away — then stops drawing altogether.
  const orbital = new Orbital({ envMap: studioEnvironment(renderer), detail: tier.tier === "full" ? 1 : 0.6 });
  scene.add(orbital.group);
  const hero = { exit: 0 };
  const heroEl = document.querySelector('[data-chapter="origin"]');
  if (heroEl) {
    ScrollTrigger.create({
      trigger: heroEl,
      start: "top top",
      end: "bottom top",
      onUpdate: (self) => (hero.exit = self.progress)
    });
  }

  const stars = new Starfield({
    count: tier.tier === "full" ? 2600 : 1300,
    pixelRatio: Math.min(window.devicePixelRatio || 1, tier.maxDpr || 1)
  });
  scene.add(stars.group);

  const facet = new FacetObject();
  facet.mesh.scale.setScalar(0.001); // hidden until the Services chapter scrubs it in
  scene.add(facet.mesh);


  // Pointer parallax is a mouse affordance only. Pointer Events unify
  // touch and mouse, so without this filter a finger dragged across the
  // screen drove the same camera parallax a mouse does — which fought the
  // scroll-only journey and read as the page being unstable.
  const pointer = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  });

  onTick((dt, elapsed) => {
    const distScale = distanceScale(camera);

    // Frame the orbital: about 60% of the screen height on a landscape
    // screen, fitted to the width on a portrait one, set a little above
    // centre so the wordmark has the bottom of the frame.
    const visibleH = 2 * 9 * Math.tan((camera.fov * Math.PI) / 360);
    const visibleW = visibleH * camera.aspect;
    const fit = Math.min(1, (visibleW * 0.9) / 3.5);
    const exit = hero.exit;
    orbital.group.visible = exit < 0.999;
    if (orbital.group.visible) {
      orbital.group.scale.setScalar(fit * (1 - exit * 0.18));
      orbital.group.position.set(0, visibleH * (camera.aspect < 1 ? 0.04 : 0.05) + exit * visibleH * 0.62, 0);
      orbital.tick(dt, elapsed, { pointer, exit });
    }

    // The journey: scroll position is distance travelled down the
    // tunnel (plus a slow drift so space is never frozen), and scroll
    // speed is warp.
    const lenis = getLenis();
    const scrolled = lenis ? lenis.animatedScroll : window.scrollY;
    stars.tick(dt, elapsed, { travel: scrolled * 0.018 + elapsed * 0.45, velocity: lenis ? lenis.velocity : 0 });

    facet.tick(dt, elapsed);

    camera.position.x = pointer.x * 0.3;
    camera.position.y = pointer.y * 0.18;
    camera.lookAt(0, 0, camera.position.z - 6);

    facet.mesh.position.z = camera.position.z - 5.6 * distScale;
  });

  return { tier, scene, camera, orbital, facet, stars, onTick };
}

export function bindFacetToServices(director) {
  if (!director || !director.facet) return;
  const rows = document.querySelectorAll(".service-row");
  const section = document.querySelector('[data-chapter="services"]');
  if (!section || !rows.length) return;

  // On a narrow viewport the service list runs the full content width —
  // there's no side column for an object the way desktop has — so it
  // needs to sit further out AND smaller, not just further away.
  const distScale = distanceScale(director.camera);
  const xOffset = 1.75 + Math.min(2.2, (distScale - 1) * 1.1);
  const peakScale = 1.02 / Math.sqrt(distScale);

  director.facet.mesh.position.set(xOffset, 0.15, director.camera.position.z - 5.6 * distScale);

  gsap.timeline({
    scrollTrigger: { trigger: section, start: "top bottom", end: "top 40%", scrub: 1 }
  }).to(director.facet.mesh.scale, { x: peakScale, y: peakScale, z: peakScale, ease: "none" });

  gsap.timeline({
    scrollTrigger: { trigger: section, start: "bottom 60%", end: "bottom top", scrub: 1 }
  }).to(director.facet.mesh.scale, { x: 0.001, y: 0.001, z: 0.001, ease: "none" });

  // The row in the middle of the screen drives it while scrolling
  // (motion/scenes.js); hover and focus still take over directly.
  window.addEventListener("spn:service", (e) => director.facet.setService(e.detail.index));

  rows.forEach((row, i) => {
    row.addEventListener("mouseenter", () => director.facet.setService(i));
    row.addEventListener("focus", () => director.facet.setService(i));
  });
}
