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

  // Losing the context (driver reset, memory pressure on a phone GPU)
  // used to reload the whole page, because a dead canvas *was* a dead
  // background — there was nothing behind it but black. Now the surface
  // is painted in CSS, so the honest response is to step off the canvas
  // and let that surface stand: the page keeps its colour, its scroll
  // position and its state, and loses only the motion. If the browser
  // hands the context back, pick it up again.
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    contextLost = true;
    document.documentElement.classList.add("no-webgl");
  });

  canvas.addEventListener("webglcontextrestored", () => {
    contextLost = false;
    document.documentElement.classList.remove("no-webgl");
    resize();
  });

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 8);

  let width = 1;
  let height = 1;
  // Two independent reasons to stop drawing, tracked separately. They
  // used to share one `visible` flag, and that flag was the bug: going
  // to another tab set it false, and nothing ever set it back. Only the
  // IntersectionObserver did, and a position:fixed inset:0 canvas never
  // leaves the viewport, so it had no crossing left to report. Coming
  // back to the tab therefore found a render loop that returned early
  // forever — the scene frozen, and (with preserveDrawingBuffer false)
  // the buffer free to be dropped, leaving a transparent canvas over a
  // black page with no way back but a reload.
  let inViewport = true;
  let pageVisible = !document.hidden;
  let contextLost = false;
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
      for (const entry of entries) inViewport = entry.isIntersecting;
    },
    { threshold: 0 }
  );
  visibilityObserver.observe(canvas);

  const onVisibilityChange = () => {
    pageVisible = !document.hidden;
    if (!pageVisible) return;
    // rAF is throttled or stopped while hidden, so `now` has run far
    // ahead of the last frame we drew. Re-anchor the clock before
    // resuming or the first frame back integrates the whole time away.
    lastTime = performance.now();
    resize();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    if (!inViewport || !pageVisible || contextLost) return;
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
