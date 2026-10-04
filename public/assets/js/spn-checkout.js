(() => {
  "use strict";

  const cfg = () => (window.SPN_CONFIG && window.SPN_CONFIG.checkout) || null;
  const storeCfg = () => (cfg() && cfg().store) || {};
  const items = () => (cfg() && cfg().items) || {};
  const item = (sku) => items()[sku] || null;
  const storeEnabled = () => storeCfg().enabled === true;
  const storageKey = () => storeCfg().storageKey || "spnvisualz_cart_v1";
  const currency = () => storeCfg().currency || "EUR";

  const randomId = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID().replaceAll("-", "");
    return `${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
  };

  const freshCart = () => ({
    schema: 1,
    cartId: randomId(),
    revision: 0,
    items: {},
    express: false
  });

  const sanitise = (raw) => {
    const clean = freshCart();
    if (!raw || typeof raw !== "object") return clean;
    if (typeof raw.cartId === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(raw.cartId)) clean.cartId = raw.cartId;
    if (Number.isInteger(raw.revision) && raw.revision >= 0) clean.revision = raw.revision;
    clean.express = raw.express === true;
    if (raw.items && typeof raw.items === "object") {
      for (const [sku, value] of Object.entries(raw.items)) {
        const entry = item(sku);
        const quantity = Number(value);
        if (entry?.cart === true && Number.isInteger(quantity) && quantity > 0) {
          clean.items[sku] = Math.min(quantity, 10);
        }
      }
    }
    return clean;
  };

  const load = () => {
    try { return sanitise(JSON.parse(localStorage.getItem(storageKey()))); }
    catch (_) { return freshCart(); }
  };

  let cart = load();
  const listeners = new Set();

  const save = () => {
    localStorage.setItem(storageKey(), JSON.stringify(cart));
    render();
    listeners.forEach((listener) => listener(snapshot()));
  };

  const mutate = (fn) => {
    fn(cart);
    cart.revision += 1;
    save();
  };

  const quantity = (sku) => Number(cart.items[sku]) || 0;

  // `from` is where the item jumps from: the button that was pressed, or a
  // rect captured before its container went away (the service preview
  // closes first, because a modal dialog sits in the top layer and anything
  // flying out of it would be drawn underneath it).
  const add = (sku, amount = 1, { from } = {}) => {
    const entry = item(sku);
    if (!entry || entry.cart !== true) return false;
    const launch = launchPoint(from);
    // Counted as in flight before the cart changes, so the badge keeps the
    // old number until the item actually lands in it.
    if (launch) inFlight += amount;
    mutate((next) => { next.items[sku] = Math.min(10, quantity(sku) + amount); });
    track("add_to_cart", sku, amount);
    const confirm = () => toast(`${entry.label} added to basket`);
    if (!launch) {
      catchInBasket();
      confirm();
      return true;
    }
    jumpIntoBasket(entry, launch).then(() => {
      inFlight = Math.max(0, inFlight - amount);
      render();
      catchInBasket();
      confirm();
    });
    return true;
  };

  const setQuantity = (sku, value) => {
    if (!item(sku)?.cart) return;
    const nextValue = Math.max(0, Math.min(10, Number(value) || 0));
    mutate((next) => {
      if (nextValue === 0) delete next.items[sku];
      else next.items[sku] = nextValue;
    });
  };

  const setExpress = (enabled) => mutate((next) => { next.express = Boolean(enabled); });
  const clear = () => { cart = freshCart(); save(); };

  const lines = () => Object.entries(cart.items).map(([sku, qty]) => ({
    sku,
    quantity: qty,
    ...item(sku)
  })).filter((entry) => entry.cart === true);

  const count = () => lines().reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = () => lines().reduce((sum, line) => sum + line.price * line.quantity, 0)
    + (cart.express ? (item("express-delivery")?.price || 40) : 0);

  const snapshot = () => ({
    cartId: cart.cartId,
    revision: cart.revision,
    items: lines().map(({ sku, quantity: qty }) => ({ sku, quantity: qty })),
    express: cart.express,
    count: count(),
    subtotal: subtotal(),
    currency: currency()
  });

  const format = (amount) => new Intl.NumberFormat("en", {
    style: "currency", currency: currency(), maximumFractionDigits: 0
  }).format(amount);

  const track = (eventName, sku, qty = 1) => {
    const entry = item(sku);
    if (typeof window.gtag !== "function" || !entry) return;
    try {
      window.gtag("event", eventName, {
        currency: currency(),
        value: entry.price * qty,
        items: [{ item_id: sku, item_name: entry.label, price: entry.price, quantity: qty }]
      });
    } catch (_) {}
  };

  let basketButton;
  let basketDialog;
  let basketLines;
  let basketEmpty;
  let basketTotal;
  let expressInput;
  let checkoutLink;
  let toastTimer;

  /*
   * The jump into the basket.
   *
   * A small token carrying the item's name and price leaves the button
   * that was pressed, rises, and drops into the basket along a real arc —
   * a quadratic curve whose control point sits above both ends, so it
   * always goes up before it comes down. That one shape covers both
   * layouts: on desktop the basket is top-right, so the token arcs up and
   * over; on a phone it is bottom-right, so it hops up and falls in.
   *
   * The curve is sampled into keyframes rather than left to CSS easing,
   * because a straight-line tween with an ease curve can only ever travel
   * in a straight line. Translate, rotate and scale only — nothing that
   * triggers layout — so it holds frame rate on a phone mid-scroll.
   */
  let inFlight = 0;
  let activeTokens = 0;
  const MAX_TOKENS = 5;

  const prefersReducedMotion = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  const launchPoint = (from) => {
    if (!from || !basketButton || prefersReducedMotion()) return null;
    if (activeTokens >= MAX_TOKENS) return null; // a frantic tapper gets the count, not a swarm
    const r = typeof from.getBoundingClientRect === "function" ? from.getBoundingClientRect() : from;
    if (!r || !(r.width > 0 && r.height > 0)) return null;
    // A source that is off screen has nothing visible to jump from.
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  const catchInBasket = () => {
    if (!basketButton || prefersReducedMotion()) return;
    // Removing and re-adding restarts the bounce, so two items landing in
    // quick succession each get their own catch.
    basketButton.classList.remove("is-catching");
    void basketButton.offsetWidth;
    basketButton.classList.add("is-catching");
  };

  const jumpIntoBasket = (entry, start) => new Promise((resolve) => {
    const token = document.createElement("div");
    token.className = "spn-cart-token";
    token.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.textContent = entry.label;
    const price = document.createElement("b");
    price.textContent = format(entry.price);
    token.append(name, price);
    document.body.append(token);
    activeTokens += 1;

    let settled = false;
    const land = () => {
      if (settled) return;
      settled = true;
      activeTokens -= 1;
      token.remove();
      resolve();
    };

    if (typeof token.animate !== "function") return land();

    const w = token.offsetWidth;
    const h = token.offsetHeight;
    const end = basketButton.getBoundingClientRect();
    const x0 = start.x, y0 = start.y;
    const x1 = end.left + end.width / 2, y1 = end.top + end.height / 2;
    const distance = Math.hypot(x1 - x0, y1 - y0);
    // Higher arcs for longer trips, within limits that keep it a hop.
    let lift = Math.min(240, Math.max(90, distance * 0.3));
    const cx = x0 + (x1 - x0) * 0.55;
    // On desktop the basket sits 40px from the top of the screen, so a tall
    // arc toward it would leave the viewport and the token would vanish
    // mid-jump. The highest point of a quadratic curve has a closed form;
    // flatten the arc until that point is on screen.
    const peakY = (cy) => {
      const d = y0 - 2 * cy + y1;
      return d > 0 ? y0 - ((y0 - cy) * (y0 - cy)) / d : Math.min(y0, y1);
    };
    let cy = Math.min(y0, y1) - lift;
    while (peakY(cy) < 14 && lift > 24) {
      lift *= 0.82;
      cy = Math.min(y0, y1) - lift;
    }
    // Long enough to follow with the eye, short enough not to make anyone wait.
    const duration = Math.round(Math.min(880, Math.max(560, 420 + distance * 0.4)));

    const STEPS = 16;
    const frames = [];
    for (let i = 0; i <= STEPS; i++) {
      const p = i / STEPS;
      // Mild ease-in on the path: it leaves at a float and drops in faster.
      const t = 0.72 * p + 0.28 * p * p;
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
      const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
      // A small lift on take-off, then it shrinks into the basket.
      const scale = p < 0.12 ? 1 + 0.08 * (p / 0.12) : 1.08 - 0.78 * Math.pow((p - 0.12) / 0.88, 1.15);
      const rotate = -7 + 15 * p;
      const opacity = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2;
      frames.push({
        offset: p,
        opacity,
        transform: `translate3d(${(x - w / 2).toFixed(1)}px, ${(y - h / 2).toFixed(1)}px, 0) rotate(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`
      });
    }

    const flight = token.animate(frames, { duration, easing: "linear", fill: "forwards" });
    flight.finished.then(land, land);
    // Some WebKit and in-app browsers never settle Animation.finished. The
    // landing is timed independently so an add can never be left hanging.
    setTimeout(land, duration + 120);
  });

  const toast = (message) => {
    let el = document.querySelector(".spn-store-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "spn-store-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.append(el);
    }
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2400);
  };

  const render = () => {
    if (!basketButton) return;
    const totalCount = count();
    // The number on the badge is what has landed. Screen readers get the
    // true count from the label straight away; only the visible digit waits
    // for the item to arrive, which is what makes the arrival read.
    basketButton.querySelector("b").textContent = String(Math.max(0, totalCount - inFlight));
    basketButton.setAttribute("aria-label", `Basket with ${totalCount} ${totalCount === 1 ? "service" : "services"}`);

    basketLines.innerHTML = "";
    for (const line of lines()) {
      const row = document.createElement("li");
      row.className = "spn-cart__line";
      row.dataset.sku = line.sku;
      row.innerHTML = `
        <div><strong></strong><small></small></div>
        <div class="spn-cart__quantity" aria-label="Quantity">
          <button type="button" data-cart-action="decrease" aria-label="Decrease quantity">−</button>
          <span></span>
          <button type="button" data-cart-action="increase" aria-label="Increase quantity">+</button>
        </div>
        <b></b>
        <button type="button" class="spn-cart__remove" data-cart-action="remove" aria-label="Remove from basket">Remove</button>`;
      row.querySelector("strong").textContent = line.label;
      row.querySelector("small").textContent = `${format(line.price)} each`;
      row.querySelector(".spn-cart__quantity span").textContent = String(line.quantity);
      row.querySelector(":scope > b").textContent = format(line.price * line.quantity);
      basketLines.append(row);
    }

    basketEmpty.hidden = totalCount !== 0;
    basketTotal.textContent = format(subtotal());
    expressInput.checked = cart.express;
    checkoutLink.classList.toggle("is-disabled", totalCount === 0);
    checkoutLink.setAttribute("aria-disabled", totalCount === 0 ? "true" : "false");
  };

  const installBasket = () => {
    if (!storeEnabled() || document.body.dataset.storeCheckout === "true") return;
    if (!document.querySelector('link[href*="/assets/css/store.css"]')) {
      const styles = document.createElement("link");
      styles.rel = "stylesheet";
      styles.href = "/assets/css/store.css?v=20261004.1";
      document.head.append(styles);
    }
    basketButton = document.createElement("button");
    basketButton.type = "button";
    basketButton.className = "spn-cart-button";
    basketButton.innerHTML = `<span>Basket</span><b>0</b>`;
    basketButton.addEventListener("click", () => basketDialog.showModal());

    basketDialog = document.createElement("dialog");
    basketDialog.className = "spn-cart";
    basketDialog.setAttribute("aria-labelledby", "spnCartTitle");
    basketDialog.innerHTML = `
      <div class="spn-cart__shell">
        <header><div><p>YOUR ORDER</p><h2 id="spnCartTitle">Basket</h2></div><button type="button" data-cart-close aria-label="Close basket">×</button></header>
        <p class="spn-cart__empty">Your basket is empty. Choose a service to begin.</p>
        <ul class="spn-cart__lines"></ul>
        <label class="spn-cart__express"><input type="checkbox"><span><strong>Express delivery</strong><small>Prioritised 24–48 hour delivery</small></span><b></b></label>
        <div class="spn-cart__total"><span>Order total</span><strong></strong></div>
        <a class="spn-cart__checkout" href="${storeCfg().checkoutUrl || "/checkout.html"}">Review &amp; pay securely <span aria-hidden="true">→</span></a>
        <p class="spn-cart__secure">Secure payment stays on SPNVISUALZ and is processed by Stripe.</p>
      </div>`;
    basketLines = basketDialog.querySelector(".spn-cart__lines");
    basketEmpty = basketDialog.querySelector(".spn-cart__empty");
    basketTotal = basketDialog.querySelector(".spn-cart__total strong");
    expressInput = basketDialog.querySelector(".spn-cart__express input");
    checkoutLink = basketDialog.querySelector(".spn-cart__checkout");
    basketDialog.querySelector(".spn-cart__express b").textContent = `+${format(item("express-delivery")?.price || 40)}`;

    basketDialog.querySelector("[data-cart-close]").addEventListener("click", () => basketDialog.close());
    basketDialog.addEventListener("click", (event) => {
      if (event.target === basketDialog) basketDialog.close();
      const action = event.target.closest?.("[data-cart-action]")?.dataset.cartAction;
      if (!action) return;
      const sku = event.target.closest("[data-sku]")?.dataset.sku;
      if (!sku) return;
      if (action === "increase") setQuantity(sku, quantity(sku) + 1);
      if (action === "decrease") setQuantity(sku, quantity(sku) - 1);
      if (action === "remove") setQuantity(sku, 0);
    });
    expressInput.addEventListener("change", () => setExpress(expressInput.checked));
    checkoutLink.addEventListener("click", (event) => {
      if (count() === 0) event.preventDefault();
      else {
        try {
          window.gtag?.("event", "begin_checkout", {
            currency: currency(), value: subtotal(),
            items: lines().map((line) => ({ item_id: line.sku, item_name: line.label, price: line.price, quantity: line.quantity }))
          });
        } catch (_) {}
      }
    });

    document.body.append(basketButton, basketDialog);
    render();
  };

  const urlFor = (sku) => {
    const url = item(sku)?.url;
    return typeof url === "string" && url.trim() ? url.trim() : null;
  };
  const isConfigured = (sku) => storeEnabled() ? item(sku)?.cart === true : Boolean(urlFor(sku));

  const open = (sku) => {
    if (storeEnabled()) {
      if (!add(sku)) return false;
      basketDialog?.showModal();
      return true;
    }
    const url = urlFor(sku);
    if (!url) return false;
    location.href = `${url}${url.includes("?") ? "&" : "?"}client_reference_id=${encodeURIComponent(sku)}`;
    return true;
  };

  const onClick = (event) => {
    const el = event.target.closest?.("[data-buy]");
    if (!el) return;
    // The service preview owns this control because it closes and animates
    // the preview before opening the basket. Let its local handler run.
    if (el.id === "serviceDialogOrder") return;
    const sku = el.dataset.buy;
    if (!sku || !isConfigured(sku)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (storeEnabled()) add(sku, 1, { from: el });
    else open(sku);
  };

  const applyLiveState = (root = document) => {
    root.querySelectorAll("[data-checkout-hide]").forEach((el) => {
      if (Object.keys(items()).some(isConfigured)) el.hidden = true;
    });
    root.querySelectorAll("[data-checkout-show]").forEach((el) => {
      const sku = el.dataset.buy;
      if (sku && isConfigured(sku)) el.hidden = false;
    });
    root.querySelectorAll("[data-checkout-label]").forEach((el) => {
      const sku = el.dataset.buy;
      if (sku && isConfigured(sku)) el.innerHTML = el.dataset.checkoutLabel;
    });
  };

  document.addEventListener("click", onClick, true);
  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey()) return;
    cart = load();
    render();
    listeners.forEach((listener) => listener(snapshot()));
  });

  window.SPN_CHECKOUT = Object.freeze({
    item,
    urlFor,
    isConfigured,
    open,
    applyLiveState,
    get live() { return Object.keys(items()).some(isConfigured); },
    cart: Object.freeze({
      add,
      clear,
      setQuantity,
      setExpress,
      snapshot,
      format,
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
    })
  });

  const start = () => { applyLiveState(); installBasket(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
