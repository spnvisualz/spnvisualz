import { createRenderer } from "./three/createRenderer.js";
import { LiquidSurface } from "./three/scenes/LiquidSurface.js";

const canvas = document.getElementById("liquidCanvas");
const { scene, camera, onTick } = createRenderer({ canvas, maxDpr: 2 });
camera.position.set(0, 0, 3.6);

const surface = new LiquidSurface();
surface.setResolution(window.innerWidth, window.innerHeight);
scene.add(surface.mesh);

window.addEventListener("resize", () => surface.setResolution(window.innerWidth, window.innerHeight));
window.addEventListener("pointermove", (e) => {
  const x = (e.clientX / window.innerWidth) * 2 - 1;
  const y = -((e.clientY / window.innerHeight) * 2 - 1);
  surface.setPointer(x, y);
});

onTick((dt, elapsed) => surface.tick(dt, elapsed));
