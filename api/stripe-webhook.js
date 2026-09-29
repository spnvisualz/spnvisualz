import { stripeClient } from "../server/store.js";

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method not allowed");
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).end("Webhook is not configured");

  let event;
  const stripe = stripeClient();
  try {
    event = stripe.webhooks.constructEvent(
      await rawBody(req),
      req.headers["stripe-signature"],
      secret
    );
  } catch (error) {
    console.error("stripe_webhook_signature_failed", error.message);
    return res.status(400).end("Invalid signature");
  }

  const session = event.data.object;
  try {
    if (event.type === "checkout.session.completed") {
      await stripe.checkout.sessions.update(session.id, {
        metadata: { order_status: session.payment_status === "paid" ? "paid_ready" : "processing" }
      });
    } else if (event.type === "checkout.session.async_payment_succeeded") {
      await stripe.checkout.sessions.update(session.id, {
        metadata: { order_status: "paid_ready" }
      });
    } else if (event.type === "checkout.session.async_payment_failed") {
      await stripe.checkout.sessions.update(session.id, {
        metadata: { order_status: "payment_failed" }
      });
    }
  } catch (error) {
    console.error("stripe_webhook_fulfillment_failed", event.id, error);
    return res.status(500).end("Webhook processing failed");
  }

  return res.status(200).json({ received: true });
}

