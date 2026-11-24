// The hero's DOM half. The 3D piece behind it lives in the WebGL layer
// (src/three/scenes/Orbital.js); this file only fits the wordmark.

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
