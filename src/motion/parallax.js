import { gsap, ScrollTrigger } from "./scrollTimeline.js";

// The depth layer.
//
// Everything here is decoration on top of content that already reads
// without it: no element is created that carries meaning, and with
// reduced motion every effect collapses to its resting state. Each effect
// is a plain ScrollTrigger scrub so it rides the same Lenis-driven clock
// as the rest of the page — there is no second scroll listener to drift.
//
// Two rules keep these from fighting the existing motion:
//
//  1. GSAP owns `transform`. Anything else that moves the same element
//     uses an independent CSS property (`translate`, `opacity`), so the
//     hero's mouse drift and the staggered reveals compose with the
//     scroll parallax instead of overwriting it.
//  2. Nothing here is put on a .btn or other magnetic element — magnetic.js
//     writes style.transform directly and would be clobbered.

const isFinePointer = () => matchMedia("(hover: hover) and (pointer: fine)").matches;

// Splits text into spans without losing it: the element keeps its real
// text content, so headings still read correctly to search and assistive
// tech. <br> survives as-is.
function splitInto(el, mode) {
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
// behind (read as further away), negative values lead (read as closer).
function bindSpeedLayers(isNarrow) {
  document.querySelectorAll("[data-speed]").forEach((el) => {
    const speed = parseFloat(el.dataset.speed) || 0;
    if (!speed) return;
    // Phones get the same layering at half the travel: the viewport is
    // short, and large offsets there read as content sliding about.
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

// The hero leaves rather than simply scrolling away: the wordmark sinks
// a little slower than the page and dims, so the marquee arrives over it.
function bindHeroExit() {
  const hero = document.querySelector('[data-chapter="origin"]');
  const mark = hero?.querySelector("[data-hero-mark]");
  if (!hero || !mark) return;
  gsap.to(mark, {
    yPercent: 28,
    scale: 0.94,
    opacity: 0,
    ease: "none",
    scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.4 }
  });
  const meta = hero.querySelector(".origin-meta");
  if (meta) {
    gsap.to(meta, {
      opacity: 0,
      y: -40,
      ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "40% top", scrub: 0.4 }
    });
  }
}

// Desktop only: the wordmark and the depth layers lean toward the cursor
// by different amounts. Written as CSS custom properties consumed by the
// `translate` property, so it composes with GSAP's transform above.
function bindHeroPointer() {
  const hero = document.querySelector('[data-chapter="origin"]');
  if (!hero || !isFinePointer()) return;
  let tx = 0, ty = 0, x = 0, y = 0, raf = 0, running = false;
  const step = () => {
    x += (tx - x) * 0.08;
    y += (ty - y) * 0.08;
    hero.style.setProperty("--px", x.toFixed(4));
    hero.style.setProperty("--py", y.toFixed(4));
    if (Math.abs(tx - x) > 0.0005 || Math.abs(ty - y) > 0.0005) {
      raf = requestAnimationFrame(step);
    } else {
      running = false;
    }
  };
  const kick = () => {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(step);
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
  // Stops work while the hero is off screen.
  ScrollTrigger.create({
    trigger: hero,
    start: "top top",
    end: "bottom top",
    onLeave: () => cancelAnimationFrame(raf)
  });
}

// Two rows of service names moving in opposite directions, driven by the
// scroll rather than a clock — they move only when the visitor does.
function bindMarquee(isNarrow) {
  const band = document.querySelector(".marquee-band");
  if (!band) return;
  band.querySelectorAll("[data-marquee]").forEach((row) => {
    const dir = parseFloat(row.dataset.marquee) || 1;
    const travel = isNarrow ? 30 : 22;
    gsap.fromTo(
      row,
      { xPercent: dir < 0 ? 0 : -travel },
      {
        xPercent: dir < 0 ? -travel : 0,
        ease: "none",
        scrollTrigger: { trigger: band, start: "top bottom", end: "bottom top", scrub: 0.6 }
      }
    );
  });
}

// Oversized outline words behind section headings, drifting sideways.
function bindGhostWords() {
  document.querySelectorAll("[data-drift]").forEach((el) => {
    const dir = parseFloat(el.dataset.drift) || 1;
    gsap.fromTo(
      el,
      { xPercent: dir * -12 },
      {
        xPercent: dir * 12,
        ease: "none",
        scrollTrigger: {
          trigger: el.closest("section") || el,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.8
        }
      }
    );
  });
}

// Manifesto: each word brightens as the line passes through the middle
// of the viewport, so the sentence is read at the speed it is scrolled.
function bindManifesto() {
  const line = document.querySelector("[data-split-words]");
  if (!line) return;
  splitInto(line, "words");
  const words = line.querySelectorAll(".word");
  gsap.fromTo(
    words,
    { opacity: 0.16 },
    {
      opacity: 1,
      ease: "none",
      stagger: 0.1,
      scrollTrigger: { trigger: line, start: "top 82%", end: "bottom 42%", scrub: 0.5 }
    }
  );
}

// Selected Work: a large outline index behind each project's text, moving
// faster than the text itself, and the media panel opening from an inset
// as it enters. The index is decoration built here so the shipped markup
// (generated by scripts/build-work.mjs) stays exactly as tested.
function bindWorkDepth(isNarrow) {
  document.querySelectorAll(".work-item").forEach((item) => {
    const meta = item.querySelector(".work-item__meta");
    const num = item.querySelector(".work-item__num")?.textContent?.trim();
    if (meta && num && !item.querySelector(".work-item__ghost")) {
      const ghost = document.createElement("span");
      ghost.className = "work-item__ghost";
      ghost.setAttribute("aria-hidden", "true");
      ghost.textContent = num;
      item.insertBefore(ghost, item.firstChild);
      gsap.fromTo(
        ghost,
        { yPercent: 40 },
        {
          yPercent: -60,
          ease: "none",
          scrollTrigger: { trigger: item, start: "top bottom", end: "bottom top", scrub: 0.6 }
        }
      );
    }

    const media = item.querySelector(".work-item__media");
    if (media && !isNarrow) {
      gsap.fromTo(
        media,
        { clipPath: "inset(10% 8% 10% 8%)" },
        {
          clipPath: "inset(0% 0% 0% 0%)",
          ease: "none",
          scrollTrigger: { trigger: item, start: "top bottom", end: "top 45%", scrub: 0.5 }
        }
      );
    }
  });
}

export function initDepth({ reduceMotion = false } = {}) {
  // Split the hero wordmark regardless of motion preference: the letters
  // are styled individually either way, and under reduced motion they are
  // simply shown at rest.
  document.querySelectorAll("[data-split-chars]").forEach((el) => splitInto(el, "chars"));
  document.documentElement.classList.add("depth-ready");

  initStagger({ reduceMotion });
  initSpotlights();

  if (reduceMotion) {
    document.documentElement.classList.add("depth-static");
    return;
  }

  const isNarrow = matchMedia("(max-width: 720px)").matches;
  bindSpeedLayers(isNarrow);
  bindHeroExit();
  bindHeroPointer();
  bindMarquee(isNarrow);
  bindGhostWords();
  bindManifesto();
  bindWorkDepth(isNarrow);
}

// The hero's letter-by-letter entrance is held until the page is actually
// visible — underneath the intro overlay it would play to nobody.
export function playHeroEntrance() {
  document.querySelector('[data-chapter="origin"]')?.classList.add("is-live");
}

// Children of [data-stagger] arrive one after another. Uses the `translate`
// property and opacity (see the note at the top) so items that also carry
// a data-speed drift are not fought over.
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

// A soft light that follows the cursor across a card. Pure CSS variables;
// on touch it simply stays centred and dim.
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
