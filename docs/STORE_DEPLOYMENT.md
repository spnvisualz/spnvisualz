# SPNVISUALZ store deployment

The storefront uses a static Vite frontend plus three serverless endpoints:

- `POST /api/create-checkout-session` validates the basket against the server-side Price allowlist and creates an embedded Stripe Checkout Session.
- `GET /api/checkout-session` verifies an order before the thank-you page displays it as paid.
- `POST /api/stripe-webhook` verifies Stripe signatures and records the order state in Checkout Session metadata.

## Hosting

As verified on 2026-11-02 from the CI runner (`verify-production` job):

- `spnvisualz.com` uses Cloudflare nameservers (`bill.ns.cloudflare.com`, `raphaela.ns.cloudflare.com`) and is proxied by Cloudflare.
- The static site (portfolio, basket, `checkout.html`, `thank-you.html`) is built by `.github/workflows/deploy.yml` and served by GitHub Pages behind that proxy.
- Only `/api/*` runs the Cloudflare Worker `spnvisualz` (`worker/index.js`). The routes are declared in `wrangler.jsonc` (`spnvisualz.com/api/*` and `www.spnvisualz.com/api/*`). `wrangler deploy` replaces the Worker's routes with exactly that list, so add any new route there rather than in the dashboard.
- Every deploy run checks that `GET /api/checkout-session` gets the Worker's JSON `400`; a `404` from GitHub Pages fails the run because the basket could not open Checkout.

Deploy the Worker with `npm run deploy:cloudflare` (manual), or let CI do it: create a Cloudflare API token from the "Edit Cloudflare Workers" template (this account, zone `spnvisualz.com`) and add it as the GitHub repository secret `CLOUDFLARE_API_TOKEN`. The `deploy-worker` job then redeploys on every push to `main` after lint and tests pass; without the secret it skips with a notice.

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

## Verified live API compatibility

On 2026-09-30, the connected live Stripe account accepted a multi-service embedded session (2 × Logo Basic, 1 × Loop Basic, Express; EUR 128.00). No payment was submitted. All 13 server-side Price IDs matched active EUR live prices. Stripe Tax has no registrations; automatic tax remains disabled. Adaptive Pricing is explicitly disabled to preserve EUR totals.

Embedded Checkout rejects `branding_settings.logo`; omit that field. Load `https://js.stripe.com/dahlia/stripe.js` and mount with `stripe.createEmbeddedCheckoutPage({ fetchClientSecret })`. Live order IDs use `cs_live_`; verification must accept that prefix.

Do not enable Stripe Tax until the business has active tax registrations in Stripe.
