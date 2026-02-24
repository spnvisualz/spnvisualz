(() => {
  /* ==========================
     PAGE LOAD / SCROLL RESET
  =========================== */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });

  /* ==========================
     PRICING / FAQ ACCORDION
     - Only one open at a time
     - Click outside closes all
     - Proper aria states
  =========================== */
  const cards = Array.from(document.querySelectorAll("[data-card]"));

  const setCardState = (card, open) => {
    card.classList.toggle("is-open", open);

    const btn = card.querySelector(".card-btn");
    const details = card.querySelector(".details");

    if (btn) btn.setAttribute("aria-expanded", String(open));
    if (details) details.setAttribute("aria-hidden", String(!open));
  };

  const closeAll = (exceptCard = null) => {
    for (const card of cards) {
      if (exceptCard && card === exceptCard) continue;
      setCardState(card, false);
    }
  };

  // Init aria defaults + bind
  for (const card of cards) {
    const btn = card.querySelector(".card-btn");
    const details = card.querySelector(".details");
    if (!btn || !details) continue;

    // default closed
    setCardState(card, card.classList.contains("is-open"));

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const isOpen = card.classList.contains("is-open");
      closeAll(card);
      setCardState(card, !isOpen);
    });
  }

  // Close when clicking outside a card
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (!target.closest("[data-card]")) closeAll();
  });

  /* ==========================
     NAV SCROLL EFFECT
  =========================== */
  const nav = document.querySelector(".nav");
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle("scrolled", window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ==========================
     ACTIVE LINK AUTO-DETECT
     - avoids accidental partial matches
     - supports "/" properly
  =========================== */
  const links = document.querySelectorAll(".nav-links a[href]");
  const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";

  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;

    // Only treat internal paths like "/contact" or "contact.html"
    const normalizedHref = href.startsWith("/")
      ? href.replace(/\/+$/, "") || "/"
      : href;

    // If it's an absolute URL, ignore
    if (/^https?:\/\//i.test(href)) return;

    // Match logic:
    // - If link is "/" only match exact "/"
    // - Otherwise: match exact path OR path starts with "/href/"
    if (normalizedHref === "/") {
      if (currentPath === "/") link.classList.add("active");
      return;
    }

    // Convert "contact.html" -> "/contact.html" for pathname check
    const hrefPath = normalizedHref.startsWith("/") ? normalizedHref : `/${normalizedHref}`;
    if (currentPath === hrefPath || currentPath.startsWith(`${hrefPath}/`)) {
      link.classList.add("active");
    }
  });
  
  /* ==========================
     PARALLAX (smooth + performant)
     - Uses requestAnimationFrame
     - Won't fight other transforms if you use CSS variables
  =========================== */
  const parallaxEls = Array.from(document.querySelectorAll(".parallax"));
  if (parallaxEls.length) {
    let ticking = false;

    const update = () => {
      const offsetY = window.scrollY * 0.05;
      for (const el of parallaxEls) {
        // If you need to preserve existing transforms, switch to CSS var approach
        el.style.transform = `translateY(${offsetY}px)`;
      }
      ticking = false;
    };

    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );

    // Initial
    requestAnimationFrame(update);
  }
})();
