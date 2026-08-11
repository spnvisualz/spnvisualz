(() => {
  "use strict";

  const root = document.documentElement;
  const canvas = document.getElementById("cosmicFlightCanvas");
  const guide = document.getElementById("cosmicFlightGuide");
  if (!canvas || !guide) return;

  const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!context) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = Boolean(connection && connection.saveData);
  const satellites = [...document.querySelectorAll(".cosmic-flight__satellite")];
  const chapterNumber = document.getElementById("cosmicFlightChapterNo");
  const chapterName = document.getElementById("cosmicFlightChapter");
  const progressRail = document.getElementById("cosmicFlightProgress");
  const prologue = document.getElementById("flightExperience");
  const prologueGlobe = document.getElementById("flightExperienceGlobe");
  const prologueCopy = document.getElementById("flightExperienceCopy");
  const prologueCards = [...document.querySelectorAll(".flight-prologue__card")];
  const prologueNumber = document.getElementById("flightExperienceNumber");
  const prologueName = document.getElementById("flightExperienceName");
  const prologueGhost = document.getElementById("flightExperienceGhost");
  const prologueProgress = document.getElementById("flightExperienceProgress");
  const prologuePercent = document.getElementById("flightExperiencePercent");
  const prologueExit = document.querySelector(".flight-prologue__exit");
  const TAU = Math.PI * 2;
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const smoothstep = (edge0, edge1, value) => {
    const amount = clamp((value - edge0) / Math.max(.0001, edge1 - edge0));
    return amount * amount * (3 - 2 * amount);
  };

  const chapterDefinitions = [
    ["#top", "ORIGIN"],
    [".manifesto", "THE WORLD"],
    ["#work", "SELECTED WORK"],
    ["#services", "SERVICES"],
    ["#pricing", "PRICING"],
    [".process", "PROCESS"],
    ["#visual-lab", "VISUAL LAB"],
    ["#contact", "CONTACT"]
  ];

  let width = 1;
  let height = 1;
  let dpr = 1;
  let pageMax = 1;
  let targetProgress = 0;
  let currentProgress = 0;
  let targetWarp = 0;
  let currentWarp = 0;
  let pointerX = 0;
  let pointerY = 0;
  let targetPointerX = 0;
  let targetPointerY = 0;
  let lastScroll = scrollY;
  let lastScrollTime = performance.now();
  let lastFrameTime = performance.now();
  let resizeFrame = 0;
  let animationFrame = 0;
  let activeChapter = -1;
  let keyframes = [];
  let chapterMetrics = [];
  let prologueTop = 0;
  let prologueTravel = 1;
  let prologueHeight = 1;
  let activePrologueWorld = -2;
  let prologueIsActive = false;
  let stars = [];
  let visible = !document.hidden;

  const prologueWorlds = [
    ["00", "SPN ORIGIN", "SPN"],
    ["01", "GEZANA", "GEZANA"],
    ["02", "3 NATION", "3N"],
    ["03", "TAO", "TAO"],
    ["04", "R STAR", "R★"],
    ["05", "TAO SPECIAL", "TAO"]
  ];

  const randomBetween = (min, max) => min + Math.random() * (max - min);

  const buildStars = () => {
    const compact = width <= 720;
    const count = reduceMotion || saveData ? (compact ? 38 : 76) : compact ? 68 : width <= 1050 ? 118 : 185;
    stars = Array.from({ length: count }, (_, index) => ({
      x: randomBetween(-1.3, 1.3),
      y: randomBetween(-1.05, 1.05),
      z: randomBetween(.025, 1),
      size: randomBetween(.45, 1.7),
      violet: index % 7 === 0,
      pulse: randomBetween(0, TAU)
    }));
  };

  const sectionPoint = (selector, amount = 0) => {
    const element = document.querySelector(selector);
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    return clamp((scrollY + rect.top + rect.height * amount) / pageMax);
  };

  const cacheFlightPath = () => {
    pageMax = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    if (prologue) {
      const prologueRect = prologue.getBoundingClientRect();
      prologueTop = scrollY + prologueRect.top;
      prologueHeight = prologueRect.height;
      prologueTravel = Math.max(1, prologueHeight - innerHeight);
    }
    chapterMetrics = chapterDefinitions.map(([selector, name], index) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return {
        name,
        number: String(index + 1).padStart(2, "0"),
        top: rect ? scrollY + rect.top : index * innerHeight,
        height: rect ? rect.height : innerHeight
      };
    });

    const heroExit = sectionPoint("#top", .82);
    const manifestoStart = sectionPoint(".manifesto", .12);
    const workStart = sectionPoint("#work", .02);
    const workMiddle = sectionPoint("#work", .5);
    const workExit = sectionPoint("#work", .96);
    const servicesMiddle = sectionPoint("#services", .48);
    const pricingMiddle = sectionPoint("#pricing", .42);
    const processMiddle = sectionPoint(".process", .4);
    const labMiddle = sectionPoint("#visual-lab", .38);
    const contactMiddle = sectionPoint("#contact", .46);

    keyframes = [
      { p: 0, x: .79, y: .5, scale: .98, rotate: -3, pitch: -1, opacity: 0 },
      { p: heroExit, x: .79, y: .48, scale: .88, rotate: 2, pitch: 2, opacity: 0 },
      { p: manifestoStart, x: .8, y: .4, scale: .72, rotate: 8, pitch: -3, opacity: .54 },
      { p: workStart, x: .17, y: .56, scale: .38, rotate: -13, pitch: 5, opacity: .44 },
      { p: workMiddle, x: .82, y: .34, scale: .34, rotate: 15, pitch: -5, opacity: .36 },
      { p: workExit, x: .48, y: .78, scale: .22, rotate: -7, pitch: 7, opacity: .2 },
      { p: servicesMiddle, x: .82, y: .34, scale: .47, rotate: 12, pitch: -4, opacity: .49 },
      { p: pricingMiddle, x: .16, y: .67, scale: .37, rotate: -16, pitch: 5, opacity: .38 },
      { p: processMiddle, x: .84, y: .27, scale: .34, rotate: 16, pitch: -6, opacity: .36 },
      { p: labMiddle, x: .17, y: .35, scale: .5, rotate: -11, pitch: 4, opacity: .48 },
      { p: contactMiddle, x: .75, y: .5, scale: .88, rotate: 5, pitch: -2, opacity: .64 },
      { p: 1, x: .54, y: .52, scale: 1.18, rotate: 0, pitch: 0, opacity: .1 }
    ].sort((a, b) => a.p - b.p);
  };

  const resize = () => {
    width = Math.max(1, innerWidth);
    height = Math.max(1, innerHeight);
    dpr = Math.min(devicePixelRatio || 1, saveData ? 1 : width <= 720 ? 1.15 : 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars();
    cacheFlightPath();
    targetProgress = clamp(scrollY / pageMax);
    if (reduceMotion) currentProgress = targetProgress;
  };

  const scheduleResize = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      resize();
    });
  };

  const pathAt = progress => {
    if (!keyframes.length) return { x: .78, y: .48, scale: .8, rotate: 0, pitch: 0, opacity: 0 };
    let nextIndex = keyframes.findIndex(point => point.p >= progress);
    if (nextIndex <= 0) return keyframes[0];
    if (nextIndex < 0) return keyframes[keyframes.length - 1];
    const previous = keyframes[nextIndex - 1];
    const next = keyframes[nextIndex];
    const amount = smoothstep(previous.p, next.p, progress);
    return {
      x: lerp(previous.x, next.x, amount),
      y: lerp(previous.y, next.y, amount),
      scale: lerp(previous.scale, next.scale, amount),
      rotate: lerp(previous.rotate, next.rotate, amount),
      pitch: lerp(previous.pitch, next.pitch, amount),
      opacity: lerp(previous.opacity, next.opacity, amount)
    };
  };

  const drawSpace = time => {
    context.clearRect(0, 0, width, height);

    const centerX = width * (.5 + pointerX * .025);
    const centerY = height * (.48 + pointerY * .02);
    const violetGlow = context.createRadialGradient(
      width * (.58 + pointerX * .04),
      height * (.42 + pointerY * .03),
      0,
      width * .56,
      height * .44,
      Math.max(width, height) * .72
    );
    violetGlow.addColorStop(0, `rgba(116,54,228,${.052 + currentWarp * .05})`);
    violetGlow.addColorStop(.45, `rgba(58,19,121,${.025 + currentWarp * .02})`);
    violetGlow.addColorStop(1, "rgba(3,2,7,0)");
    context.fillStyle = violetGlow;
    context.fillRect(0, 0, width, height);

    context.save();
    context.globalCompositeOperation = "lighter";
    const drift = reduceMotion ? currentProgress * 1.8 : currentProgress * 3.15 + time * .000012;
    const focal = Math.min(width, height) * .55;
    const streak = .008 + currentWarp * .12;

    stars.forEach(star => {
      let z = (star.z - drift) % 1;
      if (z < .02) z += 1;
      const previousZ = Math.min(1, z + streak);
      const x = centerX + star.x * focal / z;
      const y = centerY + star.y * focal / z;
      const previousX = centerX + star.x * focal / previousZ;
      const previousY = centerY + star.y * focal / previousZ;
      if (x < -80 || x > width + 80 || y < -80 || y > height + 80) return;

      const proximity = 1 - z;
      const pulse = .76 + Math.sin(time * .0014 + star.pulse) * .24;
      const alpha = clamp(proximity * .82 + .08) * pulse;
      const lineWidth = Math.max(.38, star.size * (1 + proximity * 1.7));
      context.beginPath();
      context.moveTo(previousX, previousY);
      context.lineTo(x, y);
      context.lineWidth = lineWidth;
      context.strokeStyle = star.violet
        ? `rgba(183,143,255,${alpha * .74})`
        : `rgba(239,232,255,${alpha * .6})`;
      context.stroke();

      if (currentWarp < .5 || proximity > .72) {
        context.beginPath();
        context.arc(x, y, Math.max(.45, lineWidth * .58), 0, TAU);
        context.fillStyle = star.violet
          ? `rgba(183,143,255,${alpha})`
          : `rgba(255,255,255,${alpha * .86})`;
        context.fill();
      }
    });
    context.restore();

    const horizon = context.createLinearGradient(0, centerY - 1, width, centerY + 1);
    horizon.addColorStop(0, "rgba(112,45,226,0)");
    horizon.addColorStop(.46, `rgba(195,164,255,${.04 + currentWarp * .07})`);
    horizon.addColorStop(.5, `rgba(255,255,255,${.055 + currentWarp * .07})`);
    horizon.addColorStop(.54, `rgba(195,164,255,${.04 + currentWarp * .07})`);
    horizon.addColorStop(1, "rgba(112,45,226,0)");
    context.fillStyle = horizon;
    context.fillRect(0, centerY, width, 1);
  };

  const updateChapter = () => {
    const marker = scrollY + height * .42;
    let index = 0;
    chapterMetrics.forEach((chapter, chapterIndex) => {
      if (marker >= chapter.top) index = chapterIndex;
    });
    if (index === activeChapter) return;
    activeChapter = index;
    const chapter = chapterMetrics[index];
    if (!chapter) return;
    if (chapterNumber) chapterNumber.textContent = chapter.number;
    if (chapterName) chapterName.textContent = chapter.name;
    document.body.dataset.flightChapter = chapter.name.toLowerCase().replace(/\s+/g, "-");
  };

  const updatePrologue = time => {
    if (!prologue || !prologueGlobe) return;

    const progress = clamp((scrollY - prologueTop) / prologueTravel);
    const intersects = scrollY + height > prologueTop && scrollY < prologueTop + prologueHeight;
    const exitAmount = smoothstep(.87, .97, progress);
    const compact = width <= 720;
    const dive = smoothstep(.82, 1, progress);
    const intro = smoothstep(.015, .2, progress);
    const orbitWave = reduceMotion ? 0 : Math.sin(progress * TAU * 1.45 + time * .00024);

    prologue.style.setProperty("--prologue-progress", progress.toFixed(4));
    prologue.style.setProperty("--prologue-exit", exitAmount.toFixed(3));
    if (prologueProgress) prologueProgress.style.transform = `scaleX(${progress.toFixed(4)})`;
    if (prologuePercent) prologuePercent.textContent = String(Math.round(progress * 100)).padStart(3, "0");

    if (intersects !== prologueIsActive) {
      prologueIsActive = intersects;
      document.body.classList.toggle("is-world-flight", intersects);
    }
    const complete = reduceMotion || progress > .91;
    prologue.classList.toggle("is-complete", complete);
    if (prologueExit) prologueExit.tabIndex = complete ? 0 : -1;

    if (reduceMotion) {
      if (activePrologueWorld !== 0) {
        activePrologueWorld = 0;
        if (prologueNumber) prologueNumber.textContent = "00";
        if (prologueName) prologueName.textContent = "SPN ORIGIN";
      }
      return;
    }

    let globeX = lerp(compact ? .68 : .76, compact ? .5 : .235, intro);
    let globeY = lerp(compact ? .62 : .53, compact ? .48 : .5, intro) + orbitWave * (compact ? .012 : .018);
    let globeScale = lerp(compact ? .62 : .84, compact ? .42 : .5, intro);
    globeX = lerp(globeX, .5, dive);
    globeY = lerp(globeY, .5, dive);
    globeScale = lerp(globeScale, compact ? 2.75 : 3.45, dive);
    const globeOpacity = lerp(1, .12, smoothstep(.9, 1, progress));
    const globeRotate = lerp(-4, 22, progress) + orbitWave * 2.2;
    const globePitch = orbitWave * (compact ? 2.5 : 4.5);
    prologueGlobe.style.opacity = globeOpacity.toFixed(3);
    prologueGlobe.style.filter = `blur(${(dive * 2.3).toFixed(2)}px) brightness(${(1 + dive * .28).toFixed(2)})`;
    prologueGlobe.style.transform = `translate3d(${(globeX * width).toFixed(2)}px,${(globeY * height).toFixed(2)}px,0) translate(-50%,-50%) scale(${globeScale.toFixed(4)}) rotateX(${globePitch.toFixed(2)}deg) rotateY(${(-orbitWave * 5).toFixed(2)}deg) rotateZ(${globeRotate.toFixed(2)}deg)`;

    const starts = compact ? [.145, .295, .445, .595, .745] : [.13, .282, .434, .586, .738];
    const duration = compact ? .235 : .255;
    const verticalOffsets = compact ? [-.02, .025, -.015, .02, -.01] : [-.17, .14, -.06, .16, -.13];

    prologueCards.forEach((card, index) => {
      const local = clamp((progress - starts[index]) / duration);
      const enter = smoothstep(0, .23, local);
      const leave = smoothstep(.7, 1, local);
      const visibilityAmount = enter * (1 - leave);
      const arc = Math.sin(local * Math.PI);
      const direction = index % 2 === 0 ? 1 : -1;
      const startX = compact ? (direction > 0 ? 1.24 : -.24) : (direction > 0 ? 1.13 : -.13);
      const endX = compact ? (direction > 0 ? -.26 : 1.26) : (direction > 0 ? -.2 : 1.2);
      const middleX = .5 + direction * (compact ? .01 : .08);
      const firstHalf = smoothstep(0, .5, local);
      const secondHalf = smoothstep(.5, 1, local);
      const cardX = local <= .5 ? lerp(startX, middleX, firstHalf) : lerp(middleX, endX, secondHalf);
      const cardY = .52 + verticalOffsets[index] + Math.sin(local * Math.PI * 2) * (compact ? .018 : .035);
      const cardZ = lerp(-520, compact ? 30 : 100, arc);
      const cardScale = (compact ? .42 : .38) + arc * (compact ? .58 : .68);
      const rotateY = lerp(direction * -54, direction * 38, local);
      const rotateZ = lerp(direction * -5.5, direction * 3.5, local);
      const edgeBlur = (1 - arc) * (compact ? 2.4 : 4.5);
      card.style.zIndex = String(16 + Math.round(arc * 12));
      card.style.opacity = visibilityAmount.toFixed(3);
      card.style.filter = `blur(${edgeBlur.toFixed(2)}px) brightness(${(.68 + arc * .38).toFixed(2)})`;
      card.style.transform = `translate3d(${(cardX * width).toFixed(2)}px,${(cardY * height).toFixed(2)}px,${cardZ.toFixed(2)}px) translate(-50%,-50%) scale(${cardScale.toFixed(4)}) rotateY(${rotateY.toFixed(2)}deg) rotateZ(${rotateZ.toFixed(2)}deg)`;
    });

    let worldIndex = 0;
    if (progress >= .115) worldIndex = clamp(Math.floor((progress - .115) / .152) + 1, 1, 5);
    if (worldIndex !== activePrologueWorld) {
      activePrologueWorld = worldIndex;
      const world = prologueWorlds[worldIndex];
      if (prologueNumber) prologueNumber.textContent = world[0];
      if (prologueName) prologueName.textContent = world[1];
      if (prologueGhost) prologueGhost.textContent = world[2];
    }

    if (prologueCopy) prologueCopy.setAttribute("aria-hidden", progress > .28 ? "true" : "false");
  };

  const updateGuide = (path, time) => {
    if (width <= 720 || reduceMotion) return;
    const parallaxX = pointerX * 22;
    const parallaxY = pointerY * 14;
    const floatY = Math.sin(time * .00072 + currentProgress * TAU) * 7;
    const x = path.x * width + parallaxX;
    const y = path.y * height + parallaxY + floatY;
    const bank = path.rotate + currentWarp * (pointerX >= 0 ? 4 : -4);
    guide.style.opacity = path.opacity.toFixed(3);
    guide.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) translate(-50%,-50%) scale(${path.scale.toFixed(4)}) rotateZ(${bank.toFixed(2)}deg)`;
    guide.style.setProperty("--flight-guide-rx", `${(path.pitch - pointerY * 7).toFixed(2)}deg`);
    guide.style.setProperty("--flight-guide-ry", `${(pointerX * 10 + Math.sin(time * .00033) * 2.4).toFixed(2)}deg`);
  };

  const updateSatellites = (path, time) => {
    if (!satellites.length || width <= 900 || reduceMotion || saveData) return;
    const work = chapterMetrics[2];
    const services = chapterMetrics[3];
    const lab = chapterMetrics[6];
    const workStart = work ? clamp((work.top - height * .45) / pageMax) : .12;
    const servicesEnd = services ? clamp((services.top + services.height * .78) / pageMax) : .64;
    const labStart = lab ? clamp((lab.top - height * .7) / pageMax) : .82;
    const labEnd = lab ? clamp((lab.top + lab.height * .72) / pageMax) : .94;
    const workVisibility = smoothstep(workStart, workStart + .045, currentProgress) * (1 - smoothstep(servicesEnd - .06, servicesEnd, currentProgress));
    const labVisibility = smoothstep(labStart, labStart + .035, currentProgress) * (1 - smoothstep(labEnd - .03, labEnd, currentProgress));
    const visibilityAmount = Math.max(workVisibility, labVisibility * .68);
    const guideX = path.x * width + pointerX * 22;
    const guideY = path.y * height + pointerY * 14;
    const radiusX = Math.min(width * .34, 500) * (.76 + path.scale * .28);
    const radiusY = Math.min(height * .22, 205) * (.72 + path.scale * .24);

    satellites.forEach((satellite, index) => {
      const direction = index % 2 ? -1 : 1;
      const angle = currentProgress * (10.5 + index * .18) + time * .00006 * direction + index * (TAU / satellites.length);
      const depth = Math.sin(angle);
      const orbitX = Math.cos(angle) * radiusX;
      const orbitY = depth * radiusY;
      const x = guideX + orbitX;
      const y = guideY + orbitY;
      const scale = .46 + (depth + 1) * .19;
      const opacity = visibilityAmount * (.16 + (depth + 1) * .23) * clamp(path.opacity * 2.3, .35, 1);
      satellite.style.zIndex = depth > 0 ? "5" : "2";
      satellite.style.opacity = opacity.toFixed(3);
      satellite.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) translate(-50%,-50%) scale(${scale.toFixed(3)}) rotateY(${(-depth * 7).toFixed(2)}deg) rotateZ(${(Math.cos(angle) * 2.2).toFixed(2)}deg)`;
    });
  };

  const render = now => {
    const delta = Math.min(48, Math.max(0, now - lastFrameTime));
    lastFrameTime = now;
    const progressEase = 1 - Math.pow(.0005, delta / 1000);
    const pointerEase = 1 - Math.pow(.015, delta / 1000);
    const warpEase = 1 - Math.pow(.004, delta / 1000);
    currentProgress = lerp(currentProgress, targetProgress, reduceMotion ? 1 : progressEase);
    pointerX = lerp(pointerX, targetPointerX, pointerEase);
    pointerY = lerp(pointerY, targetPointerY, pointerEase);
    currentWarp = lerp(currentWarp, targetWarp, warpEase);
    targetWarp *= Math.pow(.065, delta / 1000);

    const path = pathAt(currentProgress);
    drawSpace(now);
    updatePrologue(now);
    updateGuide(path, now);
    updateSatellites(path, now);
    updateChapter();

    root.style.setProperty("--flight-visibility", clamp(currentProgress * 13).toFixed(3));
    root.style.setProperty("--flight-warp", currentWarp.toFixed(3));
    root.style.setProperty("--flight-bank", `${(Math.sin(currentProgress * TAU * 1.35) * 11).toFixed(2)}deg`);
    root.style.setProperty("--flight-corridor-opacity", (clamp(path.opacity * .34 + currentWarp * .2)).toFixed(3));
    if (progressRail) progressRail.style.transform = `scaleX(${currentProgress.toFixed(5)})`;

    if (visible && !reduceMotion && !saveData) animationFrame = requestAnimationFrame(render);
    else animationFrame = 0;
  };

  const requestStaticRender = () => {
    if (animationFrame) return;
    animationFrame = requestAnimationFrame(now => {
      animationFrame = 0;
      currentProgress = targetProgress;
      const path = pathAt(currentProgress);
      drawSpace(now);
      updatePrologue(now);
      updateGuide(path, now);
      updateChapter();
      if (progressRail) progressRail.style.transform = `scaleX(${currentProgress.toFixed(5)})`;
    });
  };

  addEventListener("scroll", () => {
    const now = performance.now();
    const nextScroll = scrollY;
    const distance = Math.abs(nextScroll - lastScroll);
    const elapsed = Math.max(16, now - lastScrollTime);
    targetWarp = Math.max(targetWarp, clamp((distance / elapsed) / 2.15));
    targetProgress = clamp(nextScroll / pageMax);
    lastScroll = nextScroll;
    lastScrollTime = now;
    if (reduceMotion || saveData) requestStaticRender();
  }, { passive: true });

  if (finePointer && !reduceMotion) {
    addEventListener("pointermove", event => {
      targetPointerX = clamp(event.clientX / width, 0, 1) - .5;
      targetPointerY = clamp(event.clientY / height, 0, 1) - .5;
    }, { passive: true });
    addEventListener("pointerleave", () => {
      targetPointerX = 0;
      targetPointerY = 0;
    }, { passive: true });
  }

  addEventListener("resize", scheduleResize, { passive: true });
  addEventListener("load", scheduleResize, { once: true });
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(document.body);
  }

  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
    if (!visible && animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    } else if (visible && !animationFrame) {
      lastFrameTime = performance.now();
      animationFrame = requestAnimationFrame(render);
    }
  });

  resize();
  currentProgress = targetProgress = clamp(scrollY / pageMax);
  root.classList.add("flight-ready");
  document.body.classList.add("flight-ready");
  animationFrame = requestAnimationFrame(render);
})();
