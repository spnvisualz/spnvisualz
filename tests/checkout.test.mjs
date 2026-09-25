// The checkout catalogue and the pages that sell from it.
//
// The prices a visitor reads are in HTML; the prices that get charged live
// in a payment provider's dashboard, with spn-config.js as the map between
// them. Nothing but a test keeps those three in step, and the failure is
// the worst kind — silent, and about money. So: every buy button must name
// an item that exists, and every price printed next to one must match the
// catalogue.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// spn-config.js is a browser script that assigns window.SPN_CONFIG, so it
// is read by running it against a stub rather than imported.
const catalogue = (() => {
  const src = readFileSync(join(root, "public/assets/js/spn-config.js"), "utf8");
  const win = {};
  new Function("window", src)(win);
  return win.SPN_CONFIG.checkout;
})();

function htmlFiles(dir = root, found = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", "dist", ".git"].includes(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) htmlFiles(path, found);
    else if (entry.endsWith(".html")) found.push(path);
  }
  return found;
}
const pages = htmlFiles().map((p) => ({ path: relative(root, p), html: readFileSync(p, "utf8") }));

const skus = new Set(Object.keys(catalogue.items));

test("the catalogue is well formed", () => {
  assert.ok(skus.size > 0, "no items");
  for (const [sku, item] of Object.entries(catalogue.items)) {
    assert.match(sku, /^[a-z0-9-]+$/, `${sku} is not a url-safe key`);
    assert.equal(typeof item.price, "number", `${sku} has no numeric price`);
    assert.ok(item.price > 0, `${sku} is priced at ${item.price}`);
    assert.ok(item.label && item.label.length > 2, `${sku} has no label`);
    assert.equal(typeof item.url, "string", `${sku}.url must be a string, empty until configured`);
    if (item.recurring) assert.ok(["month", "year"].includes(item.recurring), `${sku} has an odd interval`);
  }
});

test("every buy button names an item that exists", () => {
  for (const { path, html } of pages) {
    for (const m of html.matchAll(/data-buy="([^"]*)"/g)) {
      if (m[1] === "") continue; // set empty at runtime to mean "not buyable"
      assert.ok(skus.has(m[1]), `${path} has data-buy="${m[1]}", which is not in the catalogue`);
    }
  }
});

test("every SKU named in code exists too", () => {
  // main.js translates the names used in order= links into catalogue keys.
  // A typo there is a button that silently does nothing, so the map is
  // parsed rather than pattern-matched — an earlier version of this test
  // guessed at SKUs by prefix and flagged the CSS class "intro-active".
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const block = main.match(/const sku = \{([\s\S]*?)\}\[order\];/);
  assert.ok(block, "main.js no longer maps order= names to SKUs — update this test");

  let mapped = 0;
  for (const m of block[1].matchAll(/:\s*"([a-z0-9-]+)"/g)) {
    assert.ok(skus.has(m[1]), `src/main.js maps to "${m[1]}", which is not in the catalogue`);
    mapped += 1;
  }
  // the two website plans built as template literals
  for (const m of block[1].matchAll(/`(web-[a-z]+)-\$\{billing\}`/g)) {
    for (const period of ["monthly", "yearly"]) {
      assert.ok(skus.has(`${m[1]}-${period}`),
        `src/main.js can build "${m[1]}-${period}", which is not in the catalogue`);
      mapped += 1;
    }
  }
  assert.ok(mapped >= 10, `only ${mapped} names were checked — has the map shrunk?`);
});

test("every data-sku on a service row exists", () => {
  // services.js reads this off the row to decide what the detail panel buys.
  const index = readFileSync(join(root, "index.html"), "utf8");
  let rows = 0;
  for (const m of index.matchAll(/data-sku="([a-z0-9-]+)"/g)) {
    assert.ok(skus.has(m[1]), `index.html has data-sku="${m[1]}", which is not in the catalogue`);
    rows += 1;
  }
  assert.equal(rows, 6, `expected 6 service rows to carry a SKU, found ${rows}`);
});

test("the price on the page is the price in the catalogue", () => {
  // Each tier button prints its own price. If someone edits one and not the
  // other, a visitor is quoted one number and charged another.
  const index = readFileSync(join(root, "index.html"), "utf8");
  const buttons = index.matchAll(
    /data-buy="([a-z0-9-]+)"[\s\S]{0,400}?<b>&euro;([\d,]+)<\/b>/g
  );
  let checked = 0;
  for (const m of buttons) {
    const [, sku, shown] = m;
    const item = catalogue.items[sku];
    if (!item) continue;
    assert.equal(
      Number(shown.replace(/,/g, "")),
      item.price,
      `index.html shows €${shown} for ${sku} but the catalogue says €${item.price}`
    );
    checked += 1;
  }
  assert.ok(checked >= 8, `only ${checked} tier prices were cross-checked — did the markup change?`);
});

test("the website packages match what /websites/ advertises", () => {
  const site = readFileSync(join(root, "websites/index.html"), "utf8");
  for (const m of site.matchAll(/data-sku-monthly="([^"]+)" data-sku-yearly="([^"]+)" data-monthly="€([\d,]+)" data-yearly="€([\d,]+)"/g)) {
    const [, monthlySku, yearlySku, monthly, yearly] = m;
    assert.equal(catalogue.items[monthlySku].price, Number(monthly.replace(/,/g, "")),
      `${monthlySku}: page says €${monthly}`);
    assert.equal(catalogue.items[yearlySku].price, Number(yearly.replace(/,/g, "")),
      `${yearlySku}: page says €${yearly}`);
    assert.equal(catalogue.items[monthlySku].recurring, "month");
    assert.equal(catalogue.items[yearlySku].recurring, "year");
  }
});

test("nothing can be bought until its url is filled in", () => {
  // This is the safety property the whole rollout depends on: an item with
  // no url must report as not configured, so its button keeps whatever
  // fallback it had instead of going nowhere.
  const src = readFileSync(join(root, "public/assets/js/spn-checkout.js"), "utf8");
  assert.match(src, /isConfigured/, "spn-checkout.js must expose isConfigured");
  assert.match(src, /if \(!sku \|\| !isConfigured\(sku\)\) return;/,
    "the click handler must bail before preventDefault for an unconfigured item");
});

test("a configured buy button does not also open the enquiry form", () => {
  // The buy buttons keep data-order as their fallback, so the enquiry
  // dialog binds a listener to the very same element. stopPropagation does
  // not stop a second listener on the same element — only
  // stopImmediatePropagation does. With the weaker call, clicking a
  // configured item both sent the visitor to Stripe and opened the form
  // behind them; confirmed in Chromium before and after.
  const src = readFileSync(join(root, "public/assets/js/spn-checkout.js"), "utf8");
  assert.match(src, /event\.stopImmediatePropagation\(\)/);
  assert.doesNotMatch(src, /event\.stopPropagation\(\)/,
    "stopPropagation is not enough here — the enquiry dialog is on the same element");
});

test("the fallback is still reachable on every buy button", () => {
  // Until the catalogue is filled in, each buy button needs something to
  // fall back to — the enquiry dialog on the homepage, a real link on the
  // websites page. A data-buy with neither is a dead control.
  for (const { path, html } of pages) {
    for (const m of html.matchAll(/<(button|a)\b([^>]*\bdata-buy="[a-z0-9-]+"[^>]*)>/g)) {
      const attrs = m[2];
      const hasFallback = /\bdata-order\b/.test(attrs) || /\bhref="/.test(attrs) || /\bdata-checkout-show\b/.test(attrs);
      assert.ok(hasFallback, `${path}: a data-buy control has no fallback — ${m[0].slice(0, 120)}`);
    }
  }
});
