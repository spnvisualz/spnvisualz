/*
 * The basket, on screen.
 *
 * Only mounts when SPN_CONFIG.checkout.apiBase is set. Until a server
 * exists there is nowhere for a basket to check out to, and a basket that
 * cannot be paid is worse than no basket at all — so the site keeps its
 * current behaviour and this stays dormant.
 */

import * as basket from "./basket.js";

const apiBase = () => (window.SPN_CONFIG?.checkout?.apiBase || "").replace(/\/$/, "");
export const storeIsLive = () => Boolean(apiBase());

const euro = (n) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

const track = (name, params) => {
  if (typeof window.gtag !== "function") return;
  // Analytics must never be able to break a purchase.
  try {
    window.gtag("event", name, params);
  } catch (_) {
    /* consent not granted, or the tag is blocked */
  }
};

const gaItems = (lines) =>
  lines.map((l) => ({
    item_id: l.sku, item_name: l.item?.label || l.sku,
    price: l.price?.total ?? 0, quantity: l.qty,
    item_variant: l.express ? "express" : "standard"
  }));

let drawer, listEl, countEls = [], totalEl, baseRow, expressRow, checkoutBtn, emptyEl;

/* ---------- markup -------------------------------------------------- */

function build() {
  drawer = document.createElement("aside");
  drawer.className = "spn-basket";
  drawer.id = "spnBasket";
  drawer.hidden = true;
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-label", "Your basket");
  drawer.innerHTML = `
    <div class="spn-basket__scrim" data-basket-close></div>
    <div class="spn-basket__panel" data-lenis-prevent>
      <header class="spn-basket__head">
        <p class="spn-basket__label">Your basket</p>
        <button type="button" class="spn-basket__close" data-basket-close aria-label="Close basket">&times;</button>
      </header>
      <div class="spn-basket__list" data-basket-list></div>
      <p class="spn-basket__empty" data-basket-empty>Nothing here yet.</p>
      <footer class="spn-basket__foot">
        <dl class="spn-basket__sums">
          <div data-basket-base-row><dt>Subtotal</dt><dd data-basket-base></dd></div>
          <div data-basket-express-row hidden><dt>Express (+40%)</dt><dd data-basket-express></dd></div>
          <div class="is-total"><dt>Total</dt><dd data-basket-total></dd></div>
        </dl>
        <p class="spn-basket__note">Delivery 3&ndash;5 days, or 24&ndash;48h on express. VAT shown at checkout.</p>
        <a class="spn-basket__checkout" href="/checkout/" data-basket-checkout>Checkout</a>
      </footer>
    </div>`;
  document.body.appendChild(drawer);

  listEl = drawer.querySelector("[data-basket-list]");
  emptyEl = drawer.querySelector("[data-basket-empty]");
  totalEl = drawer.querySelector("[data-basket-total]");
  baseRow = drawer.querySelector("[data-basket-base]");
  expressRow = drawer.querySelector("[data-basket-express]");
  checkoutBtn = drawer.querySelector("[data-basket-checkout]");

  drawer.addEventListener("click", (e) => {
    if (e.target.closest("[data-basket-close]")) close();
  });
  checkoutBtn.addEventListener("click", () => {
    const t = basket.totals();
    track("begin_checkout", { currency: "EUR", value: t.total, items: gaItems(basket.lines()) });
  });
}

/* ---------- rendering ----------------------------------------------- */

function render() {
  const lines = basket.lines();
  const t = basket.totals();

  countEls.forEach((el) => {
    el.textContent = String(t.count);
    el.hidden = t.count === 0;
  });

  if (!listEl) return;
  listEl.innerHTML = "";
  emptyEl.hidden = lines.length > 0;
  drawer.querySelector(".spn-basket__foot").hidden = lines.length === 0;

  for (const line of lines) {
    const row = document.createElement("div");
    row.className = "spn-basket__line";
    // textContent everywhere below — a label is studio copy, but building
    // rows with innerHTML from data is how an XSS gets in later.
    const name = document.createElement("p");
    name.className = "spn-basket__name";
    name.textContent = line.item.label;

    const meta = document.createElement("p");
    meta.className = "spn-basket__meta";
    meta.textContent = line.express
      ? `Express · ${euro(line.item.price)} + 40% each`
      : `${euro(line.item.price)} each`;

    const qty = document.createElement("div");
    qty.className = "spn-basket__qty";
    for (const [delta, label] of [[-1, "Decrease quantity"], [1, "Increase quantity"]]) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = delta < 0 ? "−" : "+";
      b.setAttribute("aria-label", `${label} of ${line.item.label}`);
      b.addEventListener("click", () => basket.setQty(line.sku, line.express, line.qty + delta));
      if (delta < 0) qty.appendChild(b); else { const n = document.createElement("span"); n.textContent = String(line.qty); qty.appendChild(n); qty.appendChild(b); }
    }

    const price = document.createElement("p");
    price.className = "spn-basket__price";
    price.textContent = euro(line.price.total);

    const actions = document.createElement("div");
    actions.className = "spn-basket__actions";
    const exp = document.createElement("button");
    exp.type = "button";
    exp.className = "spn-basket__express";
    exp.setAttribute("aria-pressed", String(line.express));
    exp.textContent = line.express ? "Express on" : "Add express";
    exp.addEventListener("click", () => {
      basket.setExpress(line.sku, line.express, !line.express);
      if (!line.express) track("spn_express_selected", { item_id: line.sku });
    });
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "spn-basket__remove";
    rm.textContent = "Remove";
    rm.addEventListener("click", () => {
      track("remove_from_cart", { currency: "EUR", value: line.price.total, items: gaItems([line]) });
      basket.remove(line.sku, line.express);
    });
    actions.append(exp, rm);

    row.append(name, meta, qty, price, actions);
    listEl.appendChild(row);
  }

  baseRow.textContent = euro(t.base);
  expressRow.textContent = euro(t.express);
  drawer.querySelector("[data-basket-express-row]").hidden = t.express === 0;
  totalEl.textContent = euro(t.total);
}

/* ---------- open / close --------------------------------------------- */

let lastFocus = null;

export function open() {
  if (!drawer) return;
  lastFocus = document.activeElement;
  drawer.hidden = false;
  document.documentElement.classList.add("basket-open");
  window.SPN_SCROLL?.stop?.();
  drawer.querySelector(".spn-basket__close")?.focus();
  const t = basket.totals();
  track("view_cart", { currency: "EUR", value: t.total, items: gaItems(basket.lines()) });
}

export function close() {
  if (!drawer) return;
  drawer.hidden = true;
  document.documentElement.classList.remove("basket-open");
  window.SPN_SCROLL?.start?.();
  if (lastFocus instanceof HTMLElement) lastFocus.focus();
}

/* ---------- mounting -------------------------------------------------- */

export function initBasketUI() {
  if (!storeIsLive()) return null;

  build();
  // The header control ships hidden so it never appears while there is no
  // store behind it.
  document.querySelectorAll("[data-basket-control]").forEach((el) => { el.hidden = false; });
  countEls = Array.from(document.querySelectorAll("[data-basket-count]"));
  document.querySelectorAll("[data-basket-open]").forEach((el) =>
    el.addEventListener("click", (e) => { e.preventDefault(); open(); })
  );

  // Add to basket. Capture phase and stopImmediatePropagation for the same
  // reason the Payment Link handler needs them: these buttons keep their
  // old handlers as a fallback, and those live on the same element.
  document.addEventListener("click", (e) => {
    const el = e.target.closest?.("[data-buy]");
    if (!el) return;
    const sku = el.dataset.buy;
    if (!sku || !basket.itemFor(sku)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    basket.add(sku, { qty: 1 });
    const item = basket.itemFor(sku);
    track("add_to_cart", { currency: "EUR", value: item.price, items: [{ item_id: sku, item_name: item.label, price: item.price, quantity: 1 }] });
    open();
  }, true);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !drawer.hidden) close();
  });

  basket.onChange(render);
  render();
  return { open, close, render };
}
