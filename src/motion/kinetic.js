import { gsap, ScrollTrigger, getLenis } from "./scrollTimeline.js";
import { splitInto } from "./parallax.js";

// Kinetic layer — the animation that responds to the visitor, where
// parallax.js is the animation that responds to position.
//
//   cursor      a follower ring that grows and labels what it is over
//   masks       headings rise line by line out of a clipped edge
//   scramble    mono labels decode into place as they arrive
//   velocity    the marquee runs on its own and speeds up with the scroll;
//               the work reel leans into fast scrolling
//   tilt        work panels turn toward the cursor
//   process     the four steps are walked through on a pinned timeline
//   counters    prices count up the first time they are seen
//   footer      a full-width wordmark rises as the page ends
//
// Same rules as parallax.js: nothing here carries meaning, the real text
// is always in the DOM, and reduced motion gets the resting state.

const finePointer = () => matchMedia("(hover: hover) and (pointer: fine)").matches;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ---------------------------------------------------------- cursor */
function initCursor() {
  if (!finePointer()) return;
  const cursor = document.createElement("div");
  cursor.className = "cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = '<span class="cursor__ring"></span><span class="cursor__label"></span>';
  document.body.appendChild(cursor);
  const label = cursor.querySelector(".cursor__label");

  const xTo = gsap.quickTo(cursor, "x", { duration: 0.45, ease: "power3" });
  const yTo = gsap.quickTo(cursor, "y", { duration: 0.45, ease: "power3" });

  let shown = false;
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    if (!shown) {
      shown = true;
      gsap.set(cursor, { x: e.clientX, y: e.clientY });
      cursor.classList.add("is-on");
    }
    xTo(e.clientX);
    yTo(e.clientY);
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => cursor.classList.remove("is-on"));
  document.documentElement.addEventListener("pointerenter", () => shown && cursor.classList.add("is-on"));
  window.addEventListener("pointerdown", () => cursor.classList.add("is-down"));
  window.addEventListener("pointerup", () => cursor.classList.remove("is-down"));

  // Labels for things whose markup is generated elsewhere and tested as-is.
  document.querySelectorAll(".work-item__media").forEach((el) => (el.dataset.cursor ||= "Play"));
  document.querySelectorAll(".lab-portal").forEach((el) => (el.dataset.cursor ||= "Enter"));
  document.querySelectorAll(".service-row").forEach((el) => (el.dataset.cursor ||= "Open"));

  const interactive = "a, button, [role=tab], input, select, textarea, label";
  document.addEventListener("pointerover", (e) => {
    const labelled = e.target.closest?.("[data-cursor]");
    if (labelled) {
      label.textContent = labelled.dataset.cursor;
      cursor.classList.add("has-label");
      cursor.classList.remove("is-link");
      return;
    }
    cursor.classList.remove("has-label");
    cursor.classList.toggle("is-link", Boolean(e.target.closest?.(interactive)));
  });

  // Dialogs sit in the top layer, above anything a z-index can reach, so
  // the follower would vanish behind them. Hide it while one is open.
  const observer = new MutationObserver(() => {
    cursor.classList.toggle("is-hidden", Boolean(document.querySelector("dialog[open]")) || document.body.classList.contains("menu-open"));
  });
  document.querySelectorAll("dialog").forEach((d) => observer.observe(d, { attributes: true, attributeFilter: ["open"] }));
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
}

/* ---------------------------------------------------------- masks */
// Each word gets a clipping wrapper; its inner span rises out of it.
function maskWords(el) {
  if (el.dataset.masked) return;
  el.dataset.masked = "1";
  splitInto(el, "words");
  el.querySelectorAll(".word").forEach((word) => {
    const inner = document.createElement("span");
    inner.className = "mask__inner";
    inner.textContent = word.textContent;
    word.textContent = "";
    word.classList.add("mask");
    word.appendChild(inner);
  });
}

function initMasks() {
  const targets = document.querySelectorAll(
    ".section-head h2, .work-head h2, .contact-inner h2, .lab-portal h2, .work-item__title"
  );
  targets.forEach((el) => {
    maskWords(el);
    // A heading inside a .reveal parent is already being faded in; the
    // h2 itself drops its own .reveal so it does not fade twice.
    el.classList.remove("reveal");
    el.classList.add("is-masked");
    ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      once: true,
      onEnter: () => el.classList.add("is-in")
    });
  });
}

/* ---------------------------------------------------------- scramble */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#*+<>";
function scramble(el) {
  const final = el.textContent;
  if (!final.trim()) return;
  // Pinned width so the line does not reflow while it is noise.
  el.style.minWidth = `${el.getBoundingClientRect().width}px`;
  const frames = 22;
  let frame = 0;
  const tick = () => {
    frame++;
    const settled = Math.floor((frame / frames) * final.length);
    let out = "";
    for (let i = 0; i < final.length; i++) {
      const ch = final[i];
      out += i < settled || ch === " " ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (frame < frames) requestAnimationFrame(tick);
    else {
      el.textContent = final;
      el.style.minWidth = "";
    }
  };
  requestAnimationFrame(tick);
}

function initScramble() {
  document.querySelectorAll(".section-label, .work-item__tag, .lab-portal__label").forEach((el) => {
    // Only plain-text labels: .work-item__tag holds a number span, which
    // is left alone and the text after it is decoded instead.
    const target = el.children.length ? null : el;
    const textNode = target ? null : Array.from(el.childNodes).find((n) => n.nodeType === 3 && n.textContent.trim());
    if (!target && !textNode) return;
    let host = target;
    if (!host) {
      host = document.createElement("span");
      host.textContent = textNode.textContent;
      textNode.replaceWith(host);
    }
    ScrollTrigger.create({ trigger: el, start: "top 90%", once: true, onEnter: () => scramble(host) });
  });
}

/* ---------------------------------------------------------- velocity */
// Lenis reports velocity in px per frame. Smoothed here so the effects
// ease in and out of a flick rather than snapping.
const velocity = { raw: 0, smooth: 0 };
function trackVelocity() {
  const lenis = getLenis();
  lenis?.on("scroll", (e) => {
    velocity.raw = e.velocity || 0;
  });
  gsap.ticker.add(() => {
    velocity.smooth += (velocity.raw - velocity.smooth) * 0.12;
    velocity.raw *= 0.9; // Lenis stops reporting at rest; decay to zero
  });
}

function initMarqueeLoop() {
  const band = document.querySelector(".marquee-band");
  if (!band) return;
  const rows = Array.from(band.querySelectorAll("[data-marquee]")).map((el) => ({
    el,
    dir: parseFloat(el.dataset.marquee) || 1,
    x: 0,
    half: 0,
    set: gsap.quickSetter(el, "x", "px")
  }));
  const measure = () => rows.forEach((r) => {
    r.half = r.el.scrollWidth / 2;
    if (r.dir > 0) r.x = -r.half;
  });
  measure();
  window.addEventListener("resize", measure);
  document.fonts?.ready?.then(measure).catch(() => {});

  let visible = false;
  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(band);

  gsap.ticker.add((_, delta) => {
    if (!visible) return;
    const dt = Math.min(delta, 50) / 1000;
    // Drifts on its own; scrolling down pushes both rows faster along
    // their own direction, and a hard scroll back up throws them the
    // other way for a moment.
    const speed = 48 + velocity.smooth * 9;
    rows.forEach((r) => {
      if (!r.half) return;
      r.x += r.dir * speed * dt;
      if (r.x <= -r.half) r.x += r.half;
      if (r.x > 0) r.x -= r.half;
      r.set(r.x);
    });
    band.style.setProperty("--skew", `${clamp(velocity.smooth * -0.35, -6, 6).toFixed(2)}deg`);
  });
}

function initWorkLean() {
  const track = document.getElementById("workTrack");
  if (!track) return;
  const skewTo = gsap.quickTo(track, "skewY", { duration: 0.6, ease: "power3" });
  let last = 0;
  gsap.ticker.add(() => {
    const target = clamp(velocity.smooth * -0.12, -3, 3);
    if (Math.abs(target - last) < 0.01) return;
    last = target;
    skewTo(target);
  });
}

/* ---------------------------------------------------------- tilt */
function initTilt() {
  if (!finePointer()) return;
  document.querySelectorAll(".work-item__media").forEach((media) => {
    gsap.set(media, { transformPerspective: 1100 });
    const rx = gsap.quickTo(media, "rotationX", { duration: 0.6, ease: "power3" });
    const ry = gsap.quickTo(media, "rotationY", { duration: 0.6, ease: "power3" });
    media.addEventListener("pointermove", (e) => {
      const r = media.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      ry(px * 7);
      rx(py * -6);
      media.style.setProperty("--gx", `${(px + 0.5) * 100}%`);
      media.style.setProperty("--gy", `${(py + 0.5) * 100}%`);
    });
    media.addEventListener("pointerleave", () => {
      rx(0);
      ry(0);
    });
  });
}

/* ---------------------------------------------------------- process */
// Desktop: the section holds while a line draws across the four steps
// and each lights as the line reaches it. Narrow screens have them
// stacked, so each simply lights as it crosses the middle of the screen.
function initProcess() {
  const list = document.querySelector("[data-process-line]");
  const section = list?.closest("section");
  if (!list || !section) return;
  const cards = Array.from(list.children);
  const line = document.createElement("span");
  line.className = "process-progress";
  line.setAttribute("aria-hidden", "true");
  line.innerHTML = "<i></i>";
  list.appendChild(line);
  const fill = line.firstElementChild;

  const mm = gsap.matchMedia();
  mm.add("(min-width: 901px)", () => {
    const st = ScrollTrigger.create({
      trigger: section,
      start: "center center",
      end: () => "+=" + Math.round(window.innerHeight * 0.9),
      pin: true,
      scrub: 0.4,
      onUpdate: (self) => {
        gsap.set(fill, { scaleX: self.progress });
        cards.forEach((card, i) => card.classList.toggle("is-active", self.progress >= i / cards.length + 0.02));
      }
    });
    return () => st.kill();
  });
  mm.add("(max-width: 900px)", () => {
    const triggers = cards.map((card) =>
      ScrollTrigger.create({
        trigger: card,
        start: "top 65%",
        end: "bottom 35%",
        onToggle: (self) => card.classList.toggle("is-active", self.isActive)
      })
    );
    return () => triggers.forEach((t) => t.kill());
  });
}

/* ---------------------------------------------------------- counters */
function initCounters() {
  document.querySelectorAll(".price-tier b, .bundle-card strong").forEach((el) => {
    const original = el.textContent;
    const match = original.match(/^(\D*)(\d+)(.*)$/);
    if (!match) return;
    const [, pre, num, post] = match;
    const to = parseInt(num, 10);
    el.style.fontVariantNumeric = "tabular-nums";
    ScrollTrigger.create({
      trigger: el,
      start: "top 92%",
      once: true,
      onEnter: () => {
        const state = { v: 0 };
        gsap.to(state, {
          v: to,
          duration: 1.1,
          ease: "power3.out",
          onUpdate: () => (el.textContent = `${pre}${Math.round(state.v)}${post}`),
          onComplete: () => (el.textContent = original)
        });
      }
    });
  });
}

/* ---------------------------------------------------------- footer */
function initFooterGiant() {
  const giant = document.querySelector("[data-footer-giant]");
  if (!giant) return;
  splitInto(giant, "chars");
  gsap.fromTo(
    giant.querySelectorAll(".char"),
    { yPercent: 100 },
    {
      yPercent: 0,
      ease: "none",
      stagger: 0.05,
      scrollTrigger: { trigger: giant.parentElement, start: "top bottom", end: "bottom bottom", scrub: 0.6 }
    }
  );
}

export function initKinetic({ reduceMotion = false } = {}) {
  if (reduceMotion) return;
  document.documentElement.classList.add("kinetic");
  // The pin goes first: ScrollTrigger measures in creation order, and
  // anything below a pin has to be measured after the pin's spacing.
  initProcess();
  trackVelocity();
  initMasks();
  initScramble();
  initMarqueeLoop();
  initWorkLean();
  initTilt();
  initCounters();
  initFooterGiant();
  initCursor();
}
