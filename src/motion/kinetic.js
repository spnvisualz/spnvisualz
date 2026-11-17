import { gsap, ScrollTrigger, getLenis } from "./scrollTimeline.js";
import { splitInto } from "./parallax.js";

// Kinetic layer — motion that answers the visitor rather than the scroll
// position:
//
//   cursor      a small follower ring; over a work panel it reads "View"
//   masks       headings rise word by word out of a clipped edge
//   capability  the capabilities line drifts on its own and picks up
//               speed with the scroll
//   work        a panel click opens that project's case study
//   process     a line draws across the four steps as they pass
//   counters    prices count up the first time they are seen
//
// Nothing here carries meaning, the real text always stays in the DOM,
// and reduced motion gets none of it (the work click still works).

const finePointer = () => matchMedia("(hover: hover) and (pointer: fine)").matches;

/* ---------------------------------------------------------- cursor */
function initCursor() {
  if (!finePointer()) return;
  const cursor = document.createElement("div");
  cursor.className = "cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = '<span class="cursor__ring"></span><span class="cursor__label"></span>';
  document.body.appendChild(cursor);
  const label = cursor.querySelector(".cursor__label");

  const xTo = gsap.quickTo(cursor, "x", { duration: 0.35, ease: "power3" });
  const yTo = gsap.quickTo(cursor, "y", { duration: 0.35, ease: "power3" });

  let shown = false;
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    if (!shown) {
      shown = true;
      gsap.set(cursor, { x: e.clientX, y: e.clientY });
      cursor.classList.add("is-on");
    }
    xTo(e.clientX);
    yTo(e.clientY);
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => cursor.classList.remove("is-on"));
  document.documentElement.addEventListener("pointerenter", () => shown && cursor.classList.add("is-on"));

  document.querySelectorAll(".work-item__media").forEach((el) => (el.dataset.cursor ||= "View"));
  document.querySelectorAll(".lab-portal").forEach((el) => (el.dataset.cursor ||= "Enter"));

  const interactive = "a, button, [role=tab], input, select, textarea, label";
  document.addEventListener("pointerover", (e) => {
    const labelled = e.target.closest?.("[data-cursor]");
    if (labelled) {
      label.textContent = labelled.dataset.cursor;
      cursor.classList.add("has-label");
      cursor.classList.remove("is-link");
      return;
    }
    cursor.classList.remove("has-label");
    cursor.classList.toggle("is-link", Boolean(e.target.closest?.(interactive)));
  });

  // Dialogs sit in the top layer, above anything a z-index reaches.
  const sync = () =>
    cursor.classList.toggle(
      "is-hidden",
      Boolean(document.querySelector("dialog[open]")) || document.body.classList.contains("menu-open")
    );
  const observer = new MutationObserver(sync);
  document.querySelectorAll("dialog").forEach((d) => observer.observe(d, { attributes: true, attributeFilter: ["open"] }));
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
}

/* ---------------------------------------------------------- masks */
function initMasks() {
  document
    .querySelectorAll(".section-head h2, .work-head h2, .contact-inner h2, .lab-portal h2, .work-item__title")
    .forEach((el) => {
      if (el.dataset.masked) return;
      el.dataset.masked = "1";
      splitInto(el, "words");
      el.querySelectorAll(".word").forEach((word) => {
        const inner = document.createElement("span");
        inner.className = "mask__inner";
        inner.textContent = word.textContent;
        word.textContent = "";
        word.classList.add("mask");
        word.appendChild(inner);
      });
      // A heading inside a .reveal parent is already faded in; it does not
      // also fade on its own.
      el.classList.remove("reveal");
      el.classList.add("is-masked");
      ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: () => el.classList.add("is-in") });
    });
}

/* ---------------------------------------------------------- capabilities */
function initCapabilities() {
  const band = document.querySelector(".capabilities");
  const row = band?.querySelector("[data-marquee]");
  if (!band || !row) return;

  let velocity = 0;
  getLenis()?.on("scroll", (e) => (velocity = e.velocity || 0));

  let half = 0;
  let x = 0;
  const set = gsap.quickSetter(row, "x", "px");
  const measure = () => (half = row.scrollWidth / 2);
  measure();
  window.addEventListener("resize", measure);
  document.fonts?.ready?.then(measure).catch(() => {});

  let visible = false;
  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(band);

  let boost = 0;
  gsap.ticker.add((_, delta) => {
    boost += (Math.abs(velocity) * 6 - boost) * 0.08;
    velocity *= 0.9;
    if (!visible || !half) return;
    x -= (34 + boost) * (Math.min(delta, 50) / 1000);
    if (x <= -half) x += half;
    set(x);
  });
}

/* ---------------------------------------------------------- work */
// The panel is the largest target in each project; it now leads to the
// case study like the link under it does. Registered in the capture
// phase so it sees the panel before workSequence.js clears "needs-tap":
// a panel still waiting for a tap-to-play keeps that job.
function initWorkLinks() {
  document.querySelectorAll(".work-item").forEach((item) => {
    const media = item.querySelector(".work-item__media");
    const link = item.querySelector(".work-item__link");
    if (!media || !link) return;
    media.addEventListener(
      "click",
      (e) => {
        if (item.classList.contains("needs-tap")) return;
        if (e.metaKey || e.ctrlKey) window.open(link.href, "_blank", "noopener");
        else window.location.href = link.href;
      },
      { capture: true }
    );
  });
}

/* ---------------------------------------------------------- process */
function initProcess() {
  const list = document.querySelector("[data-process-line]");
  if (!list) return;
  const cards = Array.from(list.children);
  const line = document.createElement("span");
  line.className = "process-progress";
  line.setAttribute("aria-hidden", "true");
  line.innerHTML = "<i></i>";
  list.appendChild(line);

  ScrollTrigger.create({
    trigger: list,
    start: "top 78%",
    end: "bottom 45%",
    scrub: 0.5,
    onUpdate: (self) => {
      gsap.set(line.firstElementChild, { scaleX: self.progress });
      cards.forEach((card, i) => card.classList.toggle("is-active", self.progress >= i / cards.length + 0.04));
    }
  });
}

/* ---------------------------------------------------------- counters */
function initCounters() {
  document.querySelectorAll(".price-tier b, .bundle-card strong").forEach((el) => {
    const original = el.textContent;
    const match = original.match(/^(\D*)(\d+)(.*)$/);
    if (!match) return;
    const [, pre, num, post] = match;
    const to = parseInt(num, 10);
    el.style.fontVariantNumeric = "tabular-nums";
    ScrollTrigger.create({
      trigger: el,
      start: "top 92%",
      once: true,
      onEnter: () => {
        const state = { v: 0 };
        gsap.to(state, {
          v: to,
          duration: 1.1,
          ease: "power3.out",
          onUpdate: () => (el.textContent = `${pre}${Math.round(state.v)}${post}`),
          onComplete: () => (el.textContent = original)
        });
      }
    });
  });
}

export function initKinetic({ reduceMotion = false } = {}) {
  initWorkLinks();
  if (reduceMotion) return;
  document.documentElement.classList.add("kinetic");
  initMasks();
  initCapabilities();
  initProcess();
  initCounters();
  initCursor();
}
