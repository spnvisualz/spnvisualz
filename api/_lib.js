/*
 * Shared server helpers.
 *
 * Written against Web standards — Request, Response, fetch, WebCrypto —
 * rather than a Node-specific runtime or the Stripe SDK, so the same file
 * runs unchanged on Vercel, Netlify Edge and Cloudflare Workers. That
 * matters here because which of those this lands on is still open, and a
 * handler written for one of them would have to be rewritten for another.
 *
 * Stripe is called over its REST API with form encoding, which is what
 * the SDK does underneath anyway.
 */

import catalogue from "./_catalogue.json" with { type: "json" };

export { catalogue };

export const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }
  });

export const bad = (message, status = 400) => json({ error: message }, status);

// The secret key is read from the environment at call time and never
// returned, logged or echoed. Nothing in this repo contains it.
export function secret(env) {
  const key = env?.STRIPE_SECRET_KEY || (typeof process !== "undefined" ? process.env?.STRIPE_SECRET_KEY : null);
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return key;
}

export const isLiveKey = (key) => key.startsWith("sk_live_");

// Stripe wants form-encoded bodies with bracketed paths for nesting.
export function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const path = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((entry, i) => form({ [i]: entry }, path, out));
    else if (typeof v === "object") form(v, path, out);
    else out.append(path, String(v));
  }
  return out;
}

export async function stripe(env, path, { method = "POST", body, idempotencyKey } = {}) {
  const headers = {
    authorization: `Bearer ${secret(env)}`,
    "content-type": "application/x-www-form-urlencoded"
  };
  // Stripe deduplicates by this key, so a retried create cannot produce a
  // second session or a second charge.
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers,
    body: body ? form(body).toString() : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Stripe's message is safe to surface; the key never appears in it.
    const err = new Error(data?.error?.message || `Stripe ${res.status}`);
    err.status = res.status;
    err.type = data?.error?.type;
    throw err;
  }
  return data;
}

/*
 * Webhook signature verification, by hand.
 *
 * This is the only thing standing between "Stripe told us this was paid"
 * and "anyone who can POST to this URL can mark an order paid". It
 * recomputes the HMAC over `timestamp.payload` exactly as Stripe does,
 * compares in constant time, and rejects anything older than the
 * tolerance so a captured request cannot be replayed later.
 */
export async function verifyStripeSignature(rawBody, header, signingSecret, toleranceSeconds = 300) {
  if (!header || !signingSecret) return false;

  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=").map((s) => s.trim()))
  );
  const timestamp = Number(parts.t);
  const provided = parts.v1;
  if (!Number.isFinite(timestamp) || !provided) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > toleranceSeconds) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(signingSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${rawBody}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  return timingSafeEqual(expected, provided);
}

// Comparing with === leaks how much of the signature matched through how
// long the comparison took. This does not.
export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// A short, human-quotable reference. Not a secret and not a lookup key —
// Stripe's session id remains the identity of the order.
export function orderRef(sessionId) {
  let h = 0;
  for (let i = 0; i < sessionId.length; i++) h = (h * 31 + sessionId.charCodeAt(i)) >>> 0;
  return "SPN-" + h.toString(36).toUpperCase().padStart(6, "0").slice(-6);
}

export const allowedOrigin = (env) =>
  env?.SITE_ORIGIN || (typeof process !== "undefined" ? process.env?.SITE_ORIGIN : null) || "https://spnvisualz.com";

export function cors(env, req) {
  const origin = req.headers.get("origin");
  const allow = allowedOrigin(env);
  // Same-origin deployments send no Origin header at all; only echo one
  // back when it is the site we expect.
  return origin === allow ? { "access-control-allow-origin": allow, vary: "Origin" } : {};
}
