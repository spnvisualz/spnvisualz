# SPNVISUALZ store deployment

The storefront uses a static Vite frontend plus three serverless endpoints:

- `POST /api/create-checkout-session` validates the basket against the server-side Price allowlist and creates an embedded Stripe Checkout Session.
- `GET /api/checkout-session` verifies an order before the thank-you page displays it as paid.
- `POST /api/stripe-webhook` verifies Stripe signatures and records the order state in Checkout Session metadata.

## Hosting

Deploy the repository as one Cloudflare Worker with static assets so the portfolio, basket, Checkout iframe, API, and confirmation page all remain on `spnvisualz.com`. The Worker entry point is `worker/index.js`; `wrangler.jsonc` serves `dist/` as static assets and runs the Worker only for `/api/*`.

Use `npm run deploy:cloudflare` for a manual deployment or connect the GitHub repository in Cloudflare for automatic deployments. Create and verify the Cloudflare preview deployment before changing DNS. Keep GitHub Pages live until both the static site and the three API routes pass their launch checks.

`npm run build:cloudflare` also enforces the Free-plan asset limits: no more than 20,000 static files and no individual file larger than 25 MB. Adding future Selected Work projects is safe as long as that check keeps passing. Static asset requests are free; only `/api/*` requests consume the Workers daily request allowance.

After the preview is verified, attach both `spnvisualz.com` and `www.spnvisualz.com` to the Worker, make the apex domain canonical, and only then remove the old GitHub Pages DNS records. This ordering avoids downtime.

## Environment variables

Set these as Cloudflare Worker secrets/variables without committing their values:

- `STRIPE_RESTRICTED_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PUBLIC_SITE_URL=https://spnvisualz.com`

Create the three Stripe values with `wrangler secret put`. Set `PUBLIC_SITE_URL` as a non-secret variable in the Cloudflare dashboard or deployment configuration.

The restricted key needs Checkout Sessions read/write permission. It also needs permission to read the related line items and update Checkout Session metadata because the verified webhook marks paid, processing, or failed orders. This production project rejects sandbox credentials. Validate the temporary Workers URL with the live account, without submitting a payment unless separately authorized. During temporary-URL verification, set `PUBLIC_SITE_URL` to that exact Workers URL; restore `https://spnvisualz.com` for domain launch.

## Stripe webhook

Create an event destination at:

`https://spnvisualz.com/api/stripe-webhook`

Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

Copy the destination signing secret into `STRIPE_WEBHOOK_SECRET`. Do not reuse a webhook secret from another endpoint or environment.

## Launch checks

1. Add two different services and Express delivery to the basket.
2. Change quantities and verify every line and the total.
3. Create a live embedded session without submitting payment; check the iframe and the unpaid thank-you state. An actual charge requires separate authorization.
4. Confirm the cart clears only after a paid order.
5. Confirm the Checkout Session metadata contains `order_status=paid_ready`.
6. Verify the webhook rejects unsigned payloads and handles signed paid/processing/failed states using local fixtures. Confirm the live event destination is reachable before launch.
7. Test desktop and mobile layouts before moving production traffic to the Cloudflare Worker.

Keep the Namecheap nameservers and GitHub Pages DNS records unchanged until the Worker URL passes these checks. When changing nameservers, use `bill.ns.cloudflare.com` and `raphaela.ns.cloudflare.com`. Preserve the copied Private Email MX records, SPF, Google verification TXT, and all other existing email records. Once the zone is active, attach the apex and www custom domains and verify TLS and mail DNS before retiring GitHub Pages routing.

## Verified live API compatibility

On 2026-09-30, the connected live Stripe account accepted a multi-service embedded session (2 × Logo Basic, 1 × Loop Basic, Express; EUR 128.00). No payment was submitted. All 13 server-side Price IDs matched active EUR live prices. Stripe Tax has no registrations; automatic tax remains disabled. Adaptive Pricing is explicitly disabled to preserve EUR totals.

Embedded Checkout rejects `branding_settings.logo`; omit that field. Load `https://js.stripe.com/dahlia/stripe.js` and mount with `stripe.createEmbeddedCheckoutPage({ fetchClientSecret })`. Live order IDs use `cs_live_`; verification must accept that prefix.

Deployment is still incomplete: the Work cloud session exposes no Cloudflare plugin tools, and Cloudflare Dashboard blocks its browser at security verification. The Stripe connector exposes no API-key provisioning or secure key-export operation. No live webhook endpoint exists yet. The registrar nameservers remain Namecheap's; public DNS still points to GitHub Pages and preserves Private Email MX/SPF plus Google verification. The homepage returns 200, but `/checkout.html` and `/api/create-checkout-session` return 404. Do not change registrar nameservers until a deployed temporary Worker URL and its live embedded flow have been verified.

Do not enable Stripe Tax until the business has active tax registrations in Stripe.
