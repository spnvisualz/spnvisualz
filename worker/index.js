import Stripe from "stripe";
import {
  STORE_INTEGRATION_ID,
  STORE_SITE_URL,
  cartDescription,
  idempotencyKeyFor,
  lineItemsFor,
  parseCart
} from "../server/store.js";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

function text(message, status = 200, extraHeaders = {}) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}

function stripeClient(env) {
  const apiKey = env.STRIPE_RESTRICTED_KEY || env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error("Stripe server key is not configured.");
  if (!/^(rk|sk)_live_/.test(apiKey)) throw new Error("Checkout requires a live Stripe server key.");
  return new Stripe(apiKey, {
    apiVersion: "2026-08-26.dahlia",
    httpClient: Stripe.createFetchHttpClient()
  });
}

function siteUrl(env) {
  return (env.PUBLIC_SITE_URL || STORE_SITE_URL).trim().replace(/\/$/, "");
}

async function createCheckout(request, env) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
  }

  try {
    if (!env.STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_")) {
      throw new Error("Checkout requires a live Stripe publishable key.");
    }
    const cart = parseCart(await request.json());
    const stripe = stripeClient(env);
    const publicUrl = siteUrl(env);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      origin_context: "web",
      integration_identifier: STORE_INTEGRATION_ID,
      line_items: lineItemsFor(cart),
      return_url: `${publicUrl}/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,
      redirect_on_completion: "always",
      customer_creation: "always",
      billing_address_collection: "auto",
      name_collection: {
        individual: { enabled: true, optional: false },
        business: { enabled: true, optional: true }
      },
      phone_number_collection: { enabled: true },
      automatic_tax: { enabled: false },
      adaptive_pricing: { enabled: false },
      managed_payments: { enabled: false },
      submit_type: "book",
      custom_fields: [
        {
          key: "project_name",
          label: { type: "custom", custom: "Project, brand or artist name" },
          type: "text",
          optional: false,
          text: { maximum_length: 80 }
        },
        {
          key: "project_brief",
          label: { type: "custom", custom: "Short creative brief" },
          type: "text",
          optional: false,
          text: { maximum_length: 255 }
        },
        {
          key: "deadline",
          label: { type: "custom", custom: "Deadline or launch date" },
          type: "text",
          optional: true,
          text: { maximum_length: 80 }
        }
      ],
      custom_text: {
        submit: {
          message: "Production begins after payment. Standard delivery is 3–5 working days; Express orders are prioritised for 24–48 hour delivery."
        }
      },
      branding_settings: {
        display_name: "SPNVISUALZ",
        background_color: "#030207",
        button_color: "#8a4dff",
        border_style: "rounded",
        font_family: "inter"
      },
      client_reference_id: cart.cartId,
      metadata: {
        cart_id: cart.cartId,
        cart_revision: String(cart.revision),
        order_items: cartDescription(cart),
        order_source: "spnvisualz_store"
      },
      payment_intent_data: {
        description: "SPNVISUALZ creative services order",
        metadata: {
          cart_id: cart.cartId,
          order_items: cartDescription(cart),
          order_source: "spnvisualz_store"
        }
      }
      // Payment methods remain dynamic and are managed in Stripe Dashboard.
    }, { idempotencyKey: idempotencyKeyFor(cart) });

    if (!session.client_secret) throw new Error("Stripe did not return a checkout client secret.");
    if (!env.STRIPE_PUBLISHABLE_KEY) throw new Error("Stripe publishable key is not configured.");
    return json({
      clientSecret: session.client_secret,
      publishableKey: env.STRIPE_PUBLISHABLE_KEY
    });
  } catch (error) {
    console.error("checkout_session_create_failed", error);
    const safeMessage = error?.type
      ? "Stripe could not start checkout. Please try again."
      : error?.message;
    return json({ error: safeMessage || "Checkout could not be started." }, 400);
  }
}

async function retrieveCheckout(request, env) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed." }, 405, { Allow: "GET" });
  }

  const sessionId = new URL(request.url).searchParams.get("session_id") || "";
  if (!/^cs_live_[a-zA-Z0-9]+$/.test(sessionId)) {
    return json({ error: "Invalid order reference." }, 400);
  }

  try {
    const session = await stripeClient(env).checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"]
    });
    if (!session.livemode || session.metadata?.order_source !== "spnvisualz_store") {
      return json({ error: "We could not find that order." }, 404);
    }
    const lines = (session.line_items?.data || []).map((line) => ({
      name: line.description,
      quantity: line.quantity || 1,
      total: line.amount_total
    }));
    return json({
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
    return json({ error: "We could not find that order." }, 404);
  }
}

async function receiveWebhook(request, env) {
  if (request.method !== "POST") {
    return text("Method not allowed", 405, { Allow: "POST" });
  }
  if (!env.STRIPE_WEBHOOK_SECRET) return text("Webhook is not configured", 503);

  const stripe = stripeClient(env);
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      request.headers.get("stripe-signature"),
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (error) {
    console.error("stripe_webhook_signature_failed", error.message);
    return text("Invalid signature", 400);
  }

  const session = event.data.object;
  if (!event.livemode || session.metadata?.order_source !== "spnvisualz_store") {
    return json({ received: true, ignored: true });
  }
  try {
    if (event.type === "checkout.session.completed") {
      await stripe.checkout.sessions.update(session.id, {
        metadata: {
          order_status: session.payment_status === "paid" ? "paid_ready" : "processing"
        }
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
    return text("Webhook processing failed", 500);
  }

  return json({ received: true });
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/api/create-checkout-session") return createCheckout(request, env);
    if (pathname === "/api/checkout-session") return retrieveCheckout(request, env);
    if (pathname === "/api/stripe-webhook") return receiveWebhook(request, env);
    return env.ASSETS.fetch(request);
  }
};
