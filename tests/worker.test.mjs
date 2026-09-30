import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import worker from "../worker/index.js";
import { parseCart } from "../server/store.js";

// The SDK serializes real requests; only the network transport is replaced.
// No test-mode Stripe objects or external calls are made.
test("production Worker checkout, verification and signed webhooks", async (t) => {
  t.mock.method(console, "error", () => {});
  const original = Stripe.createFetchHttpClient;
  const calls = [];
  const session = {
    id: "cs_live_validation123", object: "checkout.session", livemode: true,
    client_secret: "local-fixture", status: "open", payment_status: "unpaid",
    currency: "eur", amount_total: 12800,
    metadata: { order_source: "spnvisualz_store" },
    line_items: { data: [{ description: "Logo design — Basic", quantity: 2, amount_total: 4400 }] }
  };
  Stripe.createFetchHttpClient = () => ({
    getClientName: () => "local-validation",
    makeRequest: async (_host, _port, path, method, headers, body) => {
      calls.push({ path, method, headers, body: new URLSearchParams(body) });
      return {
        getStatusCode: () => 200, getHeaders: () => ({}),
        getRawResponse: () => ({}), toJSON: async () => structuredClone(session)
      };
    }
  });
  t.after(() => { Stripe.createFetchHttpClient = original; });
  const env = {
    STRIPE_RESTRICTED_KEY: "rk_live_localfixture",
    STRIPE_PUBLISHABLE_KEY: "pk_live_localfixture",
    STRIPE_WEBHOOK_SECRET: "whsec_localfixture",
    PUBLIC_SITE_URL: "https://spnvisualz.com"
  };
  const cart = {
    cartId: "cart_validation123", revision: 1, express: true,
    items: [{ sku: "logo-basic", quantity: 2 }, { sku: "loop-basic", quantity: 1 }]
  };
  const checkoutRequest = () => new Request("https://spnvisualz.com/api/create-checkout-session", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cart)
  });
  await t.test("creates a multi-service EUR embedded session without unsupported branding", async () => {
    const response = await worker.fetch(checkoutRequest(), env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).publishableKey, env.STRIPE_PUBLISHABLE_KEY);
    const call = calls.at(-1);
    assert.equal(call.body.get("ui_mode"), "embedded_page");
    assert.equal(call.body.get("line_items[0][quantity]"), "2");
    assert.equal(call.body.get("line_items[2][quantity]"), "1");
    assert.equal(call.body.get("adaptive_pricing[enabled]"), "false");
    assert.equal(call.body.get("automatic_tax[enabled]"), "false");
    assert.equal(call.body.has("branding_settings[logo][url]"), false);
    assert.equal(call.body.get("return_url"), "https://spnvisualz.com/thank-you.html?session_id={CHECKOUT_SESSION_ID}");
  });
  await t.test("rejects sandbox credentials before contacting Stripe", async () => {
    const before = calls.length;
    const response = await worker.fetch(checkoutRequest(), { ...env, STRIPE_PUBLISHABLE_KEY: "pk_test_localfixture" });
    assert.equal(response.status, 400);
    assert.equal(calls.length, before);
  });
  await t.test("accepts actual live ID syntax and reports unpaid order truthfully", async () => {
    const response = await worker.fetch(new Request("https://spnvisualz.com/api/checkout-session?session_id=cs_live_validation123"), env);
    assert.equal(response.status, 200);
    const order = await response.json();
    assert.equal(order.paymentStatus, "unpaid");
    assert.equal(order.total, 12800);
    assert.equal(order.lines[0].quantity, 2);
    const invalid = await worker.fetch(new Request("https://spnvisualz.com/api/checkout-session?session_id=cs_test_validation123"), env);
    assert.equal(invalid.status, 400);
  });
  await t.test("ignores unrelated checkout orders", async () => {
    session.metadata = { order_source: "another_store" };
    const response = await worker.fetch(new Request("https://spnvisualz.com/api/checkout-session?session_id=cs_live_validation123"), env);
    assert.equal(response.status, 404);
    session.metadata = { order_source: "spnvisualz_store" };
  });
  await t.test("rejects unsigned webhooks and processes signed paid events", async () => {
    const payload = JSON.stringify({
      id: "evt_localfixture", type: "checkout.session.completed", livemode: true,
      data: { object: { ...session, status: "complete", payment_status: "paid" } }
    });
    const request = (signature) => new Request("https://spnvisualz.com/api/stripe-webhook", {
      method: "POST", headers: signature ? { "stripe-signature": signature } : {}, body: payload
    });
    assert.equal((await worker.fetch(request(), env)).status, 400);
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET });
    assert.equal((await worker.fetch(request(signature), env)).status, 200);
    assert.equal(calls.at(-1).body.get("metadata[order_status]"), "paid_ready");
  });
  await t.test("records delayed payment outcomes from signed events", async () => {
    for (const [type, paymentStatus, expected] of [
      ["checkout.session.completed", "unpaid", "processing"],
      ["checkout.session.async_payment_succeeded", "paid", "paid_ready"],
      ["checkout.session.async_payment_failed", "unpaid", "payment_failed"]
    ]) {
      const payload = JSON.stringify({
        id: "evt_localfixture", type, livemode: true,
        data: { object: { ...session, status: "complete", payment_status: paymentStatus } }
      });
      const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET });
      const response = await worker.fetch(new Request("https://spnvisualz.com/api/stripe-webhook", {
        method: "POST", headers: { "stripe-signature": signature }, body: payload
      }), env);
      assert.equal(response.status, 200);
      assert.equal(calls.at(-1).body.get("metadata[order_status]"), expected);
    }
  });
});

test("catalogue rejects inherited object names as services", () => {
  for (const sku of ["__proto__", "constructor", "toString"]) {
    assert.throws(() => parseCart({ items: [{ sku, quantity: 1 }] }), /unavailable/);
  }
});
