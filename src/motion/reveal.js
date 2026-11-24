import { onVisible } from "./onVisible.js";

// Fade-up for .reveal / .reveal-line. Driven by IntersectionObserver (see
// onVisible.js), so a stalled scroll stack can never leave text hidden.
export function initReveals() {
  document.querySelectorAll(".reveal, .reveal-line").forEach((el) => {
    onVisible(el, () => el.classList.add("is-revealed"));
  });
}
