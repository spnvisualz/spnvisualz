/*
 * What the thank-you page asks before it says "paid".
 *
 * The page is handed a session id in its URL, which proves nothing: a URL
 * can be typed, shared or guessed at. So the page shows nothing until
 * this endpoint has asked Stripe directly what the payment status of that
 * session is, and it reports only what Stripe says.
 *
 * Read-only, and it returns the minimum needed to render a confirmation —
 * no payment method details, nothing that could be used to impersonate
 * the customer.
 */

import { json, bad, stripe, cors, orderRef } from "./_lib.js";

export default async function handler(req, env = {}) {
  const headers = cors(env, req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...headers, "access-control-allow-methods": "GET, OPTIONS" } });
  }
  if (req.method !== "GET") return bad("GET only", 405);

  const id = new URL(req.url).searchParams.get("session_id");
  // Session ids are cs_ prefixed; refuse anything else before spending a
  // Stripe call on it.
  if (!id || !/^cs_[A-Za-z0-9_]+$/.test(id)) return bad("Unknown order");

  try {
    const s = await stripe(env, `checkout/sessions/${encodeURIComponent(id)}?expand[]=line_items`, { method: "GET" });

    // The only field that decides whether this reads as a confirmed
    // purchase. Anything other than "paid" is reported as such.
    const paid = s.payment_status === "paid";

    return json(
      {
        status: s.status,                 // open | complete | expired
        paymentStatus: s.payment_status,  // paid | unpaid | no_payment_required
        paid,
        reference: orderRef(s.id),
        email: s.customer_details?.email || null,
        name: s.customer_details?.name || null,
        currency: (s.currency || "eur").toUpperCase(),
        amountTotal: typeof s.amount_total === "number" ? s.amount_total / 100 : null,
        items: (s.line_items?.data || []).map((li) => ({
          description: li.description,
          quantity: li.quantity,
          amount: typeof li.amount_total === "number" ? li.amount_total / 100 : null
        })),
        express: (s.metadata?.spn_express && Number(s.metadata.spn_express) > 0) || false,
        created: s.created ? new Date(s.created * 1000).toISOString() : null
      },
      200,
      headers
    );
  } catch (err) {
    if (err.status === 404) return json({ error: "Unknown order", paid: false }, 404, headers);
    return json({ error: "Could not reach Stripe", paid: false }, 502, headers);
  }
}
