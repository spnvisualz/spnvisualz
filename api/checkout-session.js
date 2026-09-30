import { stripeClient } from "../server/store.js";

function send(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(data));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { error: "Method not allowed." });
  }

  const sessionId = typeof req.query?.session_id === "string" ? req.query.session_id : "";
  if (!/^cs_live_[a-zA-Z0-9]+$/.test(sessionId)) {
    return send(res, 400, { error: "Invalid order reference." });
  }

  try {
    const session = await stripeClient().checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"]
    });
    if (!session.livemode || session.metadata?.order_source !== "spnvisualz_store") {
      return send(res, 404, { error: "We could not find that order." });
    }
    const lines = (session.line_items?.data || []).map((line) => ({
      name: line.description,
      quantity: line.quantity || 1,
      total: line.amount_total
    }));
    return send(res, 200, {
      orderNumber: session.id.slice(-10).toUpperCase(),
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email || null,
      currency: session.currency,
      total: session.amount_total,
      lines
    });
  } catch (error) {
    console.error("checkout_session_retrieve_failed", error);
    return send(res, 404, { error: "We could not find that order." });
  }
}
