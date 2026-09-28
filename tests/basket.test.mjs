// The basket's job is to be right about money and to survive a hostile
// localStorage. Both are tested here against the real catalogue.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- a browser, near enough -----------------------------------------
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};
const listeners = [];
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
globalThis.window = {
  addEventListener: (t, fn) => listeners.push([t, fn]),
  removeEventListener: () => {},
  dispatchEvent: (e) => listeners.filter(([t]) => t === e.type).forEach(([, fn]) => fn(e))
};
// the real catalogue, read the same way the browser reads it
const cfgSrc = readFileSync(join(root, "public/assets/js/spn-config.js"), "utf8");
new Function("window", cfgSrc)(globalThis.window);

const basket = await import("../src/store/basket.js");

beforeEach(() => { store.clear(); basket.clear(); });

test("an empty basket is empty and costs nothing", () => {
  assert.equal(basket.isEmpty(), true);
  assert.deepEqual(basket.totals(), { base: 0, express: 0, total: 0, count: 0 });
});

test("adding a known item prices it from the catalogue", () => {
  assert.equal(basket.add("logo-basic"), true);
  const t = basket.totals();
  assert.equal(t.base, 17);       // catalogue price
  assert.equal(t.express, 0);
  assert.equal(t.total, 17);
  assert.equal(t.count, 1);
});

test("an unknown sku cannot enter the basket", () => {
  assert.equal(basket.add("logo-deluxe-free"), false);
  assert.equal(basket.isEmpty(), true);
});

test("quantity multiplies, and express is 40% of the line", () => {
  basket.add("logo-premium", { qty: 3, express: true }); // 33 x 3 = 99
  const t = basket.totals();
  assert.equal(t.base, 99);
  assert.equal(t.express, 39.6);   // 40% of the whole line, not of one unit
  assert.equal(t.total, 138.6);
});

test("the same item added twice merges instead of duplicating", () => {
  basket.add("intro-standard", { qty: 2 });
  basket.add("intro-standard", { qty: 3 });
  assert.equal(basket.lines().length, 1);
  assert.equal(basket.totals().count, 5);
});

test("express and non-express of the same service are separate lines", () => {
  // They are two different things to buy, so one must not overwrite the other.
  basket.add("loop-basic", { qty: 1, express: false });
  basket.add("loop-basic", { qty: 1, express: true });
  assert.equal(basket.lines().length, 2);
  assert.equal(basket.totals().base, 52);
  assert.equal(basket.totals().express, 10.4);
});

test("toggling express merges into an existing matching line", () => {
  basket.add("loop-basic", { qty: 2, express: true });
  basket.add("loop-basic", { qty: 1, express: false });
  basket.setExpress("loop-basic", false, true);   // the single one joins the pair
  assert.equal(basket.lines().length, 1);
  assert.equal(basket.totals().count, 3);
  assert.equal(basket.totals().base, 78);
});

test("quantity of zero or less removes the line", () => {
  basket.add("visuals-brand");
  basket.setQty("visuals-brand", false, 0);
  assert.equal(basket.isEmpty(), true);
});

test("quantity is clamped to something a studio could actually deliver", () => {
  basket.add("logo-basic", { qty: 100000 });
  assert.equal(basket.totals().count, 99);
  basket.clear();
  basket.add("logo-basic", { qty: -5 });
  assert.equal(basket.totals().count, 1);
});

// --- the security property -------------------------------------------

test("no price is ever written to storage", () => {
  basket.add("bundle-business", { qty: 2, express: true }); // a 336 item
  const raw = localStorage.getItem(basket.STORAGE_KEY_FOR_TESTS);
  assert.doesNotMatch(raw, /336/, "a price reached storage — it must be recomputed, never stored");
  assert.doesNotMatch(raw, /price|total|amount/i, "storage must hold sku, qty and express only");
  assert.deepEqual(JSON.parse(raw), [{ sku: "bundle-business", qty: 2, express: true }]);
});

test("a tampered basket cannot invent a cheaper price", () => {
  // The attack this design exists to defeat: edit localStorage, reload,
  // pay less. The price is not there to edit, and anything extra is dropped.
  localStorage.setItem(
    basket.STORAGE_KEY_FOR_TESTS,
    JSON.stringify([{ sku: "bundle-business", qty: 1, express: false, price: 1, total: 1 }])
  );
  basket.refresh(); // what a page reload does
  const t = basket.totals();
  assert.equal(t.total, 336, "the catalogue price must win over anything in storage");
});

test("a tampered basket cannot invent an item", () => {
  localStorage.setItem(
    basket.STORAGE_KEY_FOR_TESTS,
    JSON.stringify([{ sku: "free-everything", qty: 1 }, { sku: "logo-basic", qty: 1 }])
  );
  basket.refresh();
  assert.deepEqual(basket.asOrder(), [{ sku: "logo-basic", qty: 1, express: false }]);
});

test("corrupt storage is survived, not thrown on", () => {
  for (const junk of ["", "{", "null", '"a string"', "[1,2,3]", '[{"sku":null}]', "[[]]"]) {
    localStorage.setItem(basket.STORAGE_KEY_FOR_TESTS, junk);
    basket.refresh();
    assert.doesNotThrow(() => basket.totals(), `threw on ${junk}`);
    assert.equal(basket.isEmpty(), true, `did not reset on ${junk}`);
  }
});

test("what goes to the server is skus and quantities, nothing else", () => {
  basket.add("logo-basic", { qty: 2, express: true });
  assert.deepEqual(basket.asOrder(), [{ sku: "logo-basic", qty: 2, express: true }]);
  for (const line of basket.asOrder()) {
    assert.deepEqual(Object.keys(line).sort(), ["express", "qty", "sku"]);
  }
});

test("the basket survives a reload", () => {
  basket.add("care-monthly", { qty: 1 });
  const saved = localStorage.getItem(basket.STORAGE_KEY_FOR_TESTS);
  store.clear();
  localStorage.setItem(basket.STORAGE_KEY_FOR_TESTS, saved);
  basket.refresh(); // a fresh page load
  assert.equal(basket.totals().total, 25);
  assert.equal(basket.lines().length, 1);
});
