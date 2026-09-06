import { createRenderer } from "./three/createRenderer.js";
import { Planet } from "./three/Planet.js";
import { assessDeviceTier } from "./three/deviceTier.js";

const canvas = document.getElementById("planetCanvas");
const hud = document.getElementById("hud");
const tierInfo = assessDeviceTier();

if (tierInfo.tier === "minimal") {
  hud.textContent = `SPN-1 · fallback tier (${tierInfo.reason}) — planet lab shows WebGL only`;
} else {
  const { scene, camera, onTick } = createRenderer({
    canvas,
    maxDpr: tierInfo.maxDpr
  });

  camera.position.set(0, 0, 7);

  const planet = new Planet({
    segments: tierInfo.sphereSegments,
    reduceMotion: tierInfo.reduceMotion
  });
  scene.add(planet.mesh);

  onTick((dt, elapsed) => planet.tick(dt, elapsed));

  hud.textContent = `SPN-1 · tier: ${tierInfo.tier} (${tierInfo.reason}) · segments: ${tierInfo.sphereSegments} · dpr cap: ${tierInfo.maxDpr}`;
}
