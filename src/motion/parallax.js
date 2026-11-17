import { gsap, ScrollTrigger } from "./scrollTimeline.js";

// The depth layer: motion that answers scroll position.
//
// Deliberately restrained. Each effect is a plain ScrollTrigger scrub on
// the same Lenis-driven clock as the rest of the page, nothing here
// carries meaning, and with reduced motion everything stays at rest.
//
// GSAP owns `transform` on anything it scrubs. The hero's cursor lean and
// the staggered arrivals use the independent `translate`/`rotate`
// properties instead, so the two compose rather than overwrite.

const isFinePointer = () => matchMedia("(hover: hover) and (pointer: fine)").matches;

// Splits text into spans without losing it: the element keeps its real
// text, so headings still read correctly to search and assistive tech.
// <br> and other elements survive as they are.
export function splitInto(el, mode) {
  if (el.dataset.split) return;
  el.dataset.split = mode;
  const nodes = Array.from(el.childNodes);
  el.textContent = "";
  let index = 0;
  nodes.forEach((node) => {
    if (node.nodeType !== Node.TEXT_NODE) {
      el.appendChild(node);
      return;
    }
    const parts = mode === "chars" ? Array.from(node.textContent) : node.textContent.split(/(\s+)/);
    parts.forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        el.appendChild(document.createTextNode(part));
        return;
      }
      const span = document.createElement("span");
      span.className = mode === "chars" ? "char" : "word";
      span.style.setProperty("--i", String(index++));
      span.textContent = part;
      el.appendChild(span);
    });
  });
  el.style.setProperty("--count", String(index));
}

// data-speed: vertical drift relative to the scroll. Positive values lag
// (read as further away), negative values lead (read as closer).
function bindSpeedLayers(isNarrow) {
  document.querySelectorAll("[data-speed]").forEach((el) => {
    const speed = parseFloat(el.dataset.speed) || 0;
    if (!speed) return;
    const factor = isNarrow ? 0.5 : 1;
    const range = () => window.innerHeight * 0.35 * speed * factor;
    gsap.fromTo(
      el,
      { y: () => -range() },
      {
        y: () => range(),
        ease: "none",
        scrollTrigger: {
          trigger: el.closest("section, .chapter") || el,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.5,
          invalidateOnRefresh: true
        }
      }
    );
  });
}

// The hero leaves rather than simply scrolling away: the lockup sinks a
// little slower than the page and dims.
function bindHeroExit() {
  const hero = document.querySelector('[data-chapter="origin"]');
  const mark = hero?.querySelector("[data-hero-mark]");
  if (!hero || !mark) return;
  gsap.to(mark, {
    yPercent: 18,
    scale: 0.96,
    opacity: 0,
    ease: "none",
    scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.4 }
  });
  const foot = hero.querySelector(".origin-foot");
  if (foot) {
    gsap.to(foot, {
      opacity: 0,
      ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "25% top", scrub: 0.4 }
    });
  }
}

// Desktop only: the wordmark leans toward the cursor. Written as custom
// properties consumed by `translate` in studio.css.
function bindHeroPointer() {
  const hero = document.querySelector('[data-chapter="origin"]');
  if (!hero || !isFinePointer()) return;
  let tx = 0, ty = 0, x = 0, y = 0, running = false;
  const step = () => {
    x += (tx - x) * 0.07;
    y += (ty - y) * 0.07;
    hero.style.setProperty("--px", x.toFixed(4));
    hero.style.setProperty("--py", y.toFixed(4));
    if (Math.abs(tx - x) > 0.0005 || Math.abs(ty - y) > 0.0005) requestAnimationFrame(step);
    else running = false;
  };
  const kick = () => {
    if (running) return;
    running = true;
    requestAnimationFrame(step);
  };
  hero.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    tx = (e.clientX / window.innerWidth) * 2 - 1;
    ty = (e.clientY / window.innerHeight) * 2 - 1;
    kick();
  });
  hero.addEventListener("pointerleave", () => {
    tx = 0;
    ty = 0;
    kick();
  });
}

// Manifesto: each word brightens as the line passes through the middle
// of the viewport, so the sentence is read at the speed it is scrolled.
function bindManifesto() {
  const line = document.querySelector("[data-split-words]");
  if (!line) return;
  splitInto(line, "words");
  gsap.fromTo(
    line.querySelectorAll(".word"),
    { opacity: 0.18 },
    {
      opacity: 1,
      ease: "none",
      stagger: 0.1,
      scrollTrigger: { trigger: line, start: "top 80%", end: "bottom 45%", scrub: 0.5 }
    }
  );
}

// Selected Work: each panel opens from a slight inset as it arrives.
function bindWorkReveal(isNarrow) {
  if (isNarrow) return;
  document.querySelectorAll(".work-item").forEach((item) => {
    const media = item.querySelector(".work-item__media");
    if (!media) return;
    gsap.fromTo(
      media,
      { clipPath: "inset(8% 6% 8% 6%)" },
      {
        clipPath: "inset(0% 0% 0% 0%)",
        ease: "none",
        scrollTrigger: { trigger: item, start: "top bottom", end: "top 45%", scrub: 0.5 }
      }
    );
  });
}

// Children of [data-stagger] arrive one after another (translate +
// opacity, so nothing GSAP scrubs is fought over).
function initStagger({ reduceMotion }) {
  document.querySelectorAll("[data-stagger]").forEach((list) => {
    const items = Array.from(list.children);
    items.forEach((child, i) => {
      child.classList.add("stagger-item");
      child.style.setProperty("--stagger", String(i));
    });
    if (reduceMotion) {
      items.forEach((child) => child.classList.add("is-in"));
      return;
    }
    ScrollTrigger.create({
      trigger: list,
      start: "top 85%",
      once: true,
      onEnter: () => items.forEach((child) => child.classList.add("is-in"))
    });
  });
}

// A soft light that follows the cursor across a card (CSS variables only).
function initSpotlights() {
  if (!isFinePointer()) return;
  document.querySelectorAll("[data-spotlight]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--sx", `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty("--sy", `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });
}

export function initDepth({ reduceMotion = false } = {}) {
  document.documentElement.classList.add("depth-ready");
  initStagger({ reduceMotion });
  initSpotlights();
  if (reduceMotion) return;

  const isNarrow = matchMedia("(max-width: 720px)").matches;
  bindSpeedLayers(isNarrow);
  bindHeroExit();
  bindHeroPointer();
  bindManifesto();
  bindWorkReveal(isNarrow);
}

// The hero's entrance is held until the page is actually visible —
// underneath the intro overlay it would play to nobody.
export function playHeroEntrance() {
  document.querySelector('[data-chapter="origin"]')?.classList.add("is-live");
}
