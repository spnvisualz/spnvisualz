(() => {
  "use strict";

  /*
   * SPNVISUALZ — the arrival.
   *
   * A hyperspace jump. The stars hang still for a beat, stretch into
   * streaks, and the frame is thrown down a blue-violet tunnel; then a
   * flash, the streaks snap back to points, and SPN-1 — the S planet — is
   * right there in front of you. This is the first thing a visitor sees, so it is deliberately
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
  const SEEN_KEY = "spn_intro_seen_v4";

  // Every timing in one place, in ms from the first frame: a beat of
  // stillness, the jump, the tunnel, the drop out, then the planet at rest.
  // ~4.2s of content plus a 620ms exit, once per tab session.
  const T = {
    still:     650,   // stars at rest, light gathering at the centre
    jump:      1150,  // ...stretching into streaks, full speed by here
    dropOut:   2350,  // the flash: out of hyperspace
    settle:    3500,  // the planet has finished settling
    wordIn:    2950,
    enterIn:   3350,
    autoExit:  4200,
    fade:      620
  };

  const DEPTH = 1600;       // z at which stars respawn
  const FOCAL = 520;        // projection focal length, in px at z=1
  const HYPER = 5400;       // z-units per second in hyperspace
  const DRIFT = 22;         // z-units per second at rest
  const SPREAD = 1300;      // how far off-axis stars are scattered
  const HOLE = 70;          // nothing on the axis itself: the tunnel's eye
  // A streak is "where this star was TRAIL seconds ago", so its length is
  // the same at 60Hz and 120Hz. Longer in hyperspace, by design.
  const TRAIL = 0.085;

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeIn = (t) => t * t * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

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

  // Star count follows the device: a mid-range phone should not be asked
  // to draw 600 streaks a frame because a desktop can.
  const cores = navigator.hardwareConcurrency || 4;
  const area = window.innerWidth * window.innerHeight;
  const STARS = Math.round(
    Math.min(680, Math.max(240, (area / 1900) * (cores <= 4 ? 0.65 : 1)))
  );

  const rand = (a, b) => a + Math.random() * (b - a);
  const place = (s) => {
    // uniform over a disc with a hole in the middle
    const a = Math.random() * Math.PI * 2;
    const r = HOLE + Math.sqrt(Math.random()) * SPREAD;
    s.x = Math.cos(a) * r;
    s.y = Math.sin(a) * r;
  };

  const stars = [];
  for (let i = 0; i < STARS; i++) {
    const s = { x: 0, y: 0, z: rand(1, DEPTH), tint: Math.random() };
    place(s);
    stars.push(s);
  }

  // Speed over time: still, then an accelerating lurch into hyperspace,
  // held, then cut to a drift at the drop out.
  function speedAt(t) {
    if (t < T.still) return DRIFT;
    if (t < T.jump) {
      const k = (t - T.still) / (T.jump - T.still);
      return DRIFT + Math.pow(k, 2.6) * (HYPER - DRIFT);
    }
    if (t < T.dropOut) return HYPER;
    const k = clamp01((t - T.dropOut) / 260);
    return HYPER + (DRIFT - HYPER) * easeOut(k);
  }
  // 0 at rest, 1 in hyperspace: drives colour, the tunnel and the shake.
  function hyperAt(t) {
    if (t < T.still) return 0;
    if (t < T.jump) return easeIn((t - T.still) / (T.jump - T.still));
    if (t < T.dropOut) return 1;
    return 1 - clamp01((t - T.dropOut) / 200);
  }

  // ------------------------------------------------------------- drawing
  function drawGather(t) {
    // The light gathering at the centre before the jump.
    const k = t < T.dropOut ? clamp01(t / T.jump) : 0;
    if (k <= 0) return;
    const r = Math.max(width, height) * (0.12 + k * 0.25);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(200,190,255,${(0.16 * k).toFixed(3)})`);
    g.addColorStop(0.4, `rgba(120,90,255,${(0.07 * k).toFixed(3)})`);
    g.addColorStop(1, "rgba(60,40,160,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  function drawTunnel(t, hyper) {
    // Hyperspace itself: a bright eye down the axis and slow-turning
    // bands of blue and violet on the tunnel walls.
    if (hyper <= 0.01) return;
    const R = Math.hypot(width, height) * 0.6;
    const eye = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    eye.addColorStop(0, `rgba(235,240,255,${(0.55 * hyper).toFixed(3)})`);
    eye.addColorStop(0.08, `rgba(150,170,255,${(0.28 * hyper).toFixed(3)})`);
    eye.addColorStop(0.35, `rgba(90,70,220,${(0.12 * hyper).toFixed(3)})`);
    eye.addColorStop(1, "rgba(20,12,60,0)");
    ctx.fillStyle = eye;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.00035);
    ctx.globalCompositeOperation = "lighter";
    const bands = 30;
    for (let i = 0; i < bands; i++) {
      const a0 = (i / bands) * Math.PI * 2;
      const flicker = 0.5 + 0.5 * Math.sin(t * 0.011 + i * 2.3);
      const g = ctx.createRadialGradient(0, 0, R * 0.05, 0, 0, R);
      const hue = i % 3 === 0 ? "160,130,255" : "120,150,255";
      g.addColorStop(0, `rgba(${hue},0)`);
      g.addColorStop(0.5, `rgba(${hue},${(0.03 * hyper * flicker).toFixed(3)})`);
      g.addColorStop(1, `rgba(${hue},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, a0, a0 + 0.05);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
  }

  function drawStars(dt, speed, hyper) {
    ctx.lineCap = "round";
    ctx.globalCompositeOperation = "lighter";
    const trail = TRAIL * (0.35 + hyper * 0.65);
    for (const s of stars) {
      s.z -= speed * dt;
      if (s.z < 1) {
        s.z = DEPTH;
        place(s);
      }
      const k = FOCAL / s.z;
      const x = cx + s.x * k * scale;
      const y = cy + s.y * k * scale;
      if (x < -80 || x > width + 80 || y < -80 || y > height + 80) continue;

      const near = clamp01(1 - s.z / DEPTH);
      const pz = s.z + speed * trail;
      const pk = FOCAL / pz;
      const px = cx + s.x * pk * scale;
      const py = cy + s.y * pk * scale;

      // starlight at rest; white-hot with a blue or violet edge in the jump
      const rgb = s.tint < 0.12 && hyper < 0.3
        ? "232,194,122"
        : s.tint < 0.55 ? "214,222,255" : "206,186,255";
      const alpha = 0.34 + near * 0.66;
      const w = Math.max(0.8, (0.7 + near * (1.6 + hyper * 0.8)) * scale);
      const len = Math.hypot(x - px, y - py);

      if (len > 1.4) {
        const g = ctx.createLinearGradient(px, py, x, y);
        g.addColorStop(0, `rgba(${rgb},0)`);
        g.addColorStop(0.7, `rgba(${rgb},${(alpha * 0.7).toFixed(3)})`);
        g.addColorStop(1, `rgba(255,255,255,${alpha.toFixed(3)})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, w * 0.62, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawHomePlanet(t) {
    if (t < T.dropOut) return;
    // Out of hyperspace and already close: the planet fills in through the
    // flash and settles back the last few percent, so the arrival lands.
    const k = easeOut(clamp01((t - T.dropOut) / (T.settle - T.dropOut)));
    const appear = clamp01((t - T.dropOut) / 260);
    const rest = Math.min(width * 0.72, height * 0.52);  // matches .spn-intro__poster
    const size = rest * (1.16 - 0.16 * k);
    const drift = Math.sin(t / 1500) * 4 * k;
    const x = cx;
    const y = cy - height * 0.015 + drift;

    const glow = ctx.createRadialGradient(x, y, size * 0.28, x, y, size * 0.95);
    glow.addColorStop(0, `rgba(138,77,255,${(0.16 * appear).toFixed(3)})`);
    glow.addColorStop(0.55, `rgba(110,70,220,${(0.06 * appear).toFixed(3)})`);
    glow.addColorStop(1, "rgba(110,70,220,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.95, 0, Math.PI * 2);
    ctx.fill();

    if (!poster || !poster.complete || !poster.naturalWidth) return;
    const ar = poster.naturalHeight / poster.naturalWidth;
    ctx.globalAlpha = appear;
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(poster, x - size / 2, y - (size * ar) / 2, size, size * ar);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  function drawFlash(t) {
    // The drop out: a white-violet flash that clears in half a second.
    if (t < T.dropOut - 60) return;
    const k = clamp01((t - (T.dropOut - 60)) / 520);
    const a = k < 0.12 ? k / 0.12 : 1 - easeOut((k - 0.12) / 0.88);
    if (a <= 0.003) return;
    ctx.fillStyle = `rgba(236,230,255,${(a * 0.8).toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
  }

  // ---------------------------------------------------------------- loop
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!start) { start = now; last = now; }
    const t = done ? T.autoExit : now - start;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const speed = speedAt(t);
    const hyper = hyperAt(t);

    // a shudder through the jump, gone once in the tunnel
    const shake = t > T.still && t < T.jump + 250
      ? Math.sin(((t - T.still) / (T.jump + 250 - T.still)) * Math.PI) * 3.2 * scale
      : 0;

    ctx.save();
    ctx.translate(rand(-shake, shake), rand(-shake, shake));

    // deep space, repainted every frame
    const ground = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.8);
    ground.addColorStop(0, "#0b0720");
    ground.addColorStop(0.6, "#060416");
    ground.addColorStop(1, "#020109");
    ctx.fillStyle = ground;
    ctx.fillRect(-10, -10, width + 20, height + 20);

    drawGather(t);
    drawTunnel(t, hyper);
    drawStars(dt, speed, hyper);
    drawHomePlanet(t);
    drawFlash(t);
    ctx.restore();

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
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  });
  }
})();
