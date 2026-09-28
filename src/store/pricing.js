/*
 * The one place an amount is computed.
 *
 * The requirement is that what SPNVISUALZ shows and what Stripe charges
 * can never disagree. The usual way that breaks is two implementations of
 * the same arithmetic — one in the page, one on the server — drifting
 * apart by a rounding rule or an order of operations. So there is one
 * implementation, imported by both, and a test asserts the server's
 * answer equals the browser's for every item in the catalogue.
 *
 * Pure by design: no DOM, no storage, no network. It takes a catalogue
 * and lines and returns numbers, which is what makes it runnable on both
 * sides and testable without a browser.
 */

export const EXPRESS_RATE = 0.4;
export const CURRENCY = "eur";

// Money is rounded to the cent at every step it becomes visible, and the
// total is the sum of rounded lines — not a rounded sum. A customer who
// adds up the lines on the confirmation must get the total they paid.
const cents = (n) => Math.round(n * 100);
const round2 = (n) => Math.round(n * 100) / 100;

export function priceLine(item, line) {
  if (!item || typeof item.price !== "number") return null;
  const qty = Math.max(1, Math.min(99, Math.floor(Number(line.qty) || 1)));
  const base = round2(item.price * qty);
  const express = line.express === true ? round2(base * EXPRESS_RATE) : 0;
  return { qty, base, express, total: round2(base + express) };
}

export function priceOrder(catalogue, lines) {
  const priced = [];
  const rejected = [];

  for (const line of Array.isArray(lines) ? lines : []) {
    const item = catalogue?.[line?.sku];
    // quoteOnly items have no agreed price, so they cannot be charged for
    // automatically. Refused on the server as well as in the basket,
    // because the basket is the client and the client is not trusted.
    if (!item || item.quoteOnly) {
      rejected.push(line?.sku ?? null);
      continue;
    }
    const p = priceLine(item, line);
    if (!p) {
      rejected.push(line.sku);
      continue;
    }
    priced.push({
      sku: line.sku,
      label: item.label,
      unit: item.price,
      express: line.express === true,
      recurring: item.recurring || null,
      ...p
    });
  }

  const base = round2(priced.reduce((a, l) => a + l.base, 0));
  const express = round2(priced.reduce((a, l) => a + l.express, 0));
  const total = round2(base + express);

  return {
    currency: CURRENCY,
    lines: priced,
    rejected,
    base,
    express,
    total,
    // What Stripe is actually told, in minor units. Derived here so the
    // conversion cannot differ between the summary and the charge.
    totalCents: cents(total),
    count: priced.reduce((a, l) => a + l.qty, 0)
  };
}

// A mixed basket cannot become one Stripe payment: a subscription and a
// one-off are different modes. Worth refusing loudly rather than charging
// the wrong thing.
export function orderMode(order) {
  const recurring = order.lines.filter((l) => l.recurring);
  if (recurring.length === 0) return "payment";
  if (recurring.length === order.lines.length && order.lines.length === 1) return "subscription";
  return "mixed";
}
