import { gsap } from "./scrollTimeline.js";
import { PROJECTS } from "../work/projects.js";
import { splitInto } from "./parallax.js";

// The voyage: the studio statement, flown through the work.
//
// The section holds (pins) while the scroll carries the camera forward
// through all ten projects, hung at depth in real CSS 3D space around the
// statement. Near cards sweep past the edges of the screen while far ones
// are still arriving, and the whole field turns slowly as it goes. It is
// the same journey the starfield behind it is on, at a closer range.
//
// Only transforms and opacity change per frame, on ten elements, all
// driven from one scrubbed value, so it stays on the compositor.

// [x (vw from centre), y (vh from centre), depth (px into the screen)].
// Every card is kept off the centre line, where the statement sits.
const LAYOUT = [
  [-30, -20, 500],
  [29, 19, 950],
  [-26, 25, 1400],
  [33, -22, 1850],
  [-36, 3, 2300],
  [22, -28, 2750],
  [35, 15, 3200],
  [-24, -27, 3650],
  [-33, 21, 4100],
  [30, -3, 4550]
];
const TRAVEL = 5350;

const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function posterFor(project, light) {
  return project.poster.replace(/\.jpg$/, light ? "-mobile.webp" : ".webp");
}

export function initVoyage({ reduceMotion = false } = {}) {
  const section = document.querySelector(".chapter--voyage");
  if (!section) return;
  if (reduceMotion) {
    section.classList.add("is-static");
    return;
  }
  section.classList.add("is-flying");

  const narrow = matchMedia("(max-width: 720px)").matches;
  const track = section.querySelector(".voyage-track");
  const copy = section.querySelector(".voyage-copy");
  const line = section.querySelector("[data-split-words]");
  const counter = section.querySelector("[data-voyage-count]");

  const cards = PROJECTS.slice(0, LAYOUT.length).map((project, i) => {
    const [x, y, z] = LAYOUT[i];
    const fig = document.createElement("figure");
    fig.className = "voyage-card";
    // phones spread the field wider, since the cards are larger there
    fig.style.setProperty("--x", String(narrow ? x * 1.1 : x));
    fig.style.setProperty("--y", String(narrow ? y * 1.25 : y));
    const img = document.createElement("img");
    img.src = posterFor(project, true);
    img.alt = "";
    img.decoding = "async";
    img.width = 960;
    img.height = 540;
    const cap = document.createElement("figcaption");
    cap.textContent = `${project.number} — ${project.title}`;
    fig.append(img, cap);
    fig.style.transform = `translateZ(${-z}px)`;
    track.appendChild(fig);
    return { el: fig, z };
  });

  let passed = -1;
  const state = { z: 0 };
  const apply = () => {
    const z = state.z;
    track.style.transform = `translate3d(0,0,${z.toFixed(1)}px) rotateZ(${(z * 0.0024).toFixed(3)}deg)`;
    let count = 0;
    for (const card of cards) {
      const ze = z - card.z; // where this card is relative to the screen plane
      const opacity = smooth(-3500, -2400, ze) * (1 - smooth(260, 720, ze));
      card.el.style.opacity = opacity.toFixed(3);
      card.el.style.visibility = opacity < 0.005 ? "hidden" : "";
      if (ze > -900) count++;
    }
    if (counter && count !== passed) {
      passed = count;
      counter.textContent = String(count).padStart(2, "0");
    }
  };
  apply();

  if (line) splitInto(line, "words");
  const words = line ? line.querySelectorAll(".word") : [];

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: "top top",
      end: () => "+=" + Math.round(window.innerHeight * (narrow ? 2.3 : 2.9)),
      pin: true,
      scrub: 0.9,
      anticipatePin: 1,
      invalidateOnRefresh: true
    }
  });
  tl.to(state, { z: TRAVEL, ease: "none", duration: 1, onUpdate: apply }, 0)
    .fromTo(words, { opacity: 0.14 }, { opacity: 1, stagger: 0.035, duration: 0.25, ease: "none" }, 0.04)
    .fromTo(copy, { scale: 0.94 }, { scale: 1.04, duration: 1, ease: "none" }, 0)
    .to(copy, { opacity: 0, y: -40, duration: 0.1, ease: "power1.in" }, 0.9);
}
