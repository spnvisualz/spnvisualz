(() => {
  "use strict";

  const config = window.SPN_CONFIG?.ga4 || {};
  const measurementId = String(config.measurementId || "").trim();
  const validMeasurementId = /^G-[A-Z0-9]+$/i.test(measurementId) && measurementId !== "GA_MEASUREMENT_ID";
  const seenProjects = new Set();
  const seenSections = new Set();
  let loaded = false;
  let articleFrame = 0;
  const articleMilestones = new Set();

  const consentAllowsAnalytics = () => window.SPNConsent?.get().analytics === true;

  const ensureLoaded = () => {
    if (loaded || !validMeasurementId || !consentAllowsAnalytics()) return false;
    loaded = true;

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.dataset.spnAnalytics = "true";
    document.head.append(script);

    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      send_page_view: true,
      allow_google_signals: window.SPNConsent.get().advertising === true,
      allow_ad_personalization_signals: window.SPNConsent.get().advertising === true
    });
    return true;
  };

  const cleanParams = (params = {}) => Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => [key.slice(0, 40), typeof value === "string" ? value.slice(0, 100) : value])
  );

  const track = (eventName, params = {}) => {
    if (!validMeasurementId || !consentAllowsAnalytics()) return;
    ensureLoaded();
    window.gtag("event", String(eventName).slice(0, 40), {
      ...cleanParams(params),
      page_type: document.body.dataset.pageType || (location.pathname.startsWith("/visual-lab") ? "visual_lab" : location.pathname.startsWith("/websites") ? "website_services" : "portfolio")
    });
  };

  const labelFor = (element) => (
    element?.dataset.product ||
    element?.dataset.plan ||
    element?.getAttribute("aria-label") ||
    element?.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ||
    "unknown"
  );

  const setupClickTracking = () => {
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("a,button") : null;
      if (!target) return;

      const serviceRow = target.closest(".service-row,[data-service-preview]");
      if (serviceRow) {
        track("service_preview_opened", {
          service_name: serviceRow.dataset.product,
          service_number: serviceRow.dataset.number
        });
      }

      const packageCard = target.closest(".price-card,.plan-card,[data-package-select]");
      const planTarget = target.closest("[data-plan-target]");
      if ((packageCard && target.matches("button,a")) || planTarget) {
        track("package_selected", {
          package_name: packageCard?.querySelector("h3")?.textContent?.trim() || planTarget?.dataset.planTarget,
          billing_mode: document.querySelector("[data-billing].active")?.dataset.billing || "one_time"
        });
      }

      if (target.matches("[data-order],[data-order-button],#serviceOrderButton,.plan-button,.header-cta")) {
        track("order_button_clicked", {
          service_name: target.dataset.product || serviceRow?.dataset.product || packageCard?.querySelector("h3")?.textContent?.trim() || labelFor(target),
          placement: target.closest("#contact") ? "contact" : target.closest("dialog") ? "dialog" : target.closest(".pricing,.packages") ? "pricing" : "site"
        });
      }

      const href = target instanceof HTMLAnchorElement ? target.href : "";
      if (href.includes("instagram.com")) {
        track("instagram_clicked", { link_text: labelFor(target) });
        track("contact_button_clicked", { contact_method: "instagram", placement: target.closest("footer") ? "footer" : "site" });
      }
      if (href.startsWith("mailto:")) {
        track("email_clicked", { link_text: labelFor(target) });
        track("contact_button_clicked", { contact_method: "email", placement: target.closest("footer") ? "footer" : "site" });
      }
      if (target.matches("[data-track-contact],[data-contact-button]")) {
        track("contact_button_clicked", {
          contact_method: target.dataset.trackContact || "project_form",
          placement: target.dataset.trackPlacement || "site"
        });
      }

      try {
        const url = href ? new URL(href, location.href) : null;
        if (url?.pathname.includes("/visual-lab/articles/")) {
          track("visual_lab_article_opened", {
            article_path: url.pathname,
            article_title: labelFor(target)
          });
        }
      } catch (_) {}
    }, { passive: true });

    document.querySelector("#orderForm")?.addEventListener("submit", () => {
      const service = document.querySelector("#serviceSelect")?.value || "Custom Project";
      track("project_brief_submitted", { service_name: service });
      track("generate_lead", { currency: "EUR", value: 1, service_name: service });
    });
  };

  const trackProject = (panel) => {
    if (!panel?.classList.contains("is-active")) return;
    const name = panel.dataset.title || panel.querySelector("h3")?.textContent?.trim();
    if (!name || seenProjects.has(name)) return;
    seenProjects.add(name);
    track("portfolio_project_opened", {
      project_name: name,
      project_index: Number(panel.dataset.index || 0) + 1
    });
  };

  const setupProjectTracking = () => {
    const panels = [...document.querySelectorAll(".work-panel")];
    panels.forEach(trackProject);
    if (!panels.length) return;
    const observer = new MutationObserver((entries) => {
      entries.forEach(entry => trackProject(entry.target));
    });
    panels.forEach(panel => observer.observe(panel, { attributes: true, attributeFilter: ["class"] }));
  };

  const setupSectionTracking = () => {
    if (!("IntersectionObserver" in window)) return;
    const sections = [...document.querySelectorAll("#work,#services,#pricing,#contact,[data-track-section],[data-section-track]")];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const section = entry.target.parentElement;
        const name = section?.dataset.sectionTrack || section?.dataset.trackSection || section?.dataset.section || section?.id || "section";
        if (seenSections.has(name)) return;
        seenSections.add(name);
        track("section_bottom_reached", { section_name: name });
        observer.unobserve(entry.target);
      });
    }, { threshold: 1 });

    sections.forEach(section => {
      const sentinel = document.createElement("span");
      sentinel.className = "spn-analytics-sentinel";
      sentinel.setAttribute("aria-hidden", "true");
      section.append(sentinel);
      observer.observe(sentinel);
    });
  };

  const setupArticleProgress = () => {
    const article = document.querySelector("[data-article],article.lab-article-body");
    if (!article) return;
    const render = () => {
      const rect = article.getBoundingClientRect();
      const total = Math.max(1, article.offsetHeight - innerHeight);
      const read = Math.min(1, Math.max(0, -rect.top / total));
      [25, 50, 75, 90].forEach(milestone => {
        if (read * 100 >= milestone && !articleMilestones.has(milestone)) {
          articleMilestones.add(milestone);
          track("article_read_progress", {
            article_title: article.dataset.article || document.body.dataset.articleSlug || document.title,
            percent_read: milestone
          });
        }
      });
      articleFrame = 0;
    };
    addEventListener("scroll", () => {
      if (articleFrame) return;
      articleFrame = requestAnimationFrame(render);
    }, { passive: true });
    render();
  };

  const init = () => {
    ensureLoaded();
    setupClickTracking();
    setupProjectTracking();
    setupSectionTracking();
    setupArticleProgress();
    if (document.body.dataset.articleSlug) {
      track("visual_lab_article_opened", {
        article_path: location.pathname,
        article_title: document.querySelector("h1")?.textContent?.trim() || document.title,
        article_category: document.body.dataset.articleCategory,
        entry_method: "page_load"
      });
    }
  };

  window.SPNAnalytics = Object.freeze({ track, isConfigured: () => validMeasurementId });

  window.addEventListener("spn:consent", (event) => {
    if (event.detail?.analytics) ensureLoaded();
    if (loaded) {
      window.gtag("set", {
        allow_google_signals: event.detail?.advertising === true,
        allow_ad_personalization_signals: event.detail?.advertising === true
      });
    }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();