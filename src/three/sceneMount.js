import { createRenderer } from "./createRenderer.js";
import { Planet } from "./Planet.js";
import { assessDeviceTier } from "./deviceTier.js";
import { initPlanetJourney } from "./planetJourney.js";

export function mountPlanetScene() {
  const canvas = document.getElementById("planetCanvas");
  if (!canvas) return null;

  const tier = assessDeviceTier();

  if (tier.tier === "minimal") {
    document.documentElement.classList.add("no-webgl");
    return { tier };
  }

  const { scene, camera, onTick } = createRenderer({ canvas, maxDpr: tier.maxDpr });
  camera.position.set(0, 0, 7.5);
  camera.fov = 30;
  camera.updateProjectionMatrix();

  const planet = new Planet({
    segments: tier.sphereSegments,
    reduceMotion: tier.reduceMotion
  });
  scene.add(planet.mesh);
  onTick((dt, elapsed) => planet.tick(dt, elapsed));

  return {
    tier,
    planet,
    camera,
    onTick,
    // Deferred: must run after the document's final layout (post work-
    // section height + ScrollTrigger.refresh) is settled — see main.js.
    initJourney: () => initPlanetJourney(planet, { reduceMotion: tier.reduceMotion })
  };
}
