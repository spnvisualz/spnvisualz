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

// Two observers, deliberately: one starts *fetching* a clip well before
// it's on screen (so it's decodable by the time it arrives, which is what
// "plays right after one is scrolled by" actually requires), the other
// starts and stops playback based on real visibility.
const PRELOAD_MARGIN = "120% 0px 120% 0px";
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
  const attachSource = (item) => {
    if (item.video.dataset.loaded) return;
    item.video.dataset.loaded = "1";
    item.video.preload = "auto";
    item.video.src = sourceFor(item.project, useMobile);
    item.video.load();
  };

  const play = (item) => {
    attachSource(item);
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
    { rootMargin: PRELOAD_MARGIN }
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
