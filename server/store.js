import Stripe from "stripe";

export const STORE_CURRENCY = "eur";
export const STORE_SITE_URL = "https://spnvisualz.com";
export const STORE_INTEGRATION_ID = "spn_store_yqnhvmtp";

// This server-side allowlist is the source of truth for what can be charged.
// The browser only sends SKUs and quantities; it can never choose a Price ID
// or amount. Prices remain safe even if someone edits requests in DevTools.
export const STORE_CATALOG = Object.freeze({
  "logo-basic":       { price: "price_1UKlwnAhjDLOnNqK3vuuXpFX", unitAmount: 2200,  label: "Logo design — Basic" },
  "logo-premium":     { price: "price_1UKlwjAhjDLOnNqKlXKhFmAm", unitAmount: 5500,  label: "Logo design — Premium" },
  "animated-logo":    { price: "price_1UKlwsAhjDLOnNqKVt1uodTh", unitAmount: 3500,  label: "Animated logo" },
  "intro-standard":   { price: "price_1UKlwwAhjDLOnNqK8lK01eRu", unitAmount: 3200,  label: "Intro visual — Standard" },
  "intro-premium":    { price: "price_1UKlx1AhjDLOnNqK0TLHa4Bg", unitAmount: 6800,  label: "Intro visual — Premium" },
  "loop-basic":       { price: "price_1UKlx5AhjDLOnNqKp1rtdZLO", unitAmount: 4400,  label: "Motion loop — Basic" },
  "loop-premium":     { price: "price_1UKlx9AhjDLOnNqKdjROFC4G", unitAmount: 9000,  label: "Motion loop — Premium" },
  "visuals-social":   { price: "price_1UKlxFAhjDLOnNqKJt74mgh7", unitAmount: 3400,  label: "Visuals — Social" },
  "visuals-brand":    { price: "price_1UKlxJAhjDLOnNqKOX4jWNtY", unitAmount: 7200,  label: "Visuals — Brand" },
  "bundle-starter":   { price: "price_1UJcsVAhjDLOnNqKk2vMvEDb", unitAmount: 16800, label: "Starter bundle" },
  "bundle-creator":   { price: "price_1UJcsVAhjDLOnNqKX286VOoJ", unitAmount: 24000, label: "Creator bundle" },
  "bundle-business":  { price: "price_1UJcsWAhjDLOnNqKiRpEGpjO", unitAmount: 33600, label: "Business bundle" }
});

export const EXPRESS_DELIVERY = Object.freeze({
  price: "price_1UJcsTAhjDLOnNqKeWEv1jA4",
  label: "Express delivery — 24–48 hours",
  unitAmount: 4000
});

export function stripeClient() {
  const apiKey = process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error("Stripe server key is not configured.");
  return new Stripe(apiKey, { apiVersion: "2026-08-26.dahlia" });
}

export function publicSiteUrl() {
  const configured = process.env.PUBLIC_SITE_URL?.trim();
  return (configured || STORE_SITE_URL).replace(/\/$/, "");
}

export function parseCart(input) {
  if (!input || !Array.isArray(input.items)) throw new Error("Your basket is empty.");
  if (input.items.length > 20) throw new Error("This basket contains too many lines.");

  const quantities = new Map();
  for (const raw of input.items) {
    const sku = typeof raw?.sku === "string" ? raw.sku : "";
    const quantity = Number(raw?.quantity);
    if (!STORE_CATALOG[sku]) throw new Error("One of the selected services is unavailable.");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new Error("Service quantities must be between 1 and 10.");
    }
    const next = (quantities.get(sku) || 0) + quantity;
    if (next > 10) throw new Error("A service quantity cannot exceed 10.");
    quantities.set(sku, next);
  }

  if (quantities.size === 0) throw new Error("Your basket is empty.");

  const items = [...quantities].map(([sku, quantity]) => ({ sku, quantity }));
  const express = input.express === true;
  const cartId = typeof input.cartId === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(input.cartId)
    ? input.cartId
    : "guest";
  const revision = Number.isInteger(input.revision) && input.revision >= 0 ? input.revision : 0;
  return { items, express, cartId, revision };
}

export function lineItemsFor(cart) {
  const lines = cart.items.map(({ sku, quantity }) => ({
    price: STORE_CATALOG[sku].price,
    quantity
  }));
  if (cart.express) lines.push({ price: EXPRESS_DELIVERY.price, quantity: 1 });
  return lines;
}

export function cartDescription(cart) {
  const parts = cart.items.map(({ sku, quantity }) => `${sku}:${quantity}`);
  if (cart.express) parts.push("express-delivery:1");
  return parts.join(",").slice(0, 480);
}

export function idempotencyKeyFor(cart) {
  return `spn_checkout_${cart.cartId}_${cart.revision}`.slice(0, 255);
}
