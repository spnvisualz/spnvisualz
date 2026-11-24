(() => {
  "use strict";

  /*
   * SPNVISUALZ — the arrival.
   *
   * Planet rise. Low over a curved horizon, a light rises behind it; the
   * camera pulls back until the horizon is SPN-1 — the S planet — in
   * silhouette, and the light itself draws the planet's ring around it,
   * passing behind the planet on the far side. When the loop closes, the
   * planet is lit. This is the first thing a visitor sees, so it is deliberately
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

  // Version the key whenever the arrival is materially rebuilt so an
  // existing visitor sees the new cut once without being trapped into
  // replaying it on every page view.
  const SEEN_KEY = "spn_intro_seen_v5";

  // Every timing in one place, in ms from the first frame. A light rises
  // over a curved horizon; the camera pulls back until the horizon is the
  // planet in silhouette; the light draws the planet's ring round it; the
  // loop closes and the planet is lit. ~5.4s plus a 620ms exit, once per
  // tab session.
  const T = {
    rise0:     150,   // the light starts to clear the horizon
    rise1:     1400,  // ...and is fully up
    pull0:     1250,  // the camera starts pulling back
    pull1:     2650,  // ...and the horizon has become the planet
    trace0:    2650,  // the light starts drawing the ring
    trace1:    3950,  // ...and closes the loop
    lit0:      3750,  // the planet starts to light
    lit1:      4550,
    wordIn:    4250,
    enterIn:   4650,
    autoExit:  5400,
    fade:      620
  };

  // Where the sphere and its ring sit inside spn-orb-arrival.webp, as
  // fractions of the artwork, so the drawn ring lands on the painted one.
  const BODY = { cx: 0.508, cy: 0.482, r: 0.362 };
  const RING = { cx: 0.49, cy: 0.49, a: 0.533, b: 0.088, rot: -0.49 };
  const TAU = Math.PI * 2;

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;

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
  let width = 0;
  let height = 0;
  let cx = 0;
  let cy = 0;
  // Declared here because finish() closes over it and can run from the
  // reduced-motion path, which returns before it is assigned.
  let onResize = null;
  let scale = 1;   // shortest-edge scale, so the jump frames the same on any screen

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

    // Keep drawing through the fade, so the planet does not blink out
    // just as the overlay starts to dissolve.
    setTimeout(() => {
      cancelAnimationFrame(raf);
      if (onResize) window.removeEventListener("resize", onResize);
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
  // Named, because finish() removes it by reference.
  onResize = () => {
    resize();
  };
  window.addEventListener("resize", onResize);

  // A still field: the drama here is light and camera, not speed, so the
  // stars only twinkle. Fewer on a smaller or slower device.
  const cores = navigator.hardwareConcurrency || 4;
  const area = window.innerWidth * window.innerHeight;
  const STARS = Math.round(Math.min(420, Math.max(160, (area / 3200) * (cores <= 4 ? 0.7 : 1))));
  const stars = [];
  for (let i = 0; i < STARS; i++) {
    stars.push({ x: Math.random(), y: Math.random(), m: Math.random(), p: Math.random() * TAU, warm: Math.random() < 0.1 });
  }

  // The planet at rest: the same box .spn-intro__poster uses, and the
  // sphere and ring inside it.
  function rest() {
    const size = Math.min(width * 0.72, height * 0.52);
    const x = cx, y = cy - height * 0.015;
    return {
      size, x, y,
      bx: x + (BODY.cx - 0.5) * size, by: y + (BODY.cy - 0.5) * size, br: BODY.r * size,
      rx: x + (RING.cx - 0.5) * size, ry: y + (RING.cy - 0.5) * size,
      ra: RING.a * size, rb: RING.b * size
    };
  }
  const cosR = Math.cos(RING.rot), sinR = Math.sin(RING.rot);
  function ringAt(g, th) {
    const x = Math.cos(th) * g.ra, y = Math.sin(th) * g.rb;
    return [g.rx + x * cosR - y * sinR, g.ry + x * sinR + y * cosR];
  }
  // The far half of the ring is hidden wherever the sphere is in front of it.
  function hidden(g, th, x, y) {
    return Math.sin(th) < 0 && Math.hypot(x - g.bx, y - g.by) < g.br * 0.99;
  }
  // Where the light steps onto the ring: nearest the top of the planet,
  // clear of its face.
  function ringStart(g) {
    let best = Infinity, th0 = 0;
    for (let i = 0; i < 360; i++) {
      const th = (i / 360) * TAU;
      const [x, y] = ringAt(g, th);
      const clear = Math.hypot(x - g.bx, y - g.by) > g.br * 1.04;
      const d = Math.hypot(x - g.bx, y - (g.by - g.br));
      if (clear && d < best) { best = d; th0 = th; }
    }
    return th0;
  }

  function glow(x, y, r, rgb, a) {
    if (a <= 0.003 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a.toFixed(3)})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function drawStars(t, alpha) {
    if (alpha <= 0.003) return;
    for (const s of stars) {
      const a = alpha * (0.2 + 0.8 * s.m * s.m) * (0.72 + 0.28 * Math.sin(t * 0.0021 + s.p));
      const size = Math.max(0.6, (0.55 + s.m * 1.25) * scale);
      ctx.fillStyle = s.warm ? `rgba(232,200,140,${a.toFixed(3)})` : `rgba(226,222,255,${a.toFixed(3)})`;
      ctx.fillRect(s.x * width, s.y * height, size, size);
    }
  }

  function drawPlanetArt(g, alpha) {
    if (alpha <= 0.003) return;
    const gl = ctx.createRadialGradient(g.bx, g.by, g.br * 0.7, g.bx, g.by, g.br * 2.3);
    gl.addColorStop(0, `rgba(138,77,255,${(0.22 * alpha).toFixed(3)})`);
    gl.addColorStop(0.5, `rgba(100,60,220,${(0.07 * alpha).toFixed(3)})`);
    gl.addColorStop(1, "rgba(90,60,200,0)");
    ctx.fillStyle = gl;
    ctx.fillRect(g.bx - g.br * 2.3, g.by - g.br * 2.3, g.br * 4.6, g.br * 4.6);
    if (!poster || !poster.complete || !poster.naturalWidth) return;
    const drift = Math.sin(performance.now() / 1500) * 3 * alpha;
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(poster, g.x - g.size / 2, g.y - g.size / 2 + drift, g.size, g.size);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  let th0 = null;
  let lastW = 0, lastH = 0;

  // ---------------------------------------------------------------- loop
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!start) start = now;
    const t = done ? Math.max(now - start, T.autoExit) : now - start;

    const g = rest();
    if (th0 === null || width !== lastW || height !== lastH) {
      th0 = ringStart(g);
      lastW = width; lastH = height;
    }

    // deep space
    const ground = ctx.createRadialGradient(cx, cy * 0.9, 0, cx, cy, Math.hypot(width, height) * 0.55);
    ground.addColorStop(0, "#0d0822");
    ground.addColorStop(0.6, "#060416");
    ground.addColorStop(1, "#020109");
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, width, height);

    // The camera pulls back: a huge circle whose top is the horizon
    // becomes the planet's own sphere.
    const pull = easeInOut(seg(t, T.pull0, T.pull1));
    const big = Math.hypot(width, height) * 2.2;
    const horizon = height * 0.66;
    const px = lerp(cx, g.bx, pull);
    const py = lerp(horizon + big, g.by, pull);
    const R = lerp(big, g.br, pull);
    const top = py - R;

    drawStars(t, 0.12 + 0.6 * pull);

    const rise = easeOut(seg(t, T.rise0, T.rise1));
    const lit = easeInOut(seg(t, T.lit0, T.lit1));

    // Where the light is: rising over the limb, riding it as the camera
    // pulls back, gliding onto the ring, then drawing it.
    const sunX = px, sunY = top + lerp(42, -24, rise) * scale;
    const [sx0, sy0] = ringAt(g, th0);
    const glide = easeInOut(seg(t, T.pull1 - 380, T.trace0));
    const k = easeInOut(seg(t, T.trace0, T.trace1));
    const headTh = th0 + k * TAU;
    let hx, hy;
    if (k > 0) [hx, hy] = ringAt(g, headTh);
    else { hx = lerp(sunX, sx0, glide); hy = lerp(sunY, sy0, glide); }

    // the big light behind the limb, which shrinks into a point
    const bigA = rise * (1 - easeInOut(seg(t, T.pull0 + 300, T.pull1)));
    ctx.globalCompositeOperation = "lighter";
    glow(sunX, sunY, Math.hypot(width, height) * 0.45, "120,80,240", 0.36 * bigA);
    glow(sunX, sunY, 150 * scale, "235,228,255", 0.9 * bigA);
    ctx.globalCompositeOperation = "source-over";

    // the planet, dark, with its atmosphere on the limb until it is lit
    ctx.fillStyle = "#040210";
    ctx.beginPath();
    ctx.arc(px, py, R, 0, TAU);
    ctx.fill();
    const atm = 1 - lit;
    if (atm > 0.003) {
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(150,110,255,${(0.4 * atm).toFixed(3)})`;
      ctx.lineWidth = (10 + 18 * (1 - pull)) * scale;
      ctx.beginPath(); ctx.arc(px, py, R, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(236,230,255,${(0.9 * atm).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, 1.8 * scale);
      ctx.beginPath(); ctx.arc(px, py, R, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    }

    // the anamorphic flare as the light clears the horizon
    const fl = seg(t, 650, 2100);
    if (fl > 0 && fl < 1) {
      const peak = Math.sin(fl * Math.PI) * (1 - pull);
      const fy = top - 4 * scale;
      const sg = ctx.createLinearGradient(0, fy, width, fy);
      sg.addColorStop(0, "rgba(150,160,255,0)");
      sg.addColorStop(0.5, `rgba(240,240,255,${(0.8 * peak).toFixed(3)})`);
      sg.addColorStop(1, "rgba(150,160,255,0)");
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = sg;
      ctx.fillRect(0, fy - 1.4 * scale, width, 2.8 * scale);
      ctx.globalCompositeOperation = "source-over";
    }

    // Planet artwork only from the moment it starts to light; before
    // that it is a silhouette.
    if (t >= T.lit0) drawPlanetArt(g, lit);

    // the ring, as drawn so far
    const trailA = 1 - easeInOut(seg(t, T.lit0 + 200, T.lit1 + 300));
    if (k > 0 && trailA > 0.003) {
      ctx.globalCompositeOperation = "lighter";
      // flat ends: round caps overlap at every joint and bead the line
      ctx.lineCap = "butt";
      const steps = 150;
      for (let i = 0; i < steps; i++) {
        const a0 = th0 + k * TAU * (i / steps), a1 = th0 + k * TAU * ((i + 1) / steps);
        const [x0, y0] = ringAt(g, a0), [x1, y1] = ringAt(g, a1);
        if (hidden(g, a0, x0, y0) && hidden(g, a1, x1, y1)) continue;
        const w = i / steps;
        ctx.strokeStyle = `rgba(200,180,255,${((0.12 + 0.45 * w * w) * trailA).toFixed(3)})`;
        ctx.lineWidth = (6 + 4 * w) * scale;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.strokeStyle = `rgba(245,242,255,${((0.4 + 0.6 * w) * trailA).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, 1.6 * scale);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // the light itself, dimmed while it is behind the planet
    if (t > T.rise0 && t < T.trace1 + 500) {
      const behind = k > 0 && hidden(g, headTh, hx, hy) ? 0.15 : 1;
      const a = rise * behind * (1 - seg(t, T.trace1, T.trace1 + 500));
      ctx.globalCompositeOperation = "lighter";
      glow(hx, hy, 46 * scale, "190,160,255", 0.7 * a);
      glow(hx, hy, 9 * scale, "255,255,255", a);
      ctx.strokeStyle = `rgba(255,255,255,${(0.5 * a).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx - 22 * scale, hy); ctx.lineTo(hx + 22 * scale, hy);
      ctx.moveTo(hx, hy - 22 * scale); ctx.lineTo(hx, hy + 22 * scale);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    }

    // the loop closes: one glint where it began
    const gl = seg(t, T.trace1 - 80, T.trace1 + 700);
    if (gl > 0 && gl < 1) {
      const peak = gl < 0.2 ? gl / 0.2 : 1 - easeOut((gl - 0.2) / 0.8);
      ctx.globalCompositeOperation = "lighter";
      glow(sx0, sy0, 120 * scale, "220,200,255", 0.6 * peak);
      const span = 200 * scale;
      const sg = ctx.createLinearGradient(sx0 - span, 0, sx0 + span, 0);
      sg.addColorStop(0, "rgba(200,190,255,0)");
      sg.addColorStop(0.5, `rgba(255,255,255,${(0.75 * peak).toFixed(3)})`);
      sg.addColorStop(1, "rgba(200,190,255,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(sx0 - span, sy0 - 1.2 * scale, span * 2, 2.4 * scale);
      ctx.globalCompositeOperation = "source-over";
    }

    if (t >= T.wordIn) overlay.classList.add("is-arrived");
    if (t >= T.enterIn) overlay.classList.add("is-ready");
    if (t >= T.autoExit) finish();
  }

  // Kick off once the planet art is decoded, so it is never missing at
  // the moment of arrival. It is preloaded in the document head, so in
  // practice this has already resolved.
  let begun = false;
  const begin = () => {
    if (begun || done) return;
    begun = true;
    raf = requestAnimationFrame(frame);
  };
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
      raf = requestAnimationFrame(frame);
    }
  });
  }
})();
