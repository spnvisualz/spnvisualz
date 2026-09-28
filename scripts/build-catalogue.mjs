// Writes api/_catalogue.json from the browser's catalogue.
//
// The server must price from the same list the page prices from, and the
// page's copy is a <script> served to browsers while the server may run
// on an edge runtime with no filesystem. Rather than maintain the list
// twice, it is generated — and tests/store.test.mjs fails if the two ever
// drift, so the generated copy cannot quietly go stale.
//
// Run: npm run catalogue

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function readBrowserCatalogue() {
  const src = readFileSync(join(root, "public/assets/js/spn-config.js"), "utf8");
  const win = {};
  new Function("window", src)(win);
  const checkout = win.SPN_CONFIG?.checkout;
  if (!checkout?.items) throw new Error("spn-config.js no longer exposes checkout.items");
  return checkout;
}

export function toServerCatalogue(checkout) {
  // Deliberately narrow: the server needs to price and label, and nothing
  // else. Checkout URLs in particular are a browser concern and have no
  // business in a server bundle.
  const items = {};
  for (const [sku, item] of Object.entries(checkout.items)) {
    items[sku] = { price: item.price, label: item.label };
    if (item.recurring) items[sku].recurring = item.recurring;
  }
  return { currency: "eur", items };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = toServerCatalogue(readBrowserCatalogue());
  writeFileSync(join(root, "api/_catalogue.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`api/_catalogue.json written — ${Object.keys(out.items).length} items`);
}
