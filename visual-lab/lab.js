(() => {
  "use strict";

  const root = document.documentElement;
  root.classList.remove("lab-no-js");
  root.classList.add("lab-js");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const boot = document.querySelector("[data-lab-boot]");

  const finishBoot = () => {
    if (!boot || boot.classList.contains("is-finished")) return;
    boot.classList.add("is-finished");
    window.setTimeout(() => boot.remove(), reducedMotion ? 0 : 480);
  };

  if (boot) {
    let seen = false;
    try { seen = sessionStorage.getItem("spn_lab_boot_seen") === "1"; } catch (_) {}
    if (reducedMotion || seen) {
      boot.remove();
    } else {
      boot.hidden = false;
      try { sessionStorage.setItem("spn_lab_boot_seen", "1"); } catch (_) {}
      const ready = document.fonts && document.fonts.ready
        ? Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 620))])
        : new Promise(resolve => setTimeout(resolve, 420));
      ready.then(() => window.setTimeout(finishBoot, 120));
      window.setTimeout(finishBoot, 1050);
    }
  }

  const progress = document.querySelector("[data-reading-progress]");
  if (progress) {
    let ticking = false;
    const render = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const value = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
      progress.style.width = (value * 100).toFixed(2) + "%";
      ticking = false;
    };
    addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(render);
      }
    }, { passive: true });
    render();
  }

  const revealItems = Array.from(document.querySelectorAll("[data-reveal]"));
  if (revealItems.length) {
    if (reducedMotion || !("IntersectionObserver" in window)) {
      revealItems.forEach(item => item.classList.add("is-visible"));
    } else {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: .08 });
      revealItems.forEach(item => observer.observe(item));
    }
  }

  const topicForm = document.querySelector("[data-topic-form]");
  if (topicForm) {
    topicForm.addEventListener("submit", event => {
      event.preventDefault();
      const input = topicForm.querySelector("input");
      const topic = input && input.value.trim();
      if (!topic) return;
      if (window.SPNAnalytics) {
        window.SPNAnalytics.track("visual_lab_topic_requested", { topic });
      }
      location.href = "mailto:spnvisualz@gmail.com?subject=" +
        encodeURIComponent("Visual Lab topic request") +
        "&body=" + encodeURIComponent("I would like SPNVISUALZ to cover: " + topic);
    });
  }
})();