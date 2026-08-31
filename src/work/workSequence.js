import { ScrollTrigger, getLenis } from "../motion/scrollTimeline.js";

// Selected Work — a pinned cinematic sequence, not a slider. The section's
// height is set from the panel count; ScrollTrigger pins .work-pin for that
// distance and scrubs which panel is active. Only the active panel's video
// ever has a real <video src> — everything else stays unset, so at most one
// project is decoding at a time no matter how fast someone scrolls through.
export function initWorkSequence() {
  const section = document.querySelector(".chapter--work");
  const pin = document.getElementById("workPin");
  const stage = document.getElementById("workStage");
  const panels = Array.from(stage?.querySelectorAll(".work-panel") || []);
  const indexDots = Array.from(document.querySelectorAll(".work-index span"));
  const currentLabel = document.getElementById("workCurrent");
  if (!section || !pin || !stage || !panels.length) return;

  const isMobile = () => window.innerWidth <= 720;

  const applyVideo = (panel, active) => {
    const video = panel.querySelector("video");
    if (!video) return;
    if (active) {
      const src = (isMobile() && video.dataset.srcMobile) || video.dataset.src;
      if (src && video.getAttribute("src") !== src) {
        video.setAttribute("src", src);
        video.load();
      }
      video.play().catch(() => {});
    } else {
      video.pause();
      if (video.hasAttribute("src")) {
        video.removeAttribute("src");
        video.load();
      }
    }
  };

  let activeIndex = 0;
  const setActive = (index) => {
    index = Math.max(0, Math.min(panels.length - 1, index));
    if (index === activeIndex && panels[index].classList.contains("is-active")) return;
    panels.forEach((panel, i) => {
      const wasActive = panel.classList.contains("is-active");
      panel.classList.toggle("is-active", i === index);
      panel.classList.toggle("is-leaving", wasActive && i !== index);
      applyVideo(panel, i === index);
    });
    indexDots.forEach((dot, i) => dot.classList.toggle("is-active", i === index));
    if (currentLabel) currentLabel.textContent = String(index + 1).padStart(2, "0");
    activeIndex = index;
  };

  setActive(0);

  indexDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const go = Number(dot.dataset.go || 0);
      const st = section._workScrollTrigger;
      if (st) {
        const target = st.start + (go / (panels.length - 1)) * (st.end - st.start);
        getLenis()?.scrollTo(target, { duration: 1.1 });
      }
    });
  });

  const build = () => {
    const distance = window.innerHeight * (panels.length - 1) * 0.85;
    section.style.height = `${window.innerHeight + distance}px`;

    section._workScrollTrigger?.kill();
    section._workScrollTrigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: `+=${distance}`,
      pin: pin,
      pinSpacing: true,
      scrub: 0.6,
      onUpdate(self) {
        const index = Math.round(self.progress * (panels.length - 1));
        setActive(index);
      }
    });
  };

  build();
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      ScrollTrigger.getAll().forEach((st) => st.refresh());
    }, 200);
  });
}
