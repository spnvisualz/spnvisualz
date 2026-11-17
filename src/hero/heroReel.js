// The homepage showreel.
//
// One pre-cut film (assets/videos/hero-reel*.mp4, ~14s): six projects at
// 2.8s each, joined by 0.5s crossfades, so project k is on screen from
// k * 2.3s. The "Now playing" readout follows those cuts and links to
// whichever project is showing.
//
// Cost control: nothing is fetched until the intro has finished (start()
// is called from main.js), phones get the 480p cut, and save-data or
// reduced-motion visitors keep the still that CSS already painted. The
// film pauses whenever the hero is off screen, so it never competes with
// the Selected Work clips for a decoder.

export const REEL = [
  { slug: "icekiid", title: "Icekiid" },
  { slug: "byron-messia", title: "Byron Messia" },
  { slug: "3-nation-studios", title: "3 Nation Studios" },
  { slug: "prince-o", title: "Prince O" },
  { slug: "illegal-vybz-truck", title: "Illegal Vybz Truck" },
  { slug: "tao-1", title: "TAO 1.0" }
];
const STEP = 2.3; // seconds between cuts
const CUT_AT = 0.25; // the crossfade's midpoint, where the label changes

function prefersLight() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return Boolean(c?.saveData) || /(^|-)(2g|slow-2g)$/.test(c?.effectiveType || "");
}

// Rolls the old value out and the new one in.
function roll(host, text) {
  if (!host) return;
  const prev = host.querySelector("b:not(.is-out)");
  if (prev?.textContent === text) return;
  const next = document.createElement("b");
  next.textContent = text;
  next.style.transform = "translateY(100%)";
  host.appendChild(next);
  requestAnimationFrame(() => {
    next.style.transform = "translateY(0)";
    if (prev) {
      prev.classList.add("is-out");
      prev.style.transform = "translateY(-100%)";
      setTimeout(() => prev.remove(), 700);
    }
  });
}

export function initHeroReel({ reduceMotion = false } = {}) {
  const hero = document.querySelector(".hero");
  const video = hero?.querySelector(".hero-reel__video");
  const now = hero?.querySelector("[data-hero-now]");
  if (!hero || !video) return { start() {} };

  const numEl = now?.querySelector(".hero-now__num");
  const titleEl = now?.querySelector(".hero-now__title");
  const bar = now?.querySelector(".hero-now__bar i");
  let current = 0;

  const show = (index) => {
    if (index === current) return;
    current = index;
    const item = REEL[index];
    roll(numEl, String(index + 1).padStart(2, "0"));
    roll(titleEl, item.title);
    if (now) now.href = `/work/${item.slug}/`;
  };

  const still = reduceMotion || prefersLight();
  if (still) return { start() {} };

  const narrow = matchMedia("(max-width: 720px)").matches;
  let started = false;
  let visible = true;

  const tryPlay = () => {
    if (!started || !visible || document.hidden) return;
    video.play().catch(() => {
      // Autoplay refused (some in-app browsers): the still stays, and the
      // first gesture anywhere tries again.
      const retry = () => video.play().catch(() => {});
      window.addEventListener("pointerdown", retry, { once: true, passive: true });
    });
  };

  video.addEventListener("playing", () => hero.classList.add("reel-playing"), { once: true });
  video.addEventListener("timeupdate", () => {
    const t = video.currentTime;
    // Cut k lands at k * STEP; the label changes halfway through its fade.
    show(Math.min(REEL.length - 1, Math.max(0, Math.floor((t - CUT_AT) / STEP))));
    if (bar && video.duration) bar.style.transform = `scaleX(${(t / video.duration).toFixed(4)})`;
  });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) tryPlay();
    else video.pause();
  }).observe(hero);
  document.addEventListener("visibilitychange", () => (document.hidden ? video.pause() : tryPlay()));

  return {
    start() {
      if (started) return;
      started = true;
      video.src = narrow ? video.dataset.srcMobile : video.dataset.src;
      video.preload = "auto";
      tryPlay();
    }
  };
}

// Sizes the wordmark so it spans the frame exactly, edge to edge.
// Measured at a known size and scaled, re-run when the width changes and
// once the brand face has loaded (the fallback face is a different width).
export function fitWordmark() {
  const word = document.querySelector(".hero .origin-word");
  const frame = word?.parentElement;
  if (!word || !frame) return;
  const fit = () => {
    const styles = getComputedStyle(frame);
    const avail = frame.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    // Measure the text, not the block: a heading is as wide as its
    // container, so its own box says nothing about the letters.
    word.style.setProperty("--fit", "100px");
    word.style.width = "max-content";
    const natural = word.getBoundingClientRect().width;
    word.style.width = "";
    if (!natural) return;
    word.style.setProperty("--fit", `${Math.floor(((100 * avail) / natural) * 1000) / 1000}px`);
  };
  fit();
  // fonts.ready can settle before the brand face has even been requested,
  // so ask for it by name and fit again once it is really here.
  document.fonts?.load?.('400 100px "Michroma"').then(fit).catch(() => {});
  document.fonts?.ready?.then(fit).catch(() => {});
  let lastWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    fit();
  });
}
