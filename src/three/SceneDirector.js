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

// The opening surface: one value, two renderings.
//
// This is the fourth attempt at this transition, and the previous three
// all worked on the wrong layer. They tuned when and how the WebGL plane
// left — switch it off, fade its alpha, hold it then dissolve it, paint
// it opaque and mix toward the page colour — while the thing revealed
// underneath stayed --bg (#030207), all but black. So every one of them
// still had a black background one dropped frame away, and no amount of
// easing on the plane could change that.
//
// The surface is CSS now (body::before), and the plane draws on top of
// it. This function owns the only number either layer reads:
//
//   1 -> the surface at full strength, chrome at full strength
//   0 -> both arrived at --bg, together, on the same frame
//
// Because it is one number and not two curves, they cannot disagree, and
// because the CSS half needs no canvas, nothing about WebGL's health can
// take the background away.
//
// Where it moves is deliberate, and unchanged from what the last attempt
// settled on: nothing above Selected Work touches it. Scrubbing anywhere
// in the hero or the manifesto — up, down, a flicked thumb, a trackpad
// bounce — leaves the surface at exactly 1, so the opening cannot be
// made to change brightness at all. The dissolve begins only once Work
// reaches the top of the viewport and is spent over the screen-height of
// scrolling that carries it up.
function bindOpeningSurface() {
  const root = document.documentElement;
  let presence = 1;

  const set = (value) => {
    presence = value;
    // Four decimals: enough that the scrub reads continuous, few enough
    // that we are not writing a new string to the style attribute for
    // changes below the display's ability to show them.
    root.style.setProperty("--surface-presence", value.toFixed(4));
  };

  set(1);

  const trigger =
    document.querySelector('[data-chapter="work"]') ||
    document.querySelector('[data-chapter="origin"]');

  if (trigger) {
    ScrollTrigger.create({
      trigger,
      start: "top top",
      // A function so the distance re-resolves against the viewport on
      // every refresh (orientation change), instead of baking in the
      // height the page happened to load at.
      end: () => "+=" + Math.round(window.innerHeight * 0.8),
      scrub: 0.4,
      // Eased here, once, so the surface leaves gently at both ends
      // rather than tapering at a constant rate into nothing.
      onUpdate: (self) => set(smoothstep(clamp01(1 - self.progress)))
    });
  }

  return { presence: () => presence };
}

export function mountSceneDirector() {
  const canvas = document.getElementById("worldCanvas");
  if (!canvas) return null;

  // Bound before the tier check, because the surface is not the canvas's
  // to own. It is painted in CSS (body::before in base.css) and it is the
  // background on every device — including the ones that never get a
  // canvas at all. Driving it here, above the bail-out, is what makes the
  // opening read identically whether or not WebGL ever starts.
  const surface = bindOpeningSurface();

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

    // The same number the CSS surface is set to, read rather than
    // recomputed — the plane and the surface behind it are two renderings
    // of one value, so there is no second curve to drift out of step.
    const fade = surface.presence();

    // Skipped only at exactly zero, where the plane and the surface have
    // both arrived at --bg and dropping it changes nothing on screen. Any
    // threshold above zero is a frame that stops being drawn while it is
    // still meant to be visible, which is what showed as black.
    liquid.mesh.visible = fade > 0;
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
