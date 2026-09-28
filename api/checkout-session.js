/*
 * Creates the Stripe Checkout Session.
 *
 * The request body carries SKUs and quantities. It does not carry prices,
 * and if it did they would be ignored: every amount below is computed
 * here from api/_catalogue.json, which ships with the server and cannot
 * be reached from a browser. That is the answer to "the customer must not
 * be able to edit values and pay less" — there is no price in the request
 * to edit.
 */

import { catalogue, json, bad, stripe, cors, allowedOrigin } from "./_lib.js";
import { priceOrder, orderMode } from "../src/store/pricing.js";

const MAX_LINES = 20;

export default async function handler(req, env = {}) {
  const headers = cors(env, req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...headers, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" } });
  }
  if (req.method !== "POST") return bad("POST only", 405);

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return bad("Malformed request");
  }

  const lines = Array.isArray(body?.lines) ? body.lines.slice(0, MAX_LINES) : [];
  if (!lines.length) return bad("The basket is empty");

  // Priced here, from the server's own catalogue.
  const order = priceOrder(catalogue.items, lines);
  // Rejections are reported before emptiness, because they are the more
  // specific answer: a basket of nothing but unknown items is not "empty",
  // it is a page and a server that disagree about what is for sale. Either
  // way nothing is dropped quietly — charging for a subset of what was
  // reviewed would be worse than refusing.
  if (order.rejected.length) {
    return bad(`Not for sale: ${order.rejected.filter(Boolean).join(", ") || "unknown item"}`, 409);
  }
  if (!order.lines.length) return bad("Nothing in the basket could be priced");
  if (order.totalCents < 100) return bad("Order total is below the minimum chargeable amount");

  const mode = orderMode(order);
  if (mode === "mixed") {
    return bad("A subscription and a one-off purchase cannot be paid together. Please order them separately.", 409);
  }

  const site = allowedOrigin(env);

  const line_items = order.lines.map((l) => ({
    quantity: l.qty,
    price_data: {
      currency: order.currency,
      // unit_amount, not the line total: Stripe multiplies by quantity
      // itself, and sending the line total here would charge qty times
      // too much. The express surcharge rides on the unit price so the
      // arithmetic stays Stripe's.
      unit_amount: Math.round((l.total / l.qty) * 100),
      product_data: {
        name: l.express ? `${l.label} — Express` : l.label,
        metadata: { sku: l.sku, express: String(l.express) }
      },
      ...(l.recurring ? { recurring: { interval: l.recurring } } : {})
    }
  }));

  try {
    const session = await stripe(env, "checkout/sessions", {
      body: {
        ui_mode: "embedded",
        mode,
        line_items,
        // Stripe returns the customer to our own page, which then asks
        // this server what really happened. The session id is in the URL
        // only so we know which order to ask about — reaching the page
        // proves nothing by itself.
        return_url: `${site}/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,
        automatic_tax: { enabled: true },
        billing_address_collection: "auto",
        phone_number_collection: { enabled: false },
        // The brief, collected inside checkout so ordering never requires
        // an email app.
        custom_fields: [
          { key: "brand", label: { type: "custom", custom: "Brand / artist name" }, type: "text", optional: false },
          { key: "brief", label: { type: "custom", custom: "What do you need?" }, type: "text", optional: false },
          { key: "deadline", label: { type: "custom", custom: "Deadline (optional)" }, type: "text", optional: true }
        ],
        metadata: {
          spn_lines: JSON.stringify(order.lines.map((l) => [l.sku, l.qty, l.express ? 1 : 0])).slice(0, 480),
          spn_base: String(order.base),
          spn_express: String(order.express),
          spn_total: String(order.total)
        }
      }
    });

    return json(
      {
        clientSecret: session.client_secret,
        sessionId: session.id,
        // Echoed so the page can prove to itself that the summary it
        // displayed matches what the server priced.
        total: order.total,
        currency: order.currency
      },
      200,
      headers
    );
  } catch (err) {
    // Never surface the key or the raw Stripe error object.
    return json({ error: err.message || "Could not start checkout" }, err.status === 400 ? 400 : 502, headers);
  }
}
