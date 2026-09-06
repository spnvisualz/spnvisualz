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

  // A dozen large video/planet/shader textures is real pressure on a phone
  // GPU — losing the WebGL context there (driver reset, memory pressure)
  // otherwise leaves the canvas permanently frozen on its last frame with
  // no error and no way for the page to recover on its own, which reads
  // exactly like "the site is stuck/unstable" from the outside. There's no
  // way to safely resume the same scene mid-session (every texture/buffer
  // is gone), so the honest recovery is a reload — jarring once, but a
  // world better than a dead canvas that never comes back.
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    console.error("[createRenderer] WebGL context lost — reloading");
    window.location.reload();
  });

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
    // A single tickFn throwing used to abort the whole frame before
    // renderer.render() ran — the next rAF still fired, but hit the same
    // exception every time, so the canvas silently froze on its last good
    // frame forever while the page kept scrolling normally around it
    // (reported live as "stuck on last work preview"). Isolating each
    // tickFn means one bad frame in one system can't take the whole scene
    // down with it.
    for (const fn of tickFns) {
      try {
        fn(dt, now / 1000);
      } catch (err) {
        console.error("[createRenderer] tick error", err);
      }
    }
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
