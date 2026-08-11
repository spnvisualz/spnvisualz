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

  const labWorld = document.querySelector("[data-lab-world]");
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  let spatialFrame = 0;
  let pointerX = 0;
  let pointerY = 0;

  const renderSpatialLab = () => {
    const heroProgress = Math.min(1, Math.max(0, window.scrollY / Math.max(1, window.innerHeight)));
    root.style.setProperty("--lab-world-x", (pointerX * 22).toFixed(2) + "px");
    root.style.setProperty("--lab-world-y", (heroProgress * 96 + pointerY * 14).toFixed(2) + "px");
    root.style.setProperty("--lab-world-rx", (-pointerY * 7 + heroProgress * 3).toFixed(2) + "deg");
    root.style.setProperty("--lab-world-ry", (pointerX * 10 - heroProgress * 5).toFixed(2) + "deg");
    root.style.setProperty("--lab-hero-drift", (heroProgress * 72).toFixed(2) + "px");
    spatialFrame = 0;
  };

  const scheduleSpatialLab = () => {
    if (spatialFrame) return;
    spatialFrame = requestAnimationFrame(renderSpatialLab);
  };

  if (labWorld && !reducedMotion) {
    addEventListener("scroll", scheduleSpatialLab, { passive: true });
    if (finePointer) {
      addEventListener("pointermove", event => {
        pointerX = event.clientX / Math.max(1, innerWidth) - .5;
        pointerY = event.clientY / Math.max(1, innerHeight) - .5;
        scheduleSpatialLab();
      }, { passive: true });
      addEventListener("pointerleave", () => {
        pointerX = 0;
        pointerY = 0;
        scheduleSpatialLab();
      }, { passive: true });
    }
    renderSpatialLab();
  }

  if (finePointer && !reducedMotion && innerWidth >= 981) {
    document.querySelectorAll(".lab-card, .lab-feature").forEach(card => {
      let bounds = null;
      let tiltFrame = 0;
      let tiltX = 0;
      let tiltY = 0;
      card.addEventListener("pointerenter", () => {
        bounds = card.getBoundingClientRect();
      }, { passive: true });
      card.addEventListener("pointermove", event => {
        const rect = bounds || card.getBoundingClientRect();
        tiltX = (event.clientX - rect.left) / Math.max(1, rect.width) - .5;
        tiltY = (event.clientY - rect.top) / Math.max(1, rect.height) - .5;
        if (tiltFrame) return;
        tiltFrame = requestAnimationFrame(() => {
          card.style.setProperty("--lab-tilt-x", (-tiltY * 3.8).toFixed(2) + "deg");
          card.style.setProperty("--lab-tilt-y", (tiltX * 4.6).toFixed(2) + "deg");
          tiltFrame = 0;
        });
      }, { passive: true });
      card.addEventListener("pointerleave", () => {
        if (tiltFrame) cancelAnimationFrame(tiltFrame);
        tiltFrame = 0;
        bounds = null;
        card.style.setProperty("--lab-tilt-x", "0deg");
        card.style.setProperty("--lab-tilt-y", "0deg");
      });
    });
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
