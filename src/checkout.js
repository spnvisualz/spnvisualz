import "./styles/basket.css";
import * as basket from "./store/basket.js";
import { initBasketUI, storeIsLive } from "./store/basketUI.js";

/*
 * The checkout page.
 *
 * It renders the order from the basket, then asks the server for a Stripe
 * session. The summary it shows and the amount Stripe charges come from
 * two independent computations of the same catalogue — this page's, and
 * the server's — and the server echoes its total back so the page can
 * refuse to continue if they ever disagree.
 */

const euro = (n) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);
const apiBase = () => (window.SPN_CONFIG?.checkout?.apiBase || "").replace(/\/$/, "");
const el = (id) => document.getElementById(id);

const track = (name, params) => {
  if (typeof window.gtag !== "function") return;
  try { window.gtag("event", name, params); } catch (_) { /* blocked or no consent */ }
};

function renderSummary() {
  const lines = basket.lines();
  const t = basket.totals();

  const list = el("coLines");
  list.innerHTML = "";
  for (const line of lines) {
    const row = document.createElement("div");
    row.className = "co-line";
    const name = document.createElement("p");
    name.className = "co-line__name";
    name.textContent = line.item.label;
    const meta = document.createElement("p");
    meta.className = "co-line__meta";
    meta.textContent = [
      `${line.qty} × ${euro(line.item.price)}`,
      line.express ? "express +40%" : null,
      line.item.recurring ? `per ${line.item.recurring}` : null
    ].filter(Boolean).join(" · ");
    const price = document.createElement("p");
    price.className = "co-line__price";
    price.textContent = euro(line.price.total);
    row.append(name, meta, price);
    list.appendChild(row);
  }

  const sums = el("coSums");
  sums.innerHTML = "";
  const row = (label, value, cls = "") => {
    const d = document.createElement("div");
    if (cls) d.className = cls;
    const dt = document.createElement("dt"); dt.textContent = label;
    const dd = document.createElement("dd"); dd.textContent = value;
    d.append(dt, dd); sums.appendChild(d);
  };
  row("Subtotal", euro(t.base));
  if (t.express > 0) row("Express (+40%)", euro(t.express));
  row("Total", euro(t.total), "is-total");
  return t;
}

function showEmpty() {
  document.querySelector(".co-shell").innerHTML =
    '<div class="co-empty"><h1>Your basket is empty</h1>' +
    "<p>Pick a service and it will appear here.</p>" +
    '<a href="/#services">See the services</a></div>';
}

function notice(title, detail) {
  const n = el("coNotice");
  n.innerHTML = "";
  const strong = document.createElement("strong");
  strong.textContent = title;
  n.append(strong, document.createTextNode(detail));
  n.hidden = false;
}

function state(message, isError = false) {
  const s = el("coState");
  s.textContent = message;
  s.classList.toggle("is-error", isError);
}

async function mountStripe(total) {
  const base = apiBase();
  if (!base) {
    // No server yet. Say so plainly rather than showing a pay button that
    // cannot work.
    state("Card payment is not connected yet. Your basket is saved — please use Start a project to order in the meantime.", true);
    return;
  }

  const pk = window.SPN_CONFIG?.checkout?.publishableKey;
  if (!pk) return state("Payment is not configured (no publishable key).", true);

  state("Preparing secure payment…");

  let data;
  try {
    const res = await fetch(`${base}/api/checkout-session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines: basket.asOrder() })
    });
    data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Could not start checkout");
  } catch (err) {
    return state(err.message || "Could not reach the payment service. Your basket is safe — try again.", true);
  }

  // The page and the server priced the same basket independently. If they
  // disagree, something is wrong with one of them and nobody should be
  // charged until it is understood.
  if (Math.abs(Number(data.total) - total) > 0.005) {
    return state(
      `Price mismatch: this page shows ${euro(total)}, the server calculated ${euro(Number(data.total))}. Payment stopped. Please reload.`,
      true
    );
  }

  try {
    const stripe = window.Stripe(pk);
    const checkout = await stripe.initEmbeddedCheckout({ clientSecret: data.clientSecret });
    state("");
    checkout.mount("#coStripe");
    track("begin_checkout", {
      currency: "EUR", value: total,
      items: basket.lines().map((l) => ({ item_id: l.sku, item_name: l.item.label, price: l.price.total, quantity: l.qty }))
    });
  } catch (_) {
    state("Could not open the payment form. Your basket is safe — please reload and try again.", true);
  }
}

function loadStripeJs() {
  return new Promise((resolve, reject) => {
    if (window.Stripe) return resolve();
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3/";
    s.onload = resolve;
    s.onerror = () => reject(new Error("stripe.js failed to load"));
    document.head.appendChild(s);
  });
}

function boot() {
  el("year").textContent = String(new Date().getFullYear());
  initBasketUI();
  basket.refresh(); // a return from checkout may have changed nothing, but read fresh

  // Coming back from a cancelled or failed payment. The basket was never
  // touched, so this is only ever an explanation plus a retry.
  const params = new URLSearchParams(location.search);
  if (params.has("canceled") || params.has("cancelled")) {
    notice("Payment cancelled. ", "Nothing was charged and your basket is exactly as you left it. You can pay again below.");
  } else if (params.has("failed")) {
    notice("That payment did not go through. ", "Nothing was charged. Your basket is intact — try again below, or use a different card.");
  }

  if (basket.isEmpty()) return showEmpty();

  const totals = renderSummary();
  basket.onChange(() => (basket.isEmpty() ? showEmpty() : renderSummary()));

  if (!storeIsLive()) {
    return state("Card payment is not connected yet. Your basket is saved.", true);
  }
  loadStripeJs()
    .then(() => mountStripe(totals.total))
    .catch(() => state("Could not load the payment library. Your basket is safe.", true));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
