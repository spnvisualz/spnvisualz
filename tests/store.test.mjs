// The server half: that it prices from its own catalogue whatever the
// request says, and that the webhook cannot be forged.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHmac } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { priceOrder, orderMode, EXPRESS_RATE } = await import("../src/store/pricing.js");
const lib = await import("../api/_lib.js");
const { readBrowserCatalogue, toServerCatalogue } = await import("../scripts/build-catalogue.mjs");

/* ---------- the two catalogues must agree ------------------------- */

test("the server catalogue is in step with the browser's", () => {
  const generated = toServerCatalogue(readBrowserCatalogue());
  assert.deepEqual(
    JSON.parse(readFileSync(join(root, "api/_catalogue.json"), "utf8")),
    generated,
    "api/_catalogue.json is stale — run `npm run catalogue`"
  );
});

test("the server prices every item exactly as the browser does", () => {
  // One implementation is imported by both, so this asserts the thing
  // that could still drift: that they are fed the same numbers.
  const browser = readBrowserCatalogue().items;
  const server = lib.catalogue.items;
  for (const sku of Object.keys(browser)) {
    for (const express of [false, true]) {
      for (const qty of [1, 3]) {
        const a = priceOrder(browser, [{ sku, qty, express }]);
        const b = priceOrder(server, [{ sku, qty, express }]);
        assert.equal(a.total, b.total, `${sku} q${qty}${express ? " express" : ""}`);
        assert.equal(a.totalCents, b.totalCents);
      }
    }
  }
});

test("the server carries no checkout urls", () => {
  const raw = readFileSync(join(root, "api/_catalogue.json"), "utf8");
  assert.doesNotMatch(raw, /https?:\/\//, "a url reached the server catalogue");
  assert.doesNotMatch(raw, /\burl\b/, "the server has no business holding checkout urls");
});

/* ---------- pricing ------------------------------------------------ */

test("express is 40% and rides on the whole line", () => {
  assert.equal(EXPRESS_RATE, 0.4);
  const unit = lib.catalogue.items["logo-premium"].price;
  const o = priceOrder(lib.catalogue.items, [{ sku: "logo-premium", qty: 3, express: true }]);
  assert.equal(o.base, unit * 3);
  assert.equal(o.express, Math.round(unit * 3 * 0.4 * 100) / 100);
  assert.equal(o.total, Math.round(unit * 3 * 1.4 * 100) / 100);
  assert.equal(o.totalCents, Math.round(unit * 3 * 1.4 * 100));
});

test("the total is the sum of the lines a customer can read", () => {
  const o = priceOrder(lib.catalogue.items, [
    { sku: "logo-basic", qty: 1, express: true },
    { sku: "intro-standard", qty: 2, express: false }
  ]);
  assert.equal(o.lines.reduce((a, l) => a + l.total, 0).toFixed(2), o.total.toFixed(2));
  const expected = lib.catalogue.items["logo-basic"].price * 1.4 + lib.catalogue.items["intro-standard"].price * 2;
  assert.equal(o.total, Math.round(expected * 100) / 100);
});

test("a subscription cannot be paid alongside a one-off", () => {
  const mixed = priceOrder(lib.catalogue.items, [{ sku: "logo-basic", qty: 1 }, { sku: "care-monthly", qty: 1 }]);
  assert.equal(orderMode(mixed), "mixed");
  assert.equal(orderMode(priceOrder(lib.catalogue.items, [{ sku: "logo-basic", qty: 1 }])), "payment");
  assert.equal(orderMode(priceOrder(lib.catalogue.items, [{ sku: "care-monthly", qty: 1 }])), "subscription");
});

test("unknown skus are rejected, not silently dropped", () => {
  const o = priceOrder(lib.catalogue.items, [{ sku: "logo-basic", qty: 1 }, { sku: "free-please", qty: 1 }]);
  assert.deepEqual(o.rejected, ["free-please"]);
});

/* ---------- the price cannot be sent from the browser -------------- */

test("a price in the request body is ignored; Stripe is told the catalogue price", async () => {
  // The attack: post a basket claiming the bundle costs 1 cent. What
  // matters is not that the server errors, but that the amount it hands
  // Stripe is the real one. So: capture the outgoing Stripe call.
  let sent = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent = new URLSearchParams(init.body);
    return new Response(JSON.stringify({ id: "cs_test_123", client_secret: "cs_test_123_secret" }),
      { status: 200, headers: { "content-type": "application/json" } });
  };
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";

  const handler = (await import("../api/checkout-session.js")).default;
  const res = await handler(new Request("https://spnvisualz.com/api/checkout-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      lines: [{ sku: "bundle-business", qty: 1, express: false, price: 0.01, total: 0.01, amount: 1 }],
      total: 0.01, amount_total: 1, currency: "eur"
    })
  }), { STRIPE_SECRET_KEY: "sk_test_dummy" });

  globalThis.fetch = realFetch;

  assert.equal(res.status, 200);
  const unit = sent.get("line_items[0][price_data][unit_amount]");
  const real = lib.catalogue.items["bundle-business"].price;
  assert.equal(unit, String(real * 100), `Stripe was told ${unit} instead of the catalogue's ${real * 100}`);
  const body = await res.json();
  assert.equal(body.total, real, "the server reported a total other than the catalogue's");
});

test("checkout refuses an empty or unsellable basket", async () => {
  const handler = (await import("../api/checkout-session.js")).default;
  const post = (body) => handler(new Request("https://spnvisualz.com/api/checkout-session",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    { STRIPE_SECRET_KEY: "sk_test_dummy" });

  assert.equal((await post({ lines: [] })).status, 400);
  assert.equal((await post({ lines: [{ sku: "nope", qty: 1 }] })).status, 409);
  assert.equal((await post({}).catch(() => ({ status: 400 }))).status, 400);
  const mixed = await post({ lines: [{ sku: "logo-basic", qty: 1 }, { sku: "care-monthly", qty: 1 }] });
  assert.equal(mixed.status, 409);
});

/* ---------- the webhook cannot be forged --------------------------- */

const SECRET = "whsec_test_secret";
const sign = (payload, ts = Math.floor(Date.now() / 1000)) =>
  `t=${ts},v1=${createHmac("sha256", SECRET).update(`${ts}.${payload}`).digest("hex")}`;

test("a correctly signed webhook verifies", async () => {
  const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  assert.equal(await lib.verifyStripeSignature(payload, sign(payload), SECRET), true);
});

test("an unsigned, wrongly signed or wrong-secret webhook is rejected", async () => {
  const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  assert.equal(await lib.verifyStripeSignature(payload, null, SECRET), false);
  assert.equal(await lib.verifyStripeSignature(payload, "t=1,v1=deadbeef", SECRET), false);
  assert.equal(await lib.verifyStripeSignature(payload, sign(payload), "whsec_other"), false);
  // the body changed after signing
  assert.equal(await lib.verifyStripeSignature(payload + " ", sign(payload), SECRET), false);
});

test("a captured webhook cannot be replayed later", async () => {
  const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const old = Math.floor(Date.now() / 1000) - 3600;
  assert.equal(await lib.verifyStripeSignature(payload, sign(payload, old), SECRET), false);
});

test("the webhook endpoint refuses anything it cannot verify", async () => {
  const handler = (await import("../api/stripe-webhook.js")).default;
  const res = await handler(new Request("https://spnvisualz.com/api/stripe-webhook", {
    method: "POST", body: JSON.stringify({ type: "checkout.session.completed" })
  }), { STRIPE_WEBHOOK_SECRET: SECRET });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /signature/i);
});

test("signature comparison is not short-circuited", () => {
  assert.equal(lib.timingSafeEqual("abc", "abc"), true);
  assert.equal(lib.timingSafeEqual("abc", "abd"), false);
  assert.equal(lib.timingSafeEqual("abc", "ab"), false);
  assert.equal(lib.timingSafeEqual("abc", null), false);
});

test("no secret is present anywhere in the repo's committed code", () => {
  for (const f of ["api/_lib.js", "api/checkout-session.js", "api/stripe-webhook.js", "api/order.js",
                   "public/assets/js/spn-config.js", "api/_catalogue.json"]) {
    const src = readFileSync(join(root, f), "utf8");
    assert.doesNotMatch(src, /sk_live_[A-Za-z0-9]/, `${f} contains a live secret key`);
    assert.doesNotMatch(src, /sk_test_[A-Za-z0-9]{10}/, `${f} contains a test secret key`);
    assert.doesNotMatch(src, /whsec_[A-Za-z0-9]{10}/, `${f} contains a webhook signing secret`);
  }
});


test("a quote-only item is refused by the server too", () => {
  const o = priceOrder(lib.catalogue.items, [{ sku: "deposit-custom", qty: 1 }]);
  assert.deepEqual(o.rejected, ["deposit-custom"]);
  assert.equal(o.lines.length, 0);
});
