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

The restricted key needs Checkout Sessions read/write permission. It also needs permission to read the related line items and update Checkout Session metadata because the verified webhook marks paid, processing, or failed orders. Use a separate sandbox key set for Preview deployments.

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
3. Complete a sandbox payment and confirm the thank-you page shows the verified order.
4. Confirm the cart clears only after a paid order.
5. Confirm the Checkout Session metadata contains `order_status=paid_ready`.
6. Repeat with an asynchronous sandbox method and verify success and failure events.
7. Test desktop and mobile layouts before pointing the production domain at Vercel.

Do not enable Stripe Tax until the business has active tax registrations in Stripe.
