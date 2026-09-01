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

  const workField = new WorkField(PROJECTS, { spacing: WORK_SPACING, startZ: -2 });
  scene.add(workField.group);

  const facet = new FacetObject();
  facet.mesh.scale.setScalar(0.001); // hidden until Services chapter scrubs it in
  scene.add(facet.mesh);

  const planet = new Planet({ segments: tier.sphereSegments || 120, reduceMotion: tier.reduceMotion });
  planet.mesh.scale.setScalar(0.001);
  scene.add(planet.mesh);

  const originEl = document.querySelector('[data-chapter="origin"]');
  const workEl = document.querySelector('[data-chapter="work"]');
  const rig = new WorldRig({
    camera,
    startTrigger: originEl,
    endTrigger: workEl,
    zEnd: -2 - (PROJECTS.length - 1) * WORK_SPACING - 4
  });

  let pointer = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  });

  const resize = () => liquid.setResolution(window.innerWidth, window.innerHeight);
  resize();
  window.addEventListener("resize", resize);

  onTick((dt, elapsed) => {
    liquid.setPointer(pointer.x, pointer.y);
    liquid.tick(dt, elapsed);
    workField.update(camera.position.z);
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
    facet.mesh.position.z = camera.position.z - 5.6;
    planet.mesh.position.z = camera.position.z - 4;
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
