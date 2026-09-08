import { PROJECTS } from "./projects.js";
import { gsap, ScrollTrigger } from "../motion/scrollTimeline.js";

// Selected Work, rebuilt as real DOM video scenes.
//
// The previous version rendered projects as video-textured planes inside
// the 3D corridor. It looked good in isolation but every playback problem
// on the site traced back to it: which clip played was decided by
// comparing camera depth against each plane's depth, so any drift in that
// math (aspect compensation, spacing, a stale measurement) could leave a
// clip silent or start it only as it was already leaving frame. It also
// needed a ~9-viewport JS-sized spacer, which is what made mobile scroll
// jump whenever the address bar collapsed and changed innerHeight.
//
// Real <video> elements driven by IntersectionObserver remove that whole
// class of failure: the browser itself tells us when a project is on
// screen. Parallax is then a normal scrub on real elements — smooth
// top-to-bottom, no corridor to fall out of step with.

const MOBILE_QUERY = "(max-width: 700px)";

// Three observers, each with a different job, arranged as a sliding
// window around the viewport:
//
//   RELEASE_MARGIN  ── outside this, a clip is unloaded entirely
//     LOAD_MARGIN   ── inside this, a clip starts fetching
//       viewport    ── at PLAY_THRESHOLD visible, it plays
//
// The unload half is the important one. Previously a clip was given
// preload="auto" and a src the first time it came near, and was never
// released — so by the last project the browser was holding every earlier
// clip fully buffered, with a decoder each. New decoders initialise
// slowly under that pressure, which is why the clips at the end of the
// sequence were the ones that hung. Keeping only a few resident at a time
// bounds both memory and decoder count no matter how long the list grows.
//
// Load and release use different distances on purpose: with a single
// boundary, a clip sitting exactly on it would load and unload repeatedly
// as the page moved a few pixels.
const LOAD_MARGIN = "150% 0px 150% 0px";
const RELEASE_MARGIN = "260% 0px 260% 0px";
const PLAY_THRESHOLD = 0.32;

function sourceFor(project, useMobile) {
  return useMobile && project.videoMobile ? project.videoMobile : project.video;
}

export function initWorkSequence({ reduceMotion = false } = {}) {
  const track = document.getElementById("workTrack");
  if (!track) return null;

  const useMobile = window.matchMedia(MOBILE_QUERY).matches;

  // The project markup ships in the HTML rather than being created here.
  // Building it in JS meant a crawler — or an ad-network reviewer, or
  // anyone with JS blocked — saw an empty container where the portfolio
  // should be, which is exactly the content the page most needs to prove
  // it has. This only attaches behaviour to markup that already exists.
  const items = PROJECTS.map((project, i) => {
    const article = track.querySelector(`.work-item[data-index="${i}"]`);
    if (!article) return null;
    return { project, article, video: article.querySelector("video"), index: i };
  }).filter(Boolean);

  if (!items.length) return null;

  const totalEl = document.getElementById("workTotal");
  if (totalEl) totalEl.textContent = String(items.length).padStart(2, "0");

  // --- playback -----------------------------------------------------
  // play() is async. Pausing while it's still settling is the classic
  // "play() request was interrupted by a call to pause()" race, which can
  // leave a video refusing to decode anything further. Track the promise
  // and let pause wait for it.
  // `eager` is for the clip a visitor is actually looking at; neighbours
  // are speculative. Jumping straight to a project (from the menu, or a
  // fast scroll) makes several neighbours enter the load window in the
  // same frame, and if they all start fetching at once they compete with
  // the one on screen for bandwidth — which is how the last project ended
  // up taking seconds to start. Speculative loads therefore wait a beat,
  // so the visible clip's request goes out first and gets the connection.
  const PRELOAD_DEFER_MS = 400;

  const attachSource = (item, { eager = false } = {}) => {
    if (item.video.dataset.loaded) return;

    if (!eager) {
      if (item.preloadTimer) return;
      item.preloadTimer = setTimeout(() => {
        item.preloadTimer = null;
        attachSource(item, { eager: true });
      }, PRELOAD_DEFER_MS);
      return;
    }

    if (item.preloadTimer) {
      clearTimeout(item.preloadTimer);
      item.preloadTimer = null;
    }
    item.video.dataset.loaded = "1";
    item.video.preload = "auto";
    if ("fetchPriority" in HTMLImageElement.prototype) item.video.fetchPriority = "high";
    item.video.src = sourceFor(item.project, useMobile);
    item.video.load();
  };

  // Hand the clip's buffer and decoder back to the browser. Clearing src
  // alone does nothing — load() is what actually releases the media
  // resource. The poster attribute is untouched, so the panel keeps
  // showing its real still image while unloaded, and scrolling back
  // re-fetches from cache.
  const releaseSource = (item) => {
    if (item.preloadTimer) {
      clearTimeout(item.preloadTimer);
      item.preloadTimer = null;
    }
    if (!item.video.dataset.loaded) return;
    if (item.playing) return; // never yank a clip that is on screen
    delete item.video.dataset.loaded;
    item.playPromise = null;
    item.video.pause();
    item.video.removeAttribute("src");
    item.video.load();
    item.video.preload = "none";
  };

  const play = (item) => {
    attachSource(item, { eager: true });
    if (item.playing) return;
    item.playing = true;
    item.playPromise = item.video.play();
    if (item.playPromise) {
      item.playPromise.catch(() => {
        // Autoplay refused (or interrupted). Leave the poster showing —
        // never let a rejected promise become an unhandled rejection.
        item.playing = false;
      });
    }
  };

  const pause = (item) => {
    if (!item.playing) return;
    item.playing = false;
    const stop = () => {
      if (item.playing) return; // re-entered view again in the meantime
      item.video.pause();
    };
    if (item.playPromise) item.playPromise.then(stop, stop);
    else stop();
  };

  const preloadObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const item = items[Number(entry.target.dataset.index)];
        if (item) attachSource(item);
      });
    },
    { rootMargin: LOAD_MARGIN }
  );

  const releaseObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) return; // still within the keep-loaded window
        const item = items[Number(entry.target.dataset.index)];
        if (item) releaseSource(item);
      });
    },
    { rootMargin: RELEASE_MARGIN }
  );

  const playObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const item = items[Number(entry.target.dataset.index)];
        if (!item) return;
        if (entry.isIntersecting) {
          play(item);
          item.article.classList.add("is-visible");
          setActive(item.index);
        } else {
          pause(item);
        }
      });
    },
    { threshold: PLAY_THRESHOLD }
  );

  items.forEach((item) => {
    preloadObserver.observe(item.article);
    playObserver.observe(item.article);
    releaseObserver.observe(item.article);
  });

  // A tab switch pauses decoding anyway; make it explicit so we come back
  // to a playing clip rather than a frozen frame.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      items.forEach(pause);
    } else {
      items.forEach((item) => {
        if (item.article.classList.contains("is-visible")) play(item);
      });
    }
  });

  // --- index readout ------------------------------------------------
  const currentEl = document.getElementById("workCurrent");
  let activeIndex = -1;
  function setActive(index) {
    if (index === activeIndex) return;
    activeIndex = index;
    if (currentEl) currentEl.textContent = items[index].project.number;
  }

  // --- parallax -----------------------------------------------------
  // Deliberately restrained: media drifts against its own frame, meta
  // text drifts the other way. Enough to read as depth while scrolling,
  // never enough to fight the reader or cause a jump.
  if (!reduceMotion) {
    items.forEach((item) => {
      gsap.fromTo(
        item.video,
        { yPercent: -8, scale: 1.12 },
        {
          yPercent: 8,
          scale: 1.02,
          ease: "none",
          scrollTrigger: {
            trigger: item.article,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.6
          }
        }
      );

      gsap.fromTo(
        item.article.querySelector(".work-item__meta"),
        { y: 40 },
        {
          y: -40,
          ease: "none",
          scrollTrigger: {
            trigger: item.article,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.8
          }
        }
      );
    });
  }

  const section = document.getElementById("work");
  if (section) {
    ScrollTrigger.create({
      trigger: section,
      start: "top 60%",
      end: "bottom 40%",
      onToggle: (self) => document.documentElement.classList.toggle("in-work", self.isActive)
    });
  }

  return { items };
}
