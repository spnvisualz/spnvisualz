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

function sourceFor(project, useLight) {
  return useLight && project.videoMobile ? project.videoMobile : project.video;
}

// Selected Work is the heaviest thing on the page by a wide margin — seven
// clips, up to 6.6 MB each — and it was choosing between them on viewport
// width alone. deviceTier.js already reads Save-Data and effectiveType to
// decide whether this visitor gets the 3D layer at all, so a data-saver
// visitor on a desktop was being spared the scene and then handed several
// times more video than it would ever have cost.
//
// The lighter encodes are used instead of dropping playback: the portfolio
// is the content here, and the mobile cuts are roughly 60% smaller rather
// than absent.
function prefersLightMedia() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return false;
  return Boolean(c.saveData) || /(^|-)(2g|slow-2g)$/.test(c.effectiveType || "");
}

export function initWorkSequence({ reduceMotion = false } = {}) {
  const track = document.getElementById("workTrack");
  if (!track) return null;

  const useLight = window.matchMedia(MOBILE_QUERY).matches || prefersLightMedia();

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
    item.video.src = sourceFor(item.project, useLight);
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

  // Everything below exists because the old version treated a refused
  // play() as nothing worth reporting: it set playing = false and left the
  // poster up forever. That is indistinguishable, to a visitor, from a
  // broken site — and it is exactly what an in-app browser (Instagram,
  // TikTok, Facebook) produces, because those refuse the first
  // programmatic play even for a muted inline video. There was also no
  // listener for the video's own error event at all, so a bad file, a 404
  // or a dropped connection failed just as silently.
  //
  // Three recoveries, cheapest first:
  //   1. a user gesture anywhere unlocks media for the whole page, so the
  //      first tap or scroll retries whatever is on screen;
  //   2. failing that, the panel offers a tap-to-play, which is a gesture
  //      on the video itself and cannot be refused;
  //   3. if the file itself errors, try the other encode once before
  //      giving up, so one bad variant does not kill the panel.

  const markNeedsTap = (item) => {
    item.playing = false;
    item.article.classList.add("needs-tap");
  };

  const clearNeedsTap = (item) => item.article.classList.remove("needs-tap");

  const play = (item) => {
    attachSource(item, { eager: true });
    if (item.playing) return;
    item.playing = true;
    item.playPromise = item.video.play();
    if (item.playPromise) {
      item.playPromise.then(() => clearNeedsTap(item), () => markNeedsTap(item));
    }
  };

  // One bad encode should not cost the panel. Swap to the other variant
  // once — and only once — then stop, so a genuinely missing file cannot
  // loop between two 404s.
  // A failed video keeps its poster, which is a real frame of the work, and
  // stops pretending something is about to play.
  //
  // There is deliberately no retry on another encode. The obvious idea —
  // if the mobile cut fails, try the desktop one — is backwards: the
  // mobile cut is 720p High L3.1, which is about as widely decodable as
  // H.264 gets, while the desktop cut is 1080p L5.0. Any device that
  // cannot play the first cannot play the second. And it cannot be gated
  // safely, because an aborted fetch reports MEDIA_ERR_SRC_NOT_SUPPORTED
  // exactly like an unsupported codec does: measured here, a simulated
  // connection drop on a phone pulled three desktop cuts, 14 MB, in
  // response to a network error. A genuinely bad encode is fixed by
  // re-encoding it, not by sending a phone a bigger file.
  const onMediaError = (item) => {
    item.article.classList.add("media-failed");
    markNeedsTap(item);
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

    item.video.addEventListener("error", () => onMediaError(item));

    // A tap on the panel is a user gesture on the element itself, which no
    // autoplay policy refuses. This is the guaranteed way through.
    item.article.querySelector(".work-item__media")?.addEventListener("click", () => {
      if (!item.article.classList.contains("needs-tap")) return;
      clearNeedsTap(item);
      item.playing = false;
      play(item);
    });
  });

  // A single user gesture unlocks media playback for the whole document in
  // every browser that refuses it up front, so the visitor's first touch —
  // scrolling, tapping anything — is enough to start what is on screen. It
  // runs once and then removes itself.
  let unlocked = false;
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    items.forEach((item) => {
      if (!item.article.classList.contains("is-visible")) return;
      item.playing = false;
      play(item);
    });
  };
  ["pointerdown", "touchstart", "keydown"].forEach((type) =>
    window.addEventListener(type, unlock, { once: true, passive: true })
  );

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
