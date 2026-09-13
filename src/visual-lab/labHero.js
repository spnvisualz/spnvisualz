import { createRenderer } from "../three/createRenderer.js";
import { assessDeviceTier } from "../three/deviceTier.js";
import { LabSpecimen } from "../three/scenes/LabSpecimen.js";
import { LabField } from "../three/scenes/LabField.js";

// Visual Lab hero — the specimen under observation.
//
// This page is one of the static sub-sites, so it deliberately does not pull
// in the homepage's Lenis/GSAP/ScrollTrigger stack for what is a single
// section of motion. Scroll and pointer are read directly and folded into the
// existing render loop, which keeps the Lab's JS payload to three.js plus
// this file.
//
// It does reuse `createRenderer` and `assessDeviceTier` rather than
// re-implementing them: resize, visibility pausing, context-loss recovery and
// the capability tiers are all decisions the homepage already made, and the
// Lab should not quietly disagree with any of them.

// A fixed vertical FOV frames a fixed object very differently as aspect
// changes — the same reasoning (and the same reference frame) as
// SceneDirector: pull the camera back on narrow viewports instead of letting
// the shell crop.
const REFERENCE_ASPECT = 1440 / 900;
const BASE_DISTANCE = 9.4;

// The sweep rests between passes. A continuously travelling band reads as a
// loading spinner; one measured pass every few seconds reads as an
// instrument taking a reading.
const SCAN_PERIOD = 7.2;
const SCAN_TRAVEL = 2.6;
const SCAN_PARKED = 12;

// gl_PointSize is in physical pixels before the per-point scale and distance
// attenuation are applied. Large values turn the shell into bokeh haze that
// swallows the specimen behind it.
const SPRITE_SIZE = 105;

// On a wide viewport the specimen is pushed right so the headline keeps a
// clear column. Below that the layout stacks, and the object moves up into
// the empty band above the type instead of sitting behind the paragraph.
const OFFSET_ASPECT = 1.1;
const OFFSET_X = 1.85;
const NARROW_LIFT = 3.6;

// Distance compensation has to stop somewhere. On a tall phone canvas the raw
// reference/aspect ratio is ~3.5, which frames the shell perfectly by width
// and leaves it a pebble in the middle of the screen. Capping it trades a
// little horizontal margin for an object you can actually see.
const MAX_DISTANCE_SCALE = 2;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smoothstep = (t) => t * t * (3 - 2 * t);

// `knownTier` lets the caller pass the assessment it already made. main.js
// has to run the tier check before importing this module at all (that check
// is what decides whether the Three.js chunk is worth downloading), and
// re-running it here would create a second WebGL context just to throw it
// away.
export function mountLabHero(knownTier) {
  const canvas = document.querySelector("[data-lab-canvas]");
  if (!canvas) return null;

  const tier = knownTier || assessDeviceTier();
  if (tier.tier === "minimal") {
    // The CSS fallback (a still, styled orbit) is already in the markup and
    // becomes visible on this class — nothing here needs to draw it.
    document.documentElement.classList.add("lab-no-webgl");
    return { tier };
  }

  const reduceMotion = tier.reduceMotion;
  const { renderer, scene, camera, onTick, dispose } = createRenderer({
    canvas,
    maxDpr: tier.maxDpr
  });

  camera.fov = 34;
  camera.updateProjectionMatrix();

  const specimen = new LabSpecimen({
    detail: tier.tier === "full" ? 2 : 1,
    reduceMotion
  });
  scene.add(specimen.mesh);

  const field = new LabField({
    count: tier.tier === "full" ? 2400 : 1000,
    size: SPRITE_SIZE,
    reduceMotion
  });
  scene.add(field.points);

  document.documentElement.classList.add("lab-webgl");

  let pointerX = 0;
  let pointerY = 0;
  let targetPointerX = 0;
  let targetPointerY = 0;
  let scrollProgress = 0;
  let reveal = reduceMotion ? 1 : 0;
  let pulse = 0;
  let currentEnergy = 0.3;
  let sweepCount = 0;
  let sweepArmed = true;

  const readScroll = () => {
    scrollProgress = clamp(window.scrollY / Math.max(1, window.innerHeight), 0, 1);
  };
  readScroll();
  addEventListener("scroll", readScroll, { passive: true });

  const finePointer = matchMedia("(pointer: fine)").matches;
  if (finePointer && !reduceMotion) {
    addEventListener(
      "pointermove",
      (event) => {
        targetPointerX = event.clientX / Math.max(1, innerWidth) - 0.5;
        targetPointerY = event.clientY / Math.max(1, innerHeight) - 0.5;
      },
      { passive: true }
    );
    addEventListener(
      "pointerleave",
      () => {
        targetPointerX = 0;
        targetPointerY = 0;
      },
      { passive: true }
    );
  }

  onTick((dt, elapsed) => {
    // Point sprites are sized in physical pixels, so the same uSize would be
    // half as large on a 2x screen. Re-reading the ratio each frame keeps the
    // shell consistent when a window moves between displays.
    field.setSize(SPRITE_SIZE * renderer.getPixelRatio());

    if (reveal < 1) {
      reveal = Math.min(1, reveal + dt / 1.9);
    }
    const revealEase = smoothstep(reveal);
    specimen.setReveal(revealEase);
    field.setReveal(revealEase);

    // Critically damped-ish follow. Framerate-independent so the parallax
    // feels the same at 60 and 120Hz.
    const follow = 1 - Math.exp(-dt * 3.4);
    pointerX += (targetPointerX - pointerX) * follow;
    pointerY += (targetPointerY - pointerY) * follow;

    pulse = Math.max(0, pulse - dt * 1.3);

    const energy = clamp(
      0.3 + Math.hypot(pointerX, pointerY) * 0.5 + pulse * 0.6 - scrollProgress * 0.22,
      0,
      1.1
    );
    specimen.setEnergy(energy);
    field.setEnergy(energy);
    currentEnergy = energy;

    if (reduceMotion) {
      specimen.setScan(0.25);
      field.setScan(0.25);
    } else {
      const phase = elapsed % SCAN_PERIOD;
      const travel = smoothstep(clamp(phase / SCAN_TRAVEL, 0, 1));
      const sweeping = phase <= SCAN_TRAVEL;
      const scan = sweeping ? -1.9 + travel * 3.8 : SCAN_PARKED;
      specimen.setScan(scan);
      field.setScan(scan);

      // Count completed passes on the falling edge, so the readout can show
      // a real number rather than an invented one.
      if (sweeping) {
        sweepArmed = true;
      } else if (sweepArmed) {
        sweepArmed = false;
        sweepCount += 1;
      }
    }

    specimen.tick(dt, elapsed);
    field.tick(dt, elapsed);

    // The whole assembly tips toward the pointer and sinks as the hero
    // scrolls away, so the section hands off instead of just clipping.
    const tilt = reduceMotion ? 0 : 1;
    scene.rotation.y = pointerX * 0.32 * tilt;
    scene.rotation.x = pointerY * 0.22 * tilt - scrollProgress * 0.12;
    const wide = camera.aspect >= OFFSET_ASPECT;
    scene.position.x = wide ? OFFSET_X : 0;
    scene.position.y = (wide ? 0 : NARROW_LIFT) - scrollProgress * 1.5;

    camera.position.z =
      BASE_DISTANCE *
      clamp(REFERENCE_ASPECT / camera.aspect, 1, MAX_DISTANCE_SCALE);
  });

  return {
    tier,
    // Hovering a topic in the index energises the specimen — the index and
    // the object are the same system, not a list next to a decoration.
    pulse() {
      if (!reduceMotion) pulse = 1;
    },
    // Real scene state, for the hero's instrument readout. Nothing here is
    // simulated — showing invented telemetry would be exactly the kind of
    // decoration this page is trying to get away from.
    getReading() {
      return { energy: currentEnergy, sweeps: sweepCount, tier: tier.tier };
    },
    dispose() {
      removeEventListener("scroll", readScroll);
      specimen.dispose();
      field.dispose();
      dispose();
    }
  };
}
