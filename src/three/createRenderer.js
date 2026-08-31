import { PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from "three";

// Shared renderer/scene/camera foundation. Owns resize + visibility +
// disposal so nothing that mounts this has to reimplement it — the current
// site's engine hand-rolls this once per canvas; centralizing it here is
// what makes a multi-chapter, multi-scene planet maintainable.
export function createRenderer({ canvas, maxDpr = 2, alpha = true } = {}) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 8);

  let width = 1;
  let height = 1;
  let visible = true;
  let raf = 0;
  let lastTime = performance.now();
  const tickFns = new Set();

  const resize = () => {
    const host = canvas.parentElement || canvas;
    const rect = host.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement || canvas);
  resize();

  const visibilityObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) visible = entry.isIntersecting;
    },
    { threshold: 0 }
  );
  visibilityObserver.observe(canvas);

  const onVisibilityChange = () => {
    if (document.hidden) visible = false;
    else resize();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    if (!visible) return;
    for (const fn of tickFns) fn(dt, now / 1000);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  return {
    renderer,
    scene,
    camera,
    onTick(fn) {
      tickFns.add(fn);
      return () => tickFns.delete(fn);
    },
    dispose() {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      renderer.dispose();
    }
  };
}
