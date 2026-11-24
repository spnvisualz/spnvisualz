// Runs fn once, the first time el scrolls into view — or has already been
// scrolled past (a deep link, a restored scroll position).
//
// Reveals used to hang off ScrollTrigger onEnter. That ties whether a
// heading is visible at all to the whole scroll stack (Lenis, trigger
// measurements, the intro's scroll lock) behaving perfectly: on iPhone it
// did not, and every heading and paragraph on the page stayed at opacity 0.
// IntersectionObserver is answered by the browser itself, from real
// layout, so it keeps working whatever state the scroll effects are in.
//
// `edge` is how far up the viewport the element's top must come, as a
// fraction: 0.12 matches the old ScrollTrigger "top 88%".
const observers = new Map();

function observerFor(edge) {
  let entry = observers.get(edge);
  if (entry) return entry;
  const callbacks = new WeakMap();
  const io = new IntersectionObserver(
    (records) => {
      for (const r of records) {
        // isIntersecting, or already entirely above the viewport
        if (!r.isIntersecting && r.boundingClientRect.bottom > 0) continue;
        const fn = callbacks.get(r.target);
        io.unobserve(r.target);
        callbacks.delete(r.target);
        fn?.();
      }
    },
    { rootMargin: `0px 0px -${Math.round(edge * 100)}% 0px` }
  );
  entry = { io, callbacks };
  observers.set(edge, entry);
  return entry;
}

export function onVisible(el, fn, { edge = 0.12 } = {}) {
  if (!el) return;
  if (typeof IntersectionObserver !== "function") {
    fn();
    return;
  }
  const { io, callbacks } = observerFor(edge);
  callbacks.set(el, fn);
  io.observe(el);
}
