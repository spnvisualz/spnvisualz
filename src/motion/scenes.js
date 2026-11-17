import { gsap, ScrollTrigger } from "./scrollTimeline.js";
import { splitInto } from "./parallax.js";

// Scroll scenes — one signature moment per chapter, all scrubbed to the
// scroll so the visitor drives them, forwards and backwards:
//
//   hero      the camera passes *through* the wordmark into the work
//   work      each reel grows from a dim card into the frame, then
//             recedes; a "now showing" readout rolls with it
//   services  the active row follows the scroll and recolours the
//             chrome object behind the list
//   lab       the portal opens: an aperture widens as it settles
//   contact   "Start a project" assembles from scattered letters
//
// Everything is decoration over content that reads without it, and none
// of it runs under reduced motion (the services row-follow is the one
// exception — it is state, not motion, and harmless either way).

const mq = (q) => matchMedia(q).matches;

// Deterministic scatter, so a refresh or resize re-measures to the same
// shape instead of throwing the letters somewhere new.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------- hero */
function heroPassThrough() {
  const hero = document.querySelector('[data-chapter="origin"]');
  const word = hero?.querySelector(".origin-word");
  if (!hero || !word) return;
  const support = hero.querySelectorAll(".origin-eyebrow--top, .origin-tagline, .origin-sub, .origin-cta");
  const foot = hero.querySelector(".origin-foot");

  const tl = gsap.timeline({
    scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.5, invalidateOnRefresh: true }
  });
  tl.to(support, { y: -50, opacity: 0, stagger: 0.02, duration: 0.16, ease: "power1.in" }, 0)
    .to(foot, { opacity: 0, duration: 0.2 }, 0)
    // y counters the scroll, so the name holds its place on screen while
    // the camera flies through it rather than sliding off the top.
    .to(word, { y: () => hero.offsetHeight * 0.85, duration: 1, ease: "none" }, 0)
    .to(word, { scale: 4, duration: 1, ease: "power1.in" }, 0)
    .to(word, { opacity: 0, duration: 0.45, ease: "power1.in" }, 0.55);
}

/* ---------------------------------------------------------- work */
function workReel() {
  const items = Array.from(document.querySelectorAll(".work-item"));
  if (!items.length) return;
  const narrow = mq("(max-width: 860px)");

  items.forEach((item, i) => {
    const media = item.querySelector(".work-item__media");
    const meta = item.querySelector(".work-item__meta");
    if (!media || !meta) return;
    const side = narrow ? 0 : i % 2 === 0 ? 1 : -1; // meta sits right on even indexes

    const tl = gsap.timeline({
      scrollTrigger: { trigger: item, start: "top bottom", end: "bottom top", scrub: 0.6 }
    });
    // in: a small rounded, shaded card opens into the frame
    tl.fromTo(
      media,
      { scale: narrow ? 0.88 : 0.72, borderRadius: narrow ? 18 : 30, "--shade": 0.7 },
      { scale: 1, borderRadius: 2, "--shade": 0, duration: 0.42, ease: "power2.out" },
      0
    )
      .fromTo(meta, { x: side * 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.36, ease: "power2.out" }, 0.08)
      // out: it recedes as the next one arrives
      .to(media, { scale: narrow ? 0.96 : 0.9, "--shade": 0.5, duration: 0.4, ease: "power1.in" }, 0.6)
      .to(meta, { opacity: 0.2, duration: 0.3, ease: "power1.in" }, 0.7);
  });

  // "Now showing" — desktop only (CSS), follows the project in the
  // middle of the screen.
  const hud = document.createElement("div");
  hud.className = "work-hud";
  hud.setAttribute("aria-hidden", "true");
  hud.innerHTML =
    '<span class="work-hud__label">Now showing</span>' +
    '<span class="work-hud__num"></span><span class="work-hud__total"></span>' +
    '<span class="work-hud__title"></span>' +
    '<span class="work-hud__bar"><i></i></span>';
  document.body.appendChild(hud);
  const numEl = hud.querySelector(".work-hud__num");
  const titleEl = hud.querySelector(".work-hud__title");
  hud.querySelector(".work-hud__total").textContent = `/ ${String(items.length).padStart(2, "0")}`;
  const bar = hud.querySelector(".work-hud__bar i");

  // Rolls the old value out and the new one in, in the scroll direction.
  const roll = (host, text, dir) => {
    const prev = host.querySelector("b:not(.is-out)");
    if (prev?.textContent === text) return;
    const next = document.createElement("b");
    next.textContent = text;
    next.style.transform = `translateY(${dir > 0 ? 100 : -100}%)`;
    host.appendChild(next);
    requestAnimationFrame(() => {
      next.style.transform = "translateY(0)";
      if (prev) {
        prev.classList.add("is-out");
        prev.style.transform = `translateY(${dir > 0 ? -100 : 100}%)`;
        setTimeout(() => prev.remove(), 700);
      }
    });
  };

  const labelOf = (item, i) => ({
    num: item.querySelector(".work-item__num")?.textContent?.trim() || String(i + 1).padStart(2, "0"),
    title: item.querySelector(".work-item__title")?.textContent?.trim() || ""
  });
  // Starts on the first project, so it is never an empty frame.
  const first = labelOf(items[0], 0);
  roll(numEl, first.num, 1);
  roll(titleEl, first.title, 1);

  items.forEach((item, i) => {
    const num = item.querySelector(".work-item__num")?.textContent?.trim() || String(i + 1).padStart(2, "0");
    const title = item.querySelector(".work-item__title")?.textContent?.trim() || "";
    ScrollTrigger.create({
      trigger: item,
      start: "top 55%",
      end: "bottom 55%",
      onToggle: (self) => {
        if (!self.isActive) return;
        roll(numEl, num, self.direction);
        roll(titleEl, title, self.direction);
      }
    });
  });

  const section = document.getElementById("work");
  if (section) {
    ScrollTrigger.create({
      trigger: section,
      start: "top 60%",
      end: "bottom 40%",
      onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
      onToggle: (self) => hud.classList.toggle("is-on", self.isActive)
    });
  }
}

/* ---------------------------------------------------------- services */
// The row in the middle of the screen is the active one. A custom event
// carries the index to the 3D object (SceneDirector), which recolours.
export function servicesFollow() {
  const rows = Array.from(document.querySelectorAll(".service-row"));
  if (!rows.length) return;
  const activate = (index) => {
    rows.forEach((r, i) => r.classList.toggle("is-active", i === index));
    window.dispatchEvent(new CustomEvent("spn:service", { detail: { index } }));
  };
  rows.forEach((row, i) => {
    ScrollTrigger.create({
      trigger: row,
      start: "top 58%",
      end: "bottom 58%",
      onToggle: (self) => self.isActive && activate(i)
    });
  });
}

/* ---------------------------------------------------------- lab */
function labPortal() {
  const section = document.querySelector('[data-chapter="lab"]');
  const portal = section?.querySelector(".lab-portal");
  if (!section || !portal) return;
  gsap.fromTo(
    section,
    { "--aperture": "0%", "--portal-scale": 0.8, "--portal-r": "48px" },
    {
      "--aperture": "78%",
      "--portal-scale": 1,
      "--portal-r": "2px",
      ease: "power2.out",
      scrollTrigger: { trigger: section, start: "top bottom", end: "center 55%", scrub: 0.6 }
    }
  );
}

/* ---------------------------------------------------------- contact */
function contactAssemble() {
  const heading = document.querySelector(".contact-inner h2");
  if (!heading) return;
  heading.classList.remove("reveal");
  // Words stay unbreakable; the letters inside them fly.
  splitInto(heading, "words");
  heading.querySelectorAll(".word").forEach((word) => {
    word.classList.add("word--chars");
    splitInto(word, "chars");
  });
  const chars = heading.querySelectorAll(".char");
  const rand = seeded(7);
  const narrow = mq("(max-width: 720px)");
  const spread = narrow ? 0.5 : 1;
  chars.forEach((c) => {
    c.dataset.x = String((rand() - 0.5) * 520 * spread);
    c.dataset.y = String((rand() - 0.3) * 320 * spread);
    c.dataset.r = String((rand() - 0.5) * 90);
  });
  gsap.fromTo(
    chars,
    {
      x: (i, el) => +el.dataset.x,
      y: (i, el) => +el.dataset.y,
      rotation: (i, el) => +el.dataset.r,
      opacity: 0,
      scale: 0.5
    },
    {
      x: 0,
      y: 0,
      rotation: 0,
      opacity: 1,
      scale: 1,
      ease: "power3.out",
      stagger: { amount: 0.35, from: "random" },
      scrollTrigger: {
        trigger: heading.closest("section") || heading,
        start: "top 90%",
        end: "top 20%",
        scrub: 0.7
      }
    }
  );
}

export function initScenes({ reduceMotion = false } = {}) {
  servicesFollow();
  if (reduceMotion) return;
  document.documentElement.classList.add("scenes");
  heroPassThrough();
  workReel();
  labPortal();
  contactAssemble();
}
