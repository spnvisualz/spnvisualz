import {
  STORE_INTEGRATION_ID,
  cartDescription,
  idempotencyKeyFor,
  lineItemsFor,
  parseCart,
  publicSiteUrl,
  stripeClient
} from "../server/store.js";

function send(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(data));
}

async function bodyFrom(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || "{}");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed." });
  }

  try {
    const cart = parseCart(await bodyFrom(req));
    const stripe = stripeClient();
    const siteUrl = publicSiteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      origin_context: "web",
      integration_identifier: STORE_INTEGRATION_ID,
      line_items: lineItemsFor(cart),
      return_url: `${siteUrl}/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,
      redirect_on_completion: "always",
      customer_creation: "always",
      billing_address_collection: "auto",
      name_collection: {
        individual: { enabled: true, optional: false },
        business: { enabled: true, optional: true }
      },
      phone_number_collection: { enabled: true },
      automatic_tax: { enabled: false },
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
        font_family: "inter",
        logo: { type: "url", url: `${siteUrl}/assets/favicon-512.png` }
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
      // Deliberately omit payment_method_types so Stripe can choose the
      // most relevant enabled methods for each customer dynamically.
    }, { idempotencyKey: idempotencyKeyFor(cart) });

    if (!session.client_secret) throw new Error("Stripe did not return a checkout client secret.");
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) throw new Error("Stripe publishable key is not configured.");
    return send(res, 200, { clientSecret: session.client_secret, publishableKey });
  } catch (error) {
    console.error("checkout_session_create_failed", error);
    const safeMessage = error?.type ? "Stripe could not start checkout. Please try again." : error.message;
    return send(res, 400, { error: safeMessage || "Checkout could not be started." });
  }
}

