/*
 * Stripe's word on what was actually paid.
 *
 * Two things make this trustworthy rather than an open endpoint that
 * anyone can POST "this order is paid" to:
 *
 *   - the signature is verified against STRIPE_WEBHOOK_SECRET before the
 *     body is parsed, over the exact raw bytes Stripe signed;
 *   - the timestamp is checked, so a request captured once cannot be
 *     replayed later.
 *
 * Stripe retries a webhook until it gets a 2xx, and will happily deliver
 * the same event more than once. Anything with a side effect below is
 * guarded so that a second delivery does nothing.
 */

import { json, stripe, verifyStripeSignature, orderRef } from "./_lib.js";

const signingSecret = (env) =>
  env?.STRIPE_WEBHOOK_SECRET || (typeof process !== "undefined" ? process.env?.STRIPE_WEBHOOK_SECRET : null);

export default async function handler(req, env = {}) {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Read the body as text, never as JSON first: the signature covers the
  // exact bytes, and re-serialising a parsed object does not reproduce them.
  const raw = await req.text();
  const ok = await verifyStripeSignature(raw, req.headers.get("stripe-signature"), signingSecret(env));
  if (!ok) return json({ error: "Invalid signature" }, 400);

  let event;
  try {
    event = JSON.parse(raw);
  } catch (_) {
    return json({ error: "Malformed payload" }, 400);
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    // Acknowledged so Stripe stops retrying something we do not act on.
    return json({ received: true, ignored: event.type });
  }

  const session = event.data?.object;
  if (!session?.id) return json({ received: true });
  if (session.payment_status !== "paid") return json({ received: true, note: "not paid" });

  try {
    // Idempotency without a database. The PaymentIntent's metadata is the
    // flag: if it already carries this marker, a previous delivery of this
    // event did the work and this one must not repeat it. Stripe is the
    // order record, so the guard lives on the Stripe object too rather
    // than in a second system that could disagree with it.
    const intentId = session.payment_intent;
    if (intentId) {
      const intent = await stripe(env, `payment_intents/${encodeURIComponent(intentId)}`, { method: "GET" });
      if (intent.metadata?.spn_processed === "1") {
        return json({ received: true, duplicate: true });
      }
      await stripe(env, `payment_intents/${encodeURIComponent(intentId)}`, {
        body: { metadata: { spn_processed: "1", spn_reference: orderRef(session.id) } },
        idempotencyKey: `spn-mark-${event.id}`
      });
    }

    await notifyStudio(env, session);
    return json({ received: true, reference: orderRef(session.id) });
  } catch (err) {
    // A 5xx asks Stripe to retry, which is right for a transient failure
    // and safe because of the guard above.
    return json({ error: err.message || "Processing failed" }, 500);
  }
}

/*
 * Tells the studio an order arrived, with the brief the customer typed
 * into checkout. The customer's own receipt is Stripe's job — enabling
 * receipts in the Stripe dashboard is what sends it — so nothing here
 * emails the customer, and there is no duplicate confirmation.
 *
 * Sends only if a provider is configured. With no key, this is a no-op
 * rather than an error: the order is still complete and still visible in
 * the Stripe dashboard.
 */
async function notifyStudio(env, session) {
  const key = env?.RESEND_API_KEY || (typeof process !== "undefined" ? process.env?.RESEND_API_KEY : null);
  const to = env?.STUDIO_EMAIL || (typeof process !== "undefined" ? process.env?.STUDIO_EMAIL : null);
  if (!key || !to) return;

  const fields = (session.custom_fields || [])
    .map((f) => `${f.label?.custom || f.key}: ${f.text?.value || f.dropdown?.value || "—"}`)
    .join("\n");

  const body = [
    `Order ${orderRef(session.id)}`,
    `${((session.amount_total ?? 0) / 100).toFixed(2)} ${(session.currency || "eur").toUpperCase()}`,
    `From: ${session.customer_details?.name || "—"} <${session.customer_details?.email || "—"}>`,
    "",
    fields || "(no brief fields)",
    "",
    `Stripe session: ${session.id}`
  ].join("\n");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env?.NOTIFY_FROM || "orders@spnvisualz.com",
      to: [to],
      subject: `New order ${orderRef(session.id)} — ${((session.amount_total ?? 0) / 100).toFixed(2)} ${(session.currency || "eur").toUpperCase()}`,
      text: body
    })
  }).catch(() => {});
}
