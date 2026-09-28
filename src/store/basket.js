/*
 * The SPNVISUALZ basket.
 *
 * The security property of this module is in what it refuses to hold.
 * A basket line is { sku, qty, express } and nothing else — no price, no
 * label, no total. Every amount shown anywhere is recomputed from the
 * catalogue at render time.
 *
 * That is deliberate and it is the whole defence on the client side. If a
 * price lived in localStorage, editing it in devtools would change what
 * the customer is charged; because only the SKU lives there, the worst a
 * tampered basket can do is contain items the catalogue already prices.
 * The server repeats the same computation from its own copy before Stripe
 * is ever told an amount, so the client is not trusted even about this.
 */

import { priceLine as computeLine, priceOrder, EXPRESS_RATE as RATE } from "./pricing.js";

const STORAGE_KEY = "spn_basket_v1";
const EVENT = "spn:basket";

// Re-exported from pricing.js, which is the single implementation shared
// with the server. The basket does no arithmetic of its own.
export const EXPRESS_RATE = RATE;

const catalogue = () => window.SPN_CONFIG?.checkout?.items || {};
export const itemFor = (sku) => catalogue()[sku] || null;

/* ---------- persistence ------------------------------------------- */

// Storage is read as hostile input: it survives across deploys, it can be
// hand-edited, and a half-written value from a previous version must not
// throw on load. Anything that does not survive validation is dropped
// rather than repaired, because a silently repaired basket is worse than
// an empty one.
function read() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (_) {
    return []; // private mode, blocked storage — the basket is just in-memory
  }
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((line) => line && typeof line.sku === "string" && itemFor(line.sku) && !itemFor(line.sku).quoteOnly)
    .map((line) => ({
      sku: line.sku,
      qty: clampQty(line.qty),
      express: line.express === true
    }))
    // one line per sku+express combination
    .filter((line, i, all) => all.findIndex((l) => key(l) === key(line)) === i)
    .slice(0, 40);
}

function write(lines) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch (_) {
    // Out of quota, or storage disabled. The in-memory basket still works
    // for this page; it simply will not survive navigation.
  }
  state = lines;
  announce();
}

const clampQty = (n) => {
  const q = Math.floor(Number(n));
  return Number.isFinite(q) && q > 0 ? Math.min(q, 99) : 1;
};

// Express is part of a line's identity: the same service ordered normally
// and ordered express are two different things to buy, not one line with
// a flag that overwrites itself.
const key = (line) => `${line.sku}::${line.express ? "x" : "n"}`;

let state = null;
const load = () => (state ??= read());

// Drop the in-memory copy so the next read comes from storage. Needed
// whenever something outside this module may have written: another tab,
// or a page that has just come back from checkout.
export const refresh = () => { state = null; };

/* ---------- pricing ------------------------------------------------ */

// Every figure the customer sees comes from here, and here reads the
// catalogue — never storage. Returned in whole euro because that is how
// the catalogue is written; the server converts to minor units for Stripe.
export function priceLine(line) {
  const item = itemFor(line.sku);
  return item ? computeLine(item, line) : null;
}

export function totals(lines = load()) {
  const { base, express, total, count } = priceOrder(catalogue(), lines);
  return { base, express, total, count };
}

/* ---------- reading ------------------------------------------------- */

export const lines = () => load().map((l) => ({ ...l, price: priceLine(l), item: itemFor(l.sku) }));
export const count = () => totals().count;
export const isEmpty = () => load().length === 0;

// What gets sent to the server: SKUs and quantities only. Not prices —
// there is deliberately nothing here for the server to trust.
export const asOrder = () => load().map(({ sku, qty, express }) => ({ sku, qty, express }));

/* ---------- writing -------------------------------------------------- */

export function add(sku, { qty = 1, express = false } = {}) {
  const entry = itemFor(sku);
  // quoteOnly items are listed so the studio can invoice them, but they
  // have no agreed price yet. Their buttons still carry data-buy for the
  // Payment Link path, so the refusal has to live here rather than
  // relying on markup.
  if (!entry || entry.quoteOnly) return false;
  const next = [...load()];
  const line = { sku, qty: clampQty(qty), express: express === true };
  const existing = next.findIndex((l) => key(l) === key(line));
  if (existing >= 0) next[existing] = { ...next[existing], qty: clampQty(next[existing].qty + line.qty) };
  else next.push(line);
  write(next);
  return true;
}

export function setQty(sku, express, qty) {
  const target = key({ sku, express });
  const n = Math.floor(Number(qty));
  if (Number.isFinite(n) && n <= 0) return remove(sku, express);
  write(load().map((l) => (key(l) === target ? { ...l, qty: clampQty(qty) } : l)));
}

export function setExpress(sku, wasExpress, express) {
  const from = key({ sku, express: wasExpress });
  const moving = load().find((l) => key(l) === from);
  if (!moving) return;
  // Changing express changes the line's identity, so it may now collide
  // with a line that already exists. Merge rather than create a duplicate.
  const rest = load().filter((l) => key(l) !== from);
  const moved = { ...moving, express: express === true };
  const collision = rest.findIndex((l) => key(l) === key(moved));
  if (collision >= 0) rest[collision] = { ...rest[collision], qty: clampQty(rest[collision].qty + moved.qty) };
  else rest.push(moved);
  write(rest);
}

export const remove = (sku, express) => write(load().filter((l) => key(l) !== key({ sku, express })));
export const clear = () => write([]);

/* ---------- change notification ------------------------------------- */

function announce() {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { count: count(), totals: totals() } }));
}

export const onChange = (fn) => {
  window.addEventListener(EVENT, fn);
  // Another tab is the same basket. Without this, buying in one tab and
  // switching back to another shows a stale count.
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    refresh();
    fn(new CustomEvent(EVENT, { detail: { count: count(), totals: totals() } }));
  });
  return () => window.removeEventListener(EVENT, fn);
};

export const STORAGE_KEY_FOR_TESTS = STORAGE_KEY;
