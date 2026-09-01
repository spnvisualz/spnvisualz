// Magnetic hover: buttons/links pull slightly toward the cursor within
// their bounds, then spring back. Desktop-only (skipped on coarse/touch
// pointers, where it has no meaning and would just add jank) and skipped
// under prefers-reduced-motion.
export function initMagnetic(selector = ".btn, .project-button, .portal-link, .lab-portal") {
  const isTouch = matchMedia("(pointer: coarse)").matches;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (isTouch || reduceMotion) return;

  const strength = 0.28;
  const els = document.querySelectorAll(selector);

  els.forEach((el) => {
    let raf = 0;
    const onMove = (event) => {
      const rect = el.getBoundingClientRect();
      const x = event.clientX - (rect.left + rect.width / 2);
      const y = event.clientY - (rect.top + rect.height / 2);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      el.style.transform = "";
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
  });
}
