(() => {
  /* ==========================
     PAGE LOAD / SCROLL RESET
  =========================== */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });

  /* ==========================
     REMOVE CURSOR HALO (NORMAL CURSOR)
     - If you still have <div id="cursor-halo"></div> in HTML, remove it too.
     - This makes sure any leftover halo code/element is gone.
  =========================== */
  const halo = document.getElementById("cursor-halo");
  if (halo) halo.remove();

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

    // keep markup default (if card already has is-open)
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
  const nav = document.querySelector(".nav, .navbar");
  if (nav) {
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ==========================
     ACTIVE LINK AUTO-DETECT
     - avoids accidental partial matches
     - supports "/" properly
     - supports .nav-links a and .nav-item
  =========================== */
  const links = document.querySelectorAll(".nav-links a[href], a.nav-item[href]");
  const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";

  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;

    // If it's an absolute URL, ignore
    if (/^https?:\/\//i.test(href)) return;

    const normalizedHref = href.startsWith("/")
      ? href.replace(/\/+$/, "") || "/"
      : href;

    if (normalizedHref === "/") {
      if (currentPath === "/") link.classList.add("active");
      return;
    }

    const hrefPath = normalizedHref.startsWith("/") ? normalizedHref : `/${normalizedHref}`;
    if (currentPath === hrefPath || currentPath.startsWith(`${hrefPath}/`)) {
      link.classList.add("active");
    }
  });

  /* ==========================
     PARALLAX (smooth + performant)
     - Uses requestAnimationFrame
  =========================== */
  const parallaxEls = Array.from(document.querySelectorAll(".parallax"));
  if (parallaxEls.length) {
    let ticking = false;

    const update = () => {
      const offsetY = window.scrollY * 0.05;
      for (const el of parallaxEls) el.style.transform = `translateY(${offsetY}px)`;
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

    requestAnimationFrame(update);
  }

  /* ==========================
     BOOK YOUR WORK — PACKAGE SELECT (ALL OPTIONS)
     - Put all your packages here and they will appear in the dropdown.
     - Requires: <select id="packageSelect">...</select>
     - Optional: <div id="packagePrice"></div> for live price display
  =========================== */

  const PACKAGES = [
    // ✅ Replace these with ALL your real packages (names + prices)
    { id: "starter", label: "Starter", price: 999 },
    { id: "growth", label: "Growth", price: 2499 },
    { id: "pro", label: "Pro", price: 4499 },
    { id: "ultra", label: "Ultra", price: 6999 },
    { id: "retainer", label: "Monthly Retainer", price: 9999 },
    { id: "custom", label: "Custom Package", price: null }
  ];

  const packageSelect =
    document.getElementById("packageSelect") ||
    document.querySelector('select[name="package"]') ||
    document.querySelector('select[data-package-select]');

  if (packageSelect) {
    // Keep a placeholder at top
    const placeholderText =
      packageSelect.getAttribute("data-placeholder") || "Select package";

    // Clear existing options
    packageSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = placeholderText;
    placeholder.disabled = true;
    placeholder.selected = true;
    packageSelect.appendChild(placeholder);

    // Add ALL packages
    for (const p of PACKAGES) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent =
        p.price == null ? p.label : `${p.label} — ${p.price} NOK`;
      packageSelect.appendChild(opt);
    }

    // Optional live price display
    const priceEl =
      document.getElementById("packagePrice") ||
      document.querySelector("[data-package-price]");

    if (priceEl) {
      const renderPrice = () => {
        const picked = PACKAGES.find((p) => p.id === packageSelect.value);
        priceEl.textContent = !picked
          ? ""
          : picked.price == null
          ? "Custom pricing — we'll contact you."
          : `Price: ${picked.price} NOK`;
      };
      packageSelect.addEventListener("change", renderPrice);
      renderPrice();
    }
  }
})();
