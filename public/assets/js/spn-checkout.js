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
  const add = (sku, amount = 1) => {
    const entry = item(sku);
    if (!entry || entry.cart !== true) return false;
    mutate((next) => { next.items[sku] = Math.min(10, quantity(sku) + amount); });
    track("add_to_cart", sku, amount);
    toast(`${entry.label} added to basket`);
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
    basketButton.querySelector("b").textContent = String(totalCount);
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
      styles.href = "/assets/css/store.css?v=20260928.2";
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
    if (storeEnabled()) add(sku);
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
