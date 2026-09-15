(() => {
  "use strict";

  /*
   * SPNVISUALZ — the arrival.
   *
   * A flight through the galaxy that decelerates in front of the SPN-1
   * planet. This is the first thing a visitor sees, so it is deliberately
   * NOT built on the site's Three.js layer: that is a ~131 kB gzipped
   * chunk, and a loading screen that waits for a 131 kB download before
   * it can paint is not a loading screen. Canvas 2D starts on the frame
   * after this script parses, costs nothing extra, and runs everywhere —
   * including the devices deviceTier.js sends down the "minimal" path,
   * which is why there is no separate fallback scene to maintain here.
   *
   * The overlay markup and its resting look are inline in index.html, so
   * the branded screen is painted from the HTML alone before this file
   * even arrives. Everything below is the upgrade, not the baseline: if
   * this script never loads, a CSS animation still retires the overlay.
   */

  const SEEN_KEY = "spn_intro_seen";

  // Every timing in one place, in ms from the first frame. The whole
  // sequence is ~4.4s of content plus a 620ms exit — long enough to read
  // as cinema, short enough that nobody waits on it twice (it runs once
  // per tab session).
  const T = {
    warpIn:    850,   // accelerating out of rest into the warp
    warpHold:  1450,  // holding full speed
    slowTo:    2950,  // braked down to a drift
    planetIn:  2050,  // SPN-1 starts emerging from the far distance
    planetSet: 3300,  // ...and reaches its resting size
    wordIn:    3100,
    enterIn:   3500,
    autoExit:  4200,
    fade:      620
  };

  const DEPTH = 1500;   // z at which objects respawn / fade in from
  const FOCAL = 520;    // projection focal length, in px at z=1
  const WARP_SPEED = 1750;  // z-units per second at full warp
  const DRIFT = 26;         // z-units per second once parked
  const SPREAD = 1350;      // how far off-axis stars are scattered
  // A streak is "where this star was TRAIL seconds ago", not "where it was
  // last frame". Derived from the previous frame the length is a function
  // of frame rate, so the same warp drew half-length streaks at 120Hz as
  // it did at 60Hz. In seconds it is identical on every display.
  const TRAIL = 0.055;

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeIn = (t) => t * t * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const root = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Repeat navigations inside one tab skip straight through. The intro is
  // an arrival, and you only arrive once.
  let alreadySeen = false;
  try { alreadySeen = sessionStorage.getItem(SEEN_KEY) === "1"; } catch (_) {}

  // This file is loaded from <head>, ahead of consent.js, which reads the
  // flag below to decide whether to hold the privacy banner back. So the
  // decision is made here and now, synchronously — but <body> has not been
  // parsed yet at this point, so the overlay element does not exist and
  // everything that touches it has to wait for the DOM. That split is the
  // whole shape of this file: flags now, pixels on ready. It costs nothing
  // visually, because the overlay's resting look is inline CSS in the head
  // and is already on screen before this script is even fetched.
  window.__spnIntroActive = !alreadySeen;
  if (!alreadySeen) {
    root.classList.add("intro-active");
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch (_) {}
  }

  const onReady = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  };

  onReady(() => {
    const overlay = document.getElementById("spnIntro");
    if (!overlay || alreadySeen) {
      overlay?.remove();
      root.classList.remove("intro-active");
      window.__spnIntroActive = false;
      window.dispatchEvent(new CustomEvent("spn:intro-done"));
      return;
    }
    fly(overlay);
  });

  function fly(overlay) {
  // Tells the inline CSS backstop to stand down: something is driving the
  // overlay now, so the 6.5s auto-hide must not race the real sequence.
  overlay.classList.add("is-live");

  const canvas = document.getElementById("spnIntroCanvas");
  const poster = overlay.querySelector(".spn-intro__poster");
  const enterBtn = overlay.querySelector(".spn-intro__enter");
  const skipBtn = overlay.querySelector(".spn-intro__skip");
  const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;

  let done = false;
  let raf = 0;
  let start = 0;
  let last = 0;
  let width = 0;
  let height = 0;
  let cx = 0;
  let cy = 0;
  let scale = 1;   // shortest-edge scale, so the flight frames the same on any screen

  // ---------------------------------------------------------------- exit
  function finish() {
    if (done) return;
    done = true;
    document.removeEventListener("keydown", onKey);

    overlay.classList.add("is-leaving");
    root.classList.remove("intro-active");
    window.__spnIntroActive = false;

    // The site is already mounted underneath; this only uncovers it.
    window.dispatchEvent(new CustomEvent("spn:intro-done"));

    // Keep drawing through the fade. Tearing the scene down here instead
    // would blank the planet's canvas on the first frame of the exit, so
    // the thing the whole flight was travelling towards would pop out of
    // existence just as the overlay starts to dissolve.
    setTimeout(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      try { window.__spnIntroPlanet?.dispose(); } catch (_) {}
      window.__spnIntroPlanet = null;
      overlay.remove();
    }, T.fade + 120);
  }

  function onKey(e) {
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") finish();
  }

  enterBtn?.addEventListener("click", finish);
  skipBtn?.addEventListener("click", finish);
  document.addEventListener("keydown", onKey);

  // A visitor who cannot see the animation gets the destination, not the
  // journey: the planet at rest, the wordmark, and a short beat.
  if (reduceMotion || !ctx) {
    overlay.classList.add("is-arrived", "is-static");
    setTimeout(finish, 1500);
    return;
  }

  // -------------------------------------------------------------- canvas
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = width / 2;
    cy = height / 2;
    scale = Math.min(width, height) / 900;
  }
  resize();
  window.addEventListener("resize", () => {
    resize();
    window.__spnIntroPlanet?.resize();
  });

  // Star count follows the device rather than the design: a mid-range
  // phone should not be asked to draw 500 streaks a frame just because a
  // desktop can.
  const cores = navigator.hardwareConcurrency || 4;
  const area = window.innerWidth * window.innerHeight;
  const STARS = Math.round(
    Math.min(760, Math.max(220, (area / 1750) * (cores <= 4 ? 0.6 : 1)))
  );

  const rand = (a, b) => a + Math.random() * (b - a);

  const stars = [];
  for (let i = 0; i < STARS; i++) {
    stars.push({
      x: rand(-SPREAD, SPREAD),
      y: rand(-SPREAD, SPREAD),
      z: rand(1, DEPTH),
      pz: 0,
      warm: Math.random() < 0.18   // a few gold stars break up the violet
    });
  }

  // Nebula: a handful of very large, very soft blobs travelling in the
  // same z-space as the stars, so the galaxy has depth instead of being a
  // flat backdrop that slides.
  const clouds = [];
  const CLOUDS = cores <= 4 ? 5 : 9;
  for (let i = 0; i < CLOUDS; i++) {
    clouds.push({
      x: rand(-1500, 1500),
      y: rand(-1500, 1500),
      z: rand(120, DEPTH),
      r: rand(420, 1000),
      hue: Math.random() < 0.5 ? "138,77,255" : "90,120,255",
      a: rand(0.022, 0.055)
    });
  }

  // The worlds passed on the way. Pushed well off the flight path so they
  // sweep past the edges of frame rather than through the middle, which
  // is what sells "we are moving" instead of "things are scaling up".
  const planets = [
    { x: -430, y: -215, z: 1180, r: 118, a: "#6a4bb8", b: "#241548", ring: false },
    { x:  520, y:  260, z: 1520, r: 155, a: "#3f5f9e", b: "#121a33", ring: true  },
    { x: -300, y:  330, z: 2050, r:  92, a: "#8a6bd0", b: "#1b1030", ring: false }
  ];

  function speedAt(t) {
    if (t < T.warpIn) return DRIFT + easeIn(t / T.warpIn) * (WARP_SPEED - DRIFT);
    if (t < T.warpHold) return WARP_SPEED;
    if (t < T.slowTo) {
      const k = easeOut((t - T.warpHold) / (T.slowTo - T.warpHold));
      return DRIFT + (WARP_SPEED - DRIFT) * (1 - k);
    }
    return DRIFT;
  }

  // ------------------------------------------------------------- drawing
  function drawGalaxyBand(t) {
    // A tilted band of light across the field — the Milky Way read. It
    // rolls very slightly through the flight so the horizon is never
    // quite level, which keeps the frame from feeling locked off.
    const roll = -0.42 + Math.sin(t / 4200) * 0.05;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(roll);
    const span = Math.max(width, height) * 1.5;
    const g = ctx.createLinearGradient(0, -span * 0.30, 0, span * 0.30);
    g.addColorStop(0.00, "rgba(8,6,20,0)");
    g.addColorStop(0.40, "rgba(46,32,96,0.055)");
    g.addColorStop(0.48, "rgba(120,96,200,0.115)");
    g.addColorStop(0.52, "rgba(138,116,214,0.10)");
    g.addColorStop(0.60, "rgba(44,36,104,0.05)");
    g.addColorStop(1.00, "rgba(8,6,20,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-span, -span * 0.30, span * 2, span * 0.60);
    ctx.restore();
  }

  function drawClouds(dt, speed) {
    ctx.globalCompositeOperation = "lighter";
    for (const c of clouds) {
      c.z -= speed * dt * 0.55;
      if (c.z < 60) {
        c.z = DEPTH + rand(0, 400);
        c.x = rand(-1500, 1500);
        c.y = rand(-1500, 1500);
      }
      const k = FOCAL / c.z;
      const x = cx + c.x * k * scale;
      const y = cy + c.y * k * scale;
      const r = c.r * k * scale;
      if (r < 6 || x < -r * 2 || x > width + r * 2 || y < -r * 2 || y > height + r * 2) continue;
      const near = clamp01(1 - c.z / DEPTH);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c.hue},${(c.a * near).toFixed(3)})`);
      g.addColorStop(1, `rgba(${c.hue},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawStars(dt, speed) {
    ctx.lineCap = "round";
    for (const s of stars) {
      s.z -= speed * dt;
      if (s.z < 1) {
        s.z = DEPTH;
        s.x = rand(-SPREAD, SPREAD);
        s.y = rand(-SPREAD, SPREAD);
      }
      s.pz = s.z + speed * TRAIL;
      const k = FOCAL / s.z;
      const x = cx + s.x * k * scale;
      const y = cy + s.y * k * scale;
      if (x < -60 || x > width + 60 || y < -60 || y > height + 60) continue;

      const near = clamp01(1 - s.z / DEPTH);
      const pk = FOCAL / s.pz;
      const px = cx + s.x * pk * scale;
      const py = cy + s.y * pk * scale;

      const alpha = 0.18 + near * 0.82;
      const w = (0.4 + near * 1.7) * scale;
      const trail = Math.hypot(x - px, y - py);

      if (trail > 1.2) {
        const g = ctx.createLinearGradient(px, py, x, y);
        const tint = s.warm ? "232,194,122" : "226,218,255";
        g.addColorStop(0, `rgba(${tint},0)`);
        g.addColorStop(1, `rgba(${tint},${alpha.toFixed(3)})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        ctx.fillStyle = s.warm
          ? `rgba(232,194,122,${alpha.toFixed(3)})`
          : `rgba(230,224,255,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, w * 0.62, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPassingPlanets(dt, speed, t) {
    // Faded out across the same window SPN-1 grows in: by the time the
    // destination is at rest, everything passed on the way is gone.
    const receding = 1 - clamp01((t - T.planetIn) / (T.planetSet - T.planetIn));
    if (receding <= 0) return;
    for (const p of planets) {
      p.z -= speed * dt * 0.85;
      if (p.z < 40) continue;
      const k = FOCAL / p.z;
      const x = cx + p.x * k * scale;
      const y = cy + p.y * k * scale;
      const r = p.r * k * scale;
      if (r < 2) continue;
      if (x < -r * 1.6 || x > width + r * 1.6 || y < -r * 1.6 || y > height + r * 1.6) continue;

      const near = clamp01(1 - p.z / DEPTH);
      ctx.globalAlpha = clamp01(near * 1.6) * receding;

      if (p.ring) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.42);
        ctx.strokeStyle = "rgba(198,178,255,0.34)";
        ctx.lineWidth = Math.max(1, r * 0.055);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.72, r * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.04, x, y, r);
      g.addColorStop(0, p.a);
      g.addColorStop(0.62, p.b);
      g.addColorStop(1, "#05030c");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // Rim light on the lit edge — without it these read as flat discs.
      ctx.strokeStyle = "rgba(198,167,255,0.42)";
      ctx.lineWidth = Math.max(0.6, r * 0.03);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.985, Math.PI * 0.85, Math.PI * 1.95);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawHomePlanet(t) {
    if (t < T.planetIn) return;

    const k = easeInOut(clamp01((t - T.planetIn) / (T.planetSet - T.planetIn)));
    const rest = Math.min(width * 0.72, height * 0.52);  // matches .spn-intro__poster
    const size = rest * (0.035 + 0.965 * k);
    const drift = Math.sin(t / 1500) * 5 * k;   // never fully still
    const x = cx;
    const y = cy - height * 0.015 + drift;

    // The atmosphere is painted here either way: this canvas sits behind
    // the WebGL layer, so the glow reads as coming from behind the planet
    // whichever one is drawing it.
    const glow = ctx.createRadialGradient(x, y, size * 0.30, x, y, size * 0.92);
    glow.addColorStop(0, `rgba(138,77,255,${(0.13 * k).toFixed(3)})`);
    glow.addColorStop(0.55, `rgba(110,70,220,${(0.055 * k).toFixed(3)})`);
    glow.addColorStop(1, "rgba(110,70,220,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.92, 0, Math.PI * 2);
    ctx.fill();

    // Real geometry if it made it in time (src/intro/introPlanet.js,
    // mounted by main.js once the Three chunk lands), otherwise the flat
    // brand art. The choice is re-made every frame so a planet that
    // arrives mid-approach simply takes over.
    const planet3d = window.__spnIntroPlanet;
    if (planet3d) {
      overlay.classList.add("has-planet3d");
      try {
        planet3d.render(size, k, t / 1000);
        return;
      } catch (err) {
        window.__spnIntroPlanet = null;
        overlay.classList.remove("has-planet3d");
        console.error("[intro] 3D planet failed, falling back to the still", err);
      }
    }

    if (!poster || !poster.complete || !poster.naturalWidth) return;

    const ar = poster.naturalHeight / poster.naturalWidth;
    const w = size;
    const h = size * ar;
    ctx.globalAlpha = clamp01(k * 1.25);
    ctx.drawImage(poster, x - w / 2, y - h / 2, w, h);
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- loop
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!start) { start = now; last = now; }
    const t = done ? T.autoExit : now - start;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const speed = speedAt(t);

    // Deep space, repainted every frame — no trail buffer, because a
    // fading-canvas trail smears the planet at the end.
    const ground = ctx.createRadialGradient(cx, cy * 0.92, 0, cx, cy, Math.max(width, height) * 0.78);
    ground.addColorStop(0, "#0c0722");
    ground.addColorStop(0.55, "#070418");
    ground.addColorStop(1, "#03020a");
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, width, height);

    drawGalaxyBand(t);
    drawClouds(dt, speed);
    drawStars(dt, speed);
    drawPassingPlanets(dt, speed, t);
    drawHomePlanet(t);

    if (t >= T.wordIn) overlay.classList.add("is-arrived");
    if (t >= T.enterIn) overlay.classList.add("is-ready");
    if (t >= T.autoExit) finish();
  }

  // Kick off once the planet art is decoded, so it is never missing at
  // the moment the flight arrives. It is preloaded in the document head,
  // so in practice this has already resolved.
  const begin = () => { raf = requestAnimationFrame(frame); };
  if (poster && !poster.complete) {
    poster.addEventListener("load", begin, { once: true });
    poster.addEventListener("error", begin, { once: true });
    setTimeout(begin, 700);   // never let a stalled image hold the screen
  } else {
    begin();
  }

  // A backgrounded tab should not burn through the timeline unseen.
  document.addEventListener("visibilitychange", () => {
    if (done) return;
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  });
  }
})();
