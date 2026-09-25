(() => {
  "use strict";

  /*
   * SPNVISUALZ checkout.
   *
   * The site is static — it is built to files and served by GitHub Pages,
   * with nothing running on a server. That is not a limitation to work
   * around here, it is the correct shape: taking a card number on your own
   * page means handling card data, and a static site cannot hold a secret
   * key to do it safely. So the card step belongs to the payment provider,
   * and this file's whole job is to get the visitor there with the right
   * item selected, in as few clicks as the provider allows.
   *
   * Stripe, because Stripe is what a service studio can actually use.
   * The merchant-of-record options that would have handled VAT for us —
   * Lemon Squeezy, Paddle — prohibit design services and web development
   * in their acceptable-use policies. A store there would have been
   * approved and then closed. So VAT is the studio's own to handle, and
   * this file's job is narrower: get the visitor to a Stripe checkout with
   * the right item selected.
   *
   * Payment Links are the mechanism. They are a plain URL per item, need
   * no key on the page and no server to mint a session — which is the
   * whole reason they work on a site that is static files on GitHub Pages.
   * Stripe's other checkout modes need a secret key server-side to create
   * a Checkout Session, and there is no server here to hold one.
   *
   * Nothing below is Stripe-specific beyond the client_reference_id
   * parameter, so a different provider is a different set of URLs.
   */

  const cfg = () => (window.SPN_CONFIG && window.SPN_CONFIG.checkout) || null;
  const items = () => (cfg() && cfg().items) || {};

  const item = (sku) => items()[sku] || null;
  const urlFor = (sku) => {
    const entry = item(sku);
    const url = entry && typeof entry.url === "string" ? entry.url.trim() : "";
    return url || null;
  };
  const isConfigured = (sku) => Boolean(urlFor(sku));
  // True once any item has a URL. Local rather than read off the global,
  // so nothing here depends on its own export already existing.
  const anyConfigured = () => Object.keys(items()).some(isConfigured);

  // Everything the studio needs in order to start the job, carried on the
  // URL so the provider can prefill or record it. Nothing here is sensitive
  // and nothing is invented: it is the item, and where the click came from.
  const decorate = (url, sku) => {
    try {
      const u = new URL(url, location.href);
      // Stripe echoes client_reference_id back on the payment, so the
      // dashboard row says which item and which page produced it without
      // anything having to be reconciled by hand.
      u.searchParams.set("client_reference_id", sku);
      return u.href;
    } catch (_) {
      return url;
    }
  };

  const track = (sku) => {
    const entry = item(sku);
    if (typeof window.gtag !== "function" || !entry) return;
    try {
      window.gtag("event", "begin_checkout", {
        currency: "EUR",
        value: entry.price,
        items: [{ item_id: sku, item_name: entry.label, price: entry.price }]
      });
    } catch (_) {}
  };

  const open = (sku) => {
    const url = urlFor(sku);
    if (!url) return false;
    track(sku);
    // A full navigation rather than a new tab: a payment opened in a
    // background tab is a payment people lose track of, and Stripe returns
    // them to the success page itself when it is done.
    location.href = decorate(url, sku);
    return true;
  };

  /*
   * One capture-phase listener on the document, rather than a listener per
   * button. Both of the things that bit here are ordering problems, and
   * delegation removes the ordering entirely:
   *
   *   - websites/app.js sets data-buy on the plan buttons when the billing
   *     toggle is first applied, which happens after this script has run.
   *     A scan at load time saw no data-buy on them at all, so the plan
   *     buttons stayed unbound and went to the homepage instead of Stripe.
   *
   *   - the enquiry dialog attaches its own listener to the very same
   *     elements, because they keep data-order as their fallback. Capture
   *     runs before any listener on the target, so stopping here stops
   *     that one too — whatever order the two scripts loaded in.
   *
   * The SKU is read from the DOM at click time for the same reason: the
   * website plans change what they sell when the toggle moves.
   */
  const onClick = (event) => {
    const el = event.target.closest?.("[data-buy]");
    if (!el) return;
    const sku = el.dataset.buy;
    // Not switched over yet: return without touching the event, so the
    // element's own fallback — the enquiry dialog, or a plain link —
    // happens exactly as it did before.
    if (!sku || !isConfigured(sku)) return;
    event.preventDefault();
    // stopImmediatePropagation, not stopPropagation: the enquiry dialog
    // binds to this same element, and only the immediate form is
    // guaranteed to stop every other listener on the way down and at the
    // target. Without it a configured item both charges and opens a form.
    event.stopImmediatePropagation();
    open(sku);
  };

  /*
   * Markup that can only be correct once it is known whether an item can
   * be paid for. It has to happen here rather than in the HTML: the page
   * is static and has no idea whether a URL has been pasted in yet.
   *
   *   data-checkout-hide  — a control that only existed to start an
   *                         enquiry, redundant once the thing beside it
   *                         buys itself.
   *   data-checkout-show  — ships hidden; revealed only when its item is
   *                         buyable, so there is never a dead button.
   *   data-checkout-label — copy that was honest as a question ("Ask for
   *                         custom") and wrong as an order.
   */
  const applyLiveState = (root = document) => {
    root.querySelectorAll("[data-checkout-hide]").forEach((el) => {
      if (anyConfigured()) el.hidden = true;
    });
    root.querySelectorAll("[data-checkout-show]").forEach((el) => {
      const sku = el.dataset.buy;
      if (sku && isConfigured(sku)) el.hidden = false;
    });
    root.querySelectorAll("[data-checkout-label]").forEach((el) => {
      const sku = el.dataset.buy;
      if (sku && isConfigured(sku)) el.innerHTML = el.dataset.checkoutLabel;
    });
  };

  document.addEventListener("click", onClick, true);

  window.SPN_CHECKOUT = Object.freeze({
    item,
    urlFor,
    isConfigured,
    open,
    applyLiveState,
    // True once at least one item has a URL — the signal the rest of the
    // site uses to decide whether checkout exists at all yet.
    get live() {
      return anyConfigured();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => applyLiveState(), { once: true });
  } else {
    applyLiveState();
  }
})();
