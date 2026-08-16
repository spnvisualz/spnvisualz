(() => {
  "use strict";

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touchDevice = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1;
  const touchLandscape = () => touchDevice && (matchMedia("(orientation: landscape)").matches || innerWidth > innerHeight);
  const root = document.documentElement;
  const chapterName = document.getElementById("journeyChapterName");
  const chapterIndex = document.getElementById("journeyChapterIndex");
  const chapterCount = document.getElementById("journeyChapterCount");
  const journeyProgress = document.getElementById("journeyProgress");

  const definitions = [
    ["#top", "Origin"],
    [".manifesto", "Studio"],
    ["#work", "Selected work"],
    ["#services", "Services"],
    ["#pricing", "Pricing"],
    [".process", "Process"],
    ["#visual-lab", "Visual Lab"],
    ["#contact", "Contact"]
  ];

  const scenes = definitions.map(([selector, name], index) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    element.classList.add("journey-scene");
    const host = selector === "#work" ? element.querySelector(".work-sticky") || element : element;
    const gate = document.createElement("div");
    gate.className = "scene-gate";
    gate.setAttribute("aria-hidden", "true");
    gate.innerHTML = '<span class="scene-gate__orbit"></span><i class="scene-gate__arc"></i><b class="scene-gate__signal"></b>';
    host.prepend(gate);
    return { element, name, index, top: 0, height: 1 };
  }).filter(Boolean);

  if (!scenes.length) return;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const readScroll = () => {
    const value = Number(window.SPNScroll?.current);
    return Number.isFinite(value) ? value : scrollY;
  };

  let pageMax = 1;
  let viewportHeight = Math.max(1, innerHeight);
  let currentScroll = readScroll();
  let previousScroll = currentScroll;
  let activeIndex = -1;
  let raf = 0;
  let lastTime = performance.now();
  let metricsFrame = 0;
  let activeChapterClass = "";

  const cacheMetrics = () => {
    const scroll = readScroll();
    viewportHeight = Math.max(1, innerHeight);
    pageMax = Math.max(1, document.documentElement.scrollHeight - viewportHeight);
    scenes.forEach(scene => {
      const rect = scene.element.getBoundingClientRect();
      scene.top = scroll + rect.top;
      scene.height = Math.max(1, rect.height);
    });
  };

  const setActiveScene = index => {
    if (index === activeIndex) return;
    activeIndex = index;
    if (activeChapterClass) document.body.classList.remove(activeChapterClass);
    activeChapterClass = `journey-chapter-${index}`;
    document.body.classList.add(activeChapterClass);
    scenes.forEach((scene, sceneIndex) => scene.element.classList.toggle("is-journey-current", sceneIndex === index));
    const scene = scenes[index];
    if (!scene) return;
    const number = String(index + 1).padStart(2, "0");
    if (chapterName) chapterName.textContent = scene.name;
    if (chapterIndex) chapterIndex.textContent = number;
    if (chapterCount) chapterCount.textContent = `${number} / ${String(scenes.length).padStart(2, "0")}`;
  };

  const render = now => {
    raf = 0;
    const targetScroll = readScroll();
    const delta = Math.min(50, Math.max(1, now - lastTime));
    lastTime = now;
    const safetyMode = touchLandscape();
    const smoothing = reduceMotion || safetyMode ? 1 : 1 - Math.exp(-delta * .018);
    currentScroll += (targetScroll - currentScroll) * smoothing;
    const velocity = clamp(Math.abs(targetScroll - previousScroll) / Math.max(1, delta) / 2.2);
    previousScroll = targetScroll;
    const pageProgress = clamp(currentScroll / pageMax);
    root.style.setProperty("--journey-progress", pageProgress.toFixed(5));
    root.style.setProperty("--journey-speed", velocity.toFixed(4));
    if (journeyProgress) journeyProgress.style.transform = `scaleX(${pageProgress.toFixed(5)})`;

    const marker = currentScroll + viewportHeight * .5;
    let nextActive = 0;
    scenes.forEach((scene, index) => {
      if (marker >= scene.top) nextActive = index;
      const local = clamp((currentScroll + viewportHeight - scene.top) / (scene.height + viewportHeight));
      const centered = local * 2 - 1;
      const visible = Math.sin(local * Math.PI);
      if (!safetyMode) {
        scene.element.style.setProperty("--scene-local", local.toFixed(5));
        scene.element.style.setProperty("--scene-center", centered.toFixed(5));
        scene.element.style.setProperty("--scene-visible", Math.max(0, visible).toFixed(5));
      }
    });
    setActiveScene(nextActive);

    const compact = innerWidth <= 720;
    const orbit = pageProgress * Math.PI * 2;
    const fallbackAlpha = (compact
      ? [0, .4, .3, .36, .42, .35, .32, .42]
      : [0, .52, .4, .46, .54, .44, .4, .54])[nextActive] ?? .42;
    const fallbackX = (compact ? 5 : 20) + Math.sin(orbit * 1.08) * (compact ? 8 : 11);
    const fallbackY = Math.cos(orbit * .86) * (compact ? 5 : 8);
    const fallbackScale = (compact ? .9 : 1) + Math.sin(orbit * .62) * .035;
    root.style.setProperty("--fallback-planet-alpha", fallbackAlpha.toFixed(3));
    root.style.setProperty("--fallback-planet-x", `${fallbackX.toFixed(2)}vw`);
    root.style.setProperty("--fallback-planet-y", `${fallbackY.toFixed(2)}vh`);
    root.style.setProperty("--fallback-planet-scale", fallbackScale.toFixed(4));
    root.style.setProperty("--fallback-planet-rotate", `${(-7 + pageProgress * 18).toFixed(2)}deg`);

    if (Math.abs(targetScroll - currentScroll) > .08 || document.body.classList.contains("is-flight-navigating")) {
      raf = requestAnimationFrame(render);
    }
  };

  const requestRender = () => {
    if (!raf) raf = requestAnimationFrame(render);
  };

  const refreshMetrics = () => {
    if (metricsFrame) return;
    metricsFrame = requestAnimationFrame(() => {
      metricsFrame = 0;
      cacheMetrics();
      requestRender();
    });
  };

  addEventListener("scroll", requestRender, { passive: true });
  addEventListener("resize", refreshMetrics, { passive: true });
  addEventListener("load", refreshMetrics, { once: true });
  addEventListener("spn:navigation-start", () => {
    document.body.classList.add("is-flight-navigating");
    requestRender();
  });
  addEventListener("spn:navigation-cancel", () => document.body.classList.remove("is-flight-navigating"));
  addEventListener("spn:navigation-complete", () => {
    document.body.classList.remove("is-flight-navigating");
    refreshMetrics();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) requestRender();
  });

  if ("ResizeObserver" in window && !touchDevice) {
    const sceneObserver = new ResizeObserver(refreshMetrics);
    scenes.forEach(scene => sceneObserver.observe(scene.element));
  }
  cacheMetrics();
  setActiveScene(0);
  requestRender();
})();
