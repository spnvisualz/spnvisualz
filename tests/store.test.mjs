import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPRESS_DELIVERY,
  EXPRESS_RATE,
  STORE_CATALOG,
  expressUnitAmountFor,
  idempotencyKeyFor,
  lineItemsFor,
  parseCart
} from "../server/store.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const browserCatalogue = (() => {
  const src = readFileSync(join(root, "public/assets/js/spn-config.js"), "utf8");
  const win = {};
  new Function("window", src)(win);
  return win.SPN_CONFIG.checkout;
})();

test("every cart item has one trusted live Stripe Price with the same amount", () => {
  const cartItems = Object.entries(browserCatalogue.items).filter(([, item]) => item.cart === true);
  assert.equal(cartItems.length, 12);
  for (const [sku, item] of cartItems) {
    assert.ok(STORE_CATALOG[sku], `${sku} is missing from the server allowlist`);
    assert.match(STORE_CATALOG[sku].price, /^price_[a-zA-Z0-9]+$/);
    assert.equal(STORE_CATALOG[sku].unitAmount, item.price * 100, `${sku} amount differs`);
  }
  assert.equal(EXPRESS_DELIVERY.rate, EXPRESS_RATE);
  assert.equal(browserCatalogue.items["express-delivery"].rate, EXPRESS_RATE);
});

test("the server ignores browser prices and accepts only known SKUs", () => {
  assert.throws(
    () => parseCart({ items: [{ sku: "not-a-real-service", quantity: 1, price: 1 }] }),
    /unavailable/
  );
  const cart = parseCart({ items: [{ sku: "loop-premium", quantity: 1, price: 1 }] });
  assert.deepEqual(lineItemsFor(cart), [{ price: STORE_CATALOG["loop-premium"].price, quantity: 1 }]);
});

test("duplicate lines combine safely and quantities are capped", () => {
  const cart = parseCart({
    items: [
      { sku: "logo-basic", quantity: 2 },
      { sku: "logo-basic", quantity: 3 }
    ],
    express: true,
    cartId: "cart_12345678",
    revision: 4
  });
  assert.deepEqual(cart.items, [{ sku: "logo-basic", quantity: 5 }]);
  assert.deepEqual(lineItemsFor(cart), [
    { price: STORE_CATALOG["logo-basic"].price, quantity: 5 },
    {
      price_data: {
        currency: "eur",
        unit_amount: 4400,
        product_data: { name: EXPRESS_DELIVERY.label }
      },
      quantity: 1
    }
  ]);
  assert.equal(expressUnitAmountFor(cart), 4400);
  assert.equal(idempotencyKeyFor(cart), "spn_checkout_cart_12345678_4");
  assert.throws(
    () => parseCart({ items: [{ sku: "logo-basic", quantity: 11 }] }),
    /between 1 and 10/
  );
});

test("Express is exactly 40% of the trusted service subtotal", () => {
  const cart = parseCart({
    items: [
      { sku: "logo-premium", quantity: 1 },
      { sku: "intro-premium", quantity: 1 }
    ],
    express: true
  });
  assert.equal(expressUnitAmountFor(cart), 4920);
  assert.equal(lineItemsFor(cart).at(-1).price_data.unit_amount, 4920);
});

test("checkout uses embedded mode, dynamic payment methods, and verified return state", () => {
  const create = readFileSync(join(root, "api/create-checkout-session.js"), "utf8");
  const worker = readFileSync(join(root, "worker/index.js"), "utf8");
  const cloudflare = readFileSync(join(root, "wrangler.jsonc"), "utf8");
  const webhook = readFileSync(join(root, "api/stripe-webhook.js"), "utf8");
  const thankYou = readFileSync(join(root, "public/assets/js/spn-thank-you.js"), "utf8");
  assert.match(create, /ui_mode:\s*"embedded_page"/);
  assert.match(create, /integration_identifier:/);
  assert.match(create, /automatic_tax:\s*\{ enabled: false \}/);
  assert.doesNotMatch(create, /^\s*payment_method_types:/m);
  assert.match(webhook, /constructEvent/);
  assert.match(webhook, /checkout\.session\.async_payment_succeeded/);
  assert.match(worker, /ui_mode:\s*"embedded_page"/);
  assert.match(worker, /constructEventAsync/);
  assert.match(worker, /createSubtleCryptoProvider/);
  assert.doesNotMatch(worker, /^\s*payment_method_types:/m);
  assert.doesNotMatch(cloudflare, /"assets"|"ASSETS"/);
  assert.match(cloudflare, /"send_email"/);
  assert.match(worker, /pathname === "\/api\/enquiry"/);
  assert.match(worker, /return json\(\{ error: "Not found\." \}, 404\)/);
  assert.match(thankYou, /paymentStatus === "paid"/);
  assert.match(thankYou, /localStorage\.removeItem/);
});

test("custom projects cannot enter instant checkout", () => {
  assert.equal(browserCatalogue.items["deposit-custom"].cart, undefined);
  assert.equal(browserCatalogue.items["deposit-custom"].url, "");
});
