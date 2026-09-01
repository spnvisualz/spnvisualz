import { createRenderer } from "./createRenderer.js";
import { assessDeviceTier } from "./deviceTier.js";
import { LiquidSurface } from "./scenes/LiquidSurface.js";
import { WorkField } from "./scenes/WorkField.js";
import { FacetObject } from "./scenes/FacetObject.js";
import { Planet } from "./Planet.js";
import { WorldRig } from "./WorldRig.js";
import { gsap } from "../motion/scrollTimeline.js";
import { PROJECTS } from "../work/projects.js";

const WORK_SPACING = 6.2;

// A fixed vertical FOV projects a fixed world-space object to very
// different apparent screen sizes depending on aspect ratio: the same
// panel that's comfortably framed at 1440x900 (aspect 1.6) overflows both
// edges of a 390x844 phone (aspect 0.46), because horizontal FOV scales
// with aspect while vertical FOV stays constant. Rather than hand-tune
// separate mobile positions, every distance-from-camera in this file is
// scaled by this factor — pushing objects proportionally further back
// on narrow viewports keeps their apparent size (and, as a side effect,
// their apparent lateral offset from center) consistent across aspects.
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

  const { scene, camera, onTick } = createRenderer({ canvas, maxDpr: tier.maxDpr });
  camera.position.set(0, 0, 9);
  camera.fov = 34;
  camera.updateProjectionMatrix();

  const liquid = new LiquidSurface();
  liquid.mesh.position.set(0, 0, 6.5);
  scene.add(liquid.mesh);

  // On a narrow/portrait viewport there's no room for a "gallery wall" of
  // simultaneously-visible neighbors the way there is on desktop — rather
  // than fight that with steeper opacity/scale falloff curves alone
  // (tried first; a panel a fraction off dead-center still read as
  // cluttered with 5-6 others peeking in), physically space panels
  // further apart in the corridor so neighbors are further away and
  // naturally recede more.
  const mountDistScale = distanceScale(camera);
  const workSpacing = WORK_SPACING * mountDistScale;
  const lateralSpread = Math.max(0.15, 1 / mountDistScale);

  const originEl = document.querySelector('[data-chapter="origin"]');
  const manifestoEl = document.querySelector('[data-chapter="manifesto"]');
  const workEl = document.querySelector('[data-chapter="work"]');

  // The first work panel must not become visually prominent before the
  // Origin+Manifesto text has actually scrolled out of the viewport, or
  // the two overlap into an illegible mess — reported live: the manifesto
  // line and a Selected Work panel both fully on screen at once. startZ
  // was a flat -2 regardless of how tall Origin+Manifesto actually render;
  // on any viewport where that text takes more than ~17% of the corridor's
  // total scroll distance (it usually does), the camera reached the first
  // panel before the text cleared. Solve for startZ instead, from the
  // real measured DOM heights and the real corridor length, so there's
  // always a comfortable buffer regardless of viewport size or content
  // length changes later.
  const leadInPixels = (originEl?.offsetHeight || 0) + (manifestoEl?.offsetHeight || 0);
  const corridorPixels = Math.max(
    1,
    (workEl?.offsetTop || 0) + (workEl?.offsetHeight || 0) - (originEl?.offsetTop || 0) - window.innerHeight
  );
  const leadInFraction = Math.min(0.55, (leadInPixels / corridorPixels) * 1.55);

  const zCameraStart = camera.position.z;
  const corridorDepthSpan = (PROJECTS.length - 1) * workSpacing + 4 * mountDistScale;
  const k = leadInFraction;
  const startZ = zCameraStart - (k * corridorDepthSpan) / (1 - k);
  const zEnd = startZ - corridorDepthSpan;

  const workField = new WorkField(PROJECTS, { spacing: workSpacing, startZ, lateralSpread });
  scene.add(workField.group);

  const facet = new FacetObject();
  facet.mesh.scale.setScalar(0.001); // hidden until Services chapter scrubs it in
  scene.add(facet.mesh);

  const planet = new Planet({ segments: tier.sphereSegments || 120, reduceMotion: tier.reduceMotion });
  planet.mesh.scale.setScalar(0.001);
  scene.add(planet.mesh);

  const rig = new WorldRig({ camera, startTrigger: originEl, endTrigger: workEl, zEnd });

  let pointer = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  });

  const resize = () => liquid.setResolution(window.innerWidth, window.innerHeight);
  resize();
  window.addEventListener("resize", resize);

  onTick((dt, elapsed) => {
    const distScale = distanceScale(camera);
    liquid.setPointer(pointer.x, pointer.y);
    liquid.tick(dt, elapsed);
    // The focus point must sit closer to the camera than half a panel's
    // spacing, or a neighboring panel can end up physically nearer the
    // camera than the "active" one — it then renders larger on screen
    // despite a lower depth-cueing scale, since screen size follows real
    // camera distance, not the cueing multiplier. (Caught by comparing
    // workField.items' actual depths against camera.position.z at runtime
    // — the mismatch wasn't visible in the scale numbers alone.)
    workField.update(camera.position.z, -workSpacing * 0.42, Math.sqrt(distScale));
    facet.tick(dt, elapsed);
    planet.tick(dt, elapsed);

    // Camera always looks toward the work field's lateral center, with a
    // gentle pointer-driven parallax on desktop for a "looking around" feel.
    camera.position.x = pointer.x * 0.35;
    camera.position.y = pointer.y * 0.2;
    camera.lookAt(0, 0, camera.position.z - 6);

    // Fade the liquid surface out as the rig leaves the Origin chapter so
    // it doesn't linger, ghost-like, behind the Work planes.
    const fadeStart = rig.zAt(0);
    const fadeEnd = rig.zAt(0.22);
    const fade = 1 - Math.min(1, Math.max(0, (fadeStart - camera.position.z) / (fadeStart - fadeEnd)));
    liquid.mesh.visible = fade > 0.01;

    // The camera is parked (WorldRig only drives Origin->Work) for every
    // chapter after Work, so later objects just track wherever it settled.
    // This is the single writer for their Z position — GSAP only ever
    // tweens their scale, never their position, so there's no risk of two
    // systems fighting over the same property (see git history: an earlier
    // version tweened both and the position tween silently won every
    // frame, freezing the facet at its bind-time camera Z instead of the
    // final parked one).
    facet.mesh.position.z = camera.position.z - 5.6 * distScale;
    planet.mesh.position.z = camera.position.z - 4 * distScale;
  });

  return { tier, scene, camera, rig, liquid, workField, facet, planet, onTick };
}

export function bindFacetToServices(director) {
  if (!director) return;
  const rows = document.querySelectorAll(".service-row");
  const section = document.querySelector('[data-chapter="services"]');
  if (!section || !rows.length) return;

  director.facet.mesh.position.set(2.1, 0.15, director.camera.position.z - 5.6);

  gsap.timeline({
    scrollTrigger: { trigger: section, start: "top bottom", end: "top 40%", scrub: 1 }
  }).to(director.facet.mesh.scale, { x: 1.3, y: 1.3, z: 1.3, ease: "none" });

  gsap.timeline({
    scrollTrigger: { trigger: section, start: "bottom 60%", end: "bottom top", scrub: 1 }
  }).to(director.facet.mesh.scale, { x: 0.001, y: 0.001, z: 0.001, ease: "none" });

  rows.forEach((row, i) => {
    row.addEventListener("mouseenter", () => director.facet.setService(i));
    row.addEventListener("focus", () => director.facet.setService(i));
  });
}

export function bindPlanetToContact(director) {
  if (!director) return;
  const section = document.querySelector('[data-chapter="contact"]');
  if (!section) return;

  director.planet.mesh.position.set(2.4, -0.1, director.camera.position.z - 4);

  gsap.timeline({
    scrollTrigger: { trigger: section, start: "top bottom", end: "top 45%", scrub: 1 }
  }).to(director.planet.mesh.scale, { x: 1, y: 1, z: 1, ease: "none" });
}
