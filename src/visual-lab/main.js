import { assessDeviceTier } from "../three/deviceTier.js";
import { initMagnetic } from "../nav/magnetic.js";

// Bundled entry for the Visual Lab landing page.
//
// The rest of the Lab (the ten article pages) stays on the plain
// `visual-lab/lab.js` script — those pages need a reading-progress bar and
// nothing else, and there is no reason to hand them a Three.js payload. Only
// this page is a Vite entry, which is what lets the hero import three and the
// site's existing renderer/tier helpers instead of vendoring a copy.
//
// The tier check runs *before* the hero is imported, so the ~130 kB gzipped
// Three.js chunk is only fetched by clients that will actually render it. A
// visitor on data-saver, a software renderer or a browser without WebGL2 gets
// the CSS fallback and never pays for the engine — which is the whole reason
// `assessDeviceTier` lives in its own module with no three import.

initMagnetic(".lab-header__order, .lab-hero__cta, .lab-newsletter__form button");

function wireHero(hero) {
  if (!hero) return;

  // Hovering the topic index energises the specimen. The point is that the
  // index and the object are one system: reading the page changes what the
  // hero is doing.
  if (typeof hero.pulse === "function") {
    document.querySelectorAll("[data-lab-pulse]").forEach((el) => {
      el.addEventListener("pointerenter", () => hero.pulse(), { passive: true });
      el.addEventListener("focus", () => hero.pulse());
    });
  }

  // Instrument readout, driven by the scene's actual energy and completed
  // sweep count. Sampled well below frame rate — this is text, and
  // repainting it 60 times a second would cost more than the whole hero.
  const readout = document.querySelector("[data-lab-readout]");
  if (!readout || typeof hero.getReading !== "function") return;

  const segments = Array.from(readout.querySelectorAll("[data-lab-level] i"));
  const sweeps = readout.querySelector("[data-lab-sweeps]");

  const render = () => {
    const reading = hero.getReading();
    const lit = Math.max(1, Math.min(segments.length, Math.round((reading.energy / 1.1) * segments.length)));
    segments.forEach((seg, i) => seg.classList.toggle("is-on", i < lit));
    if (sweeps) sweeps.textContent = String(reading.sweeps).padStart(3, "0");
  };

  render();
  const timer = setInterval(render, 160);
  addEventListener("pagehide", () => clearInterval(timer), { once: true });
  readout.removeAttribute("hidden");
}

const tier = assessDeviceTier();

if (tier.tier === "minimal") {
  // The CSS fallback is already in the markup and stays visible on its own —
  // nothing removes it unless the hero reports that it mounted.
  document.documentElement.classList.add("lab-no-webgl");
} else {
  import("./labHero.js")
    .then(({ mountLabHero }) => wireHero(mountLabHero(tier)))
    .catch((err) => {
      // A failed chunk (offline mid-navigation, blocked request) must not
      // leave the hero as an empty black box — the fallback is still in the
      // DOM, so the honest thing is to log and leave it showing.
      console.error("[visual-lab] hero failed to load", err);
      document.documentElement.classList.add("lab-no-webgl");
    });
}
