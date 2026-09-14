import { createRenderer } from "./createRenderer.js";
import { assessDeviceTier } from "./deviceTier.js";
import { LiquidSurface } from "./scenes/LiquidSurface.js";
import { FacetObject } from "./scenes/FacetObject.js";
import { Planet } from "./Planet.js";
import { gsap, ScrollTrigger } from "../motion/scrollTimeline.js";

// The 3D layer, after Selected Work moved into the DOM.
//
// It used to also own a long camera "corridor" that Work's video planes
// lived inside. That coupling is gone: the camera no longer travels, so
// nothing here depends on measuring page height, and there is no way for
// scroll and camera to fall out of step. What remains is atmosphere —
// the liquid chrome opening, the Services object, the Contact planet —
// each bound to its own section by a plain ScrollTrigger.
//
// A fixed vertical FOV projects a fixed world-space object to very
// different apparent sizes depending on aspect: an object comfortably
// framed at 1440x900 overflows a 390x844 phone, because horizontal FOV
// scales with aspect while vertical FOV stays constant. Every
// distance-from-camera below is scaled by this factor.
const REFERENCE_ASPECT = 1440 / 900;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (t) => t * t * (3 - 2 * t);
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

  const { scene, camera, onTick } = createRenderer({ canvas, maxDpr: tier.maxDpr });
  camera.position.set(0, 0, 9);
  camera.fov = 34;
  camera.updateProjectionMatrix();

  const liquid = new LiquidSurface();
  liquid.mesh.position.set(0, 0, 6.5);
  scene.add(liquid.mesh);

  const facet = new FacetObject();
  facet.mesh.scale.setScalar(0.001); // hidden until the Services chapter scrubs it in
  scene.add(facet.mesh);

  const planet = new Planet({ segments: tier.sphereSegments || 120, reduceMotion: tier.reduceMotion });
  planet.mesh.scale.setScalar(0.001);
  scene.add(planet.mesh);

  // The opening surface used to be faded by comparing camera Z against
  // points along the corridor. Because that range was derived from
  // measured page geometry, its start and end could land anywhere — the
  // surface would come back part-way as you scrolled, reading as the
  // background flickering between violet and black. It is now a single
  // explicit fade across the first screen and nothing else: fully present
  // at the top, completely gone by the time the manifesto has passed, and
  // it never returns.
  //
  // That fixed the range, but not the fade itself: uEnergy only modulates
  // one additive violet term, so the plane stayed at essentially full
  // brightness until `visible` flipped and it vanished in a single frame.
  // Scrubbing across that threshold switched it on and off — the black
  // flicker. The plane now fades on its own alpha (uFade), so the scrub
  // dissolves it into the page background instead of cutting it away.
  //
  // Spreading the fade across the whole opening (origin top -> manifesto
  // bottom) made the surface scroll-reactive everywhere above the fold:
  // any small drag up or down in the hero changed the background
  // brightness, which reads as flickering just as much as a hard cut did
  // (measured: a ~25 point luminance swing every time the scroll
  // direction reversed between y=40 and y=410 on a 402x874 viewport).
  // The fade therefore starts at the manifesto rather than at the top:
  // the hero holds one steady surface no matter how the page is scrubbed,
  // and the dissolve happens once, over the section the reader passes
  // through on the way out.
  const originEl = document.querySelector('[data-chapter="origin"]');
  const manifestoEl = document.querySelector('[data-chapter="manifesto"]');
  let liquidFade = 1;
  const fadeTrigger = manifestoEl || originEl;
  if (fadeTrigger) {
    ScrollTrigger.create({
      trigger: fadeTrigger,
      start: "top top",
      endTrigger: fadeTrigger,
      end: "bottom top",
      scrub: 0.4,
      onUpdate: (self) => {
        liquidFade = 1 - self.progress;
      }
    });
  }

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

  const resize = () => liquid.setResolution(window.innerWidth, window.innerHeight);
  resize();
  window.addEventListener("resize", resize);

  onTick((dt, elapsed) => {
    const distScale = distanceScale(camera);

    // Ease the raw scrub so the surface leaves gently at both ends rather
    // than tapering at a constant rate into nothing.
    const fade = smoothstep(clamp01(liquidFade));

    // Only skip the draw once the plane is genuinely invisible. The old
    // cutoff (0.01) was high enough to be seen going out; at this level
    // the last drawn frame is already indistinguishable from the
    // background, so switching it off cannot register as a pop.
    liquid.mesh.visible = fade > 0.0005;
    if (liquid.mesh.visible) {
      liquid.setPointer(pointer.x, pointer.y);
      liquid.setFade(fade);
      liquid.setEnergy(0.5 * fade);
      liquid.mesh.scale.setScalar(1 + (1 - fade) * 0.35);
      liquid.tick(dt, elapsed);
    }

    facet.tick(dt, elapsed);
    planet.tick(dt, elapsed);

    camera.position.x = pointer.x * 0.3;
    camera.position.y = pointer.y * 0.18;
    camera.lookAt(0, 0, camera.position.z - 6);

    facet.mesh.position.z = camera.position.z - 5.6 * distScale;
    planet.mesh.position.z = camera.position.z - 4 * distScale;
  });

  return { tier, scene, camera, liquid, facet, planet, onTick };
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
  const xOffset = 2.1 + Math.min(2.2, (distScale - 1) * 1.1);
  const peakScale = 1.3 / Math.sqrt(distScale);

  director.facet.mesh.position.set(xOffset, 0.15, director.camera.position.z - 5.6 * distScale);

  gsap.timeline({
    scrollTrigger: { trigger: section, start: "top bottom", end: "top 40%", scrub: 1 }
  }).to(director.facet.mesh.scale, { x: peakScale, y: peakScale, z: peakScale, ease: "none" });

  gsap.timeline({
    scrollTrigger: { trigger: section, start: "bottom 60%", end: "bottom top", scrub: 1 }
  }).to(director.facet.mesh.scale, { x: 0.001, y: 0.001, z: 0.001, ease: "none" });

  rows.forEach((row, i) => {
    row.addEventListener("mouseenter", () => director.facet.setService(i));
    row.addEventListener("focus", () => director.facet.setService(i));
  });
}

export function bindPlanetToContact(director) {
  if (!director || !director.planet) return;
  const section = document.querySelector('[data-chapter="contact"]');
  if (!section) return;

  const distScale = distanceScale(director.camera);
  const xOffset = 2.4 + Math.min(2.2, (distScale - 1) * 1.1);
  const peakScale = 1 / Math.sqrt(distScale);

  director.planet.mesh.position.set(xOffset, -0.1, director.camera.position.z - 4 * distScale);

  gsap.timeline({
    scrollTrigger: { trigger: section, start: "top bottom", end: "top 45%", scrub: 1 }
  }).to(director.planet.mesh.scale, { x: peakScale, y: peakScale, z: peakScale, ease: "none" });
}
