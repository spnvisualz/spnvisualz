import { ScrollTrigger } from "./scrollTimeline.js";

export function initReveals() {
  const targets = document.querySelectorAll(".reveal, .reveal-line");
  targets.forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      once: true,
      onEnter: () => el.classList.add("is-revealed")
    });
  });
}
