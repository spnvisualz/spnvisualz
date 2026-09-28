(() => {
  "use strict";

  /*
   * SPNVISUALZ measurement and monetization configuration.
   *
   * GA4 is active. Advertising is NOT active: no ad unit will ever be
   * requested or rendered until all three of the following are true —
   *
   *   1. `publisherId` is a real ca-pub-* value (it is),
   *   2. the relevant `slots` entry is a real numeric AdSense slot ID
   *      created in the AdSense dashboard (they are empty below),
   *   3. `certifiedCmpReady` is true, meaning a Google-certified CMP is
   *      deployed and supplying consent state.
   *
   * Empty slot values are deliberate. The previous "ADSENSE_SLOT_ID"
   * placeholders were production-visible dummy values; ads.js treats any
   * non-numeric slot as unconfigured and renders nothing at all.
   *
   * Auto Ads are not used anywhere on this site. Advertising support is
   * limited to manually placed units inside substantial Visual Lab
   * articles.
   */
  window.SPN_CONFIG = Object.freeze({
    ga4: {
      measurementId: "G-QYJX274KM5"
    },
    adsense: {
      publisherId: "ca-pub-6262494647963659",
      // Flip to true ONLY after a Google-certified CMP is live on the site.
      // The built-in privacy banner is not certified and must not set this.
      certifiedCmpReady: false,
      // Numeric AdSense slot IDs. Empty = that placement stays disabled.
      // Keys must match the `data-ad-slot-key` attributes in article markup.
      slots: {
        visualLabInline: "",
        visualLabEnd: ""
      }
    },
    /*
     * CHECKOUT
     * =========================================================
     * Paste the hosted checkout URL for each item below and that
     * item becomes buyable on the site. Leave one empty and that
     * button quietly falls back to the old enquiry dialog, so the
     * site is never broken mid-setup — you can switch items over
     * one at a time.
     *
     * These are Stripe Payment Links (buy.stripe.com/...). Create
     * one per item in the Stripe dashboard and paste it here — a
     * Payment Link needs no key on this page and no server, which
     * is what makes it work on a site that is static files.
     *
     * Stripe rather than a merchant-of-record because Lemon Squeezy
     * and Paddle both prohibit design services and web development.
     * VAT/MVA remains the studio's responsibility. Only enable Stripe
     * Tax after the business has an active registration in Stripe for
     * each jurisdiction where tax must be collected.
     *
     * Worth setting on each link in the dashboard:
     *   - the success URL below, so paying lands on the right page
     *   - custom fields for the brief (brand/artist name, what you
     *     need, deadline) — that is what replaces the old form
     *   - Express delivery (+€40) as an optional add-on, so it does
     *     not need a second set of links
     *
     * `price` is what the site shows. It is repeated here so a
     * test can catch the day the page and the provider disagree —
     * change a price in your provider dashboard and the build
     * tells you which page still says the old number.
     */
    checkout: {
      // Shown on the success page and in the checkout window title.
      brand: "SPNVISUALZ",
      // Where the provider should send the customer after paying.
      // Set this as the redirect/thank-you URL in the dashboard too.
      successUrl: "https://spnvisualz.com/thank-you.html",
      items: {
        // --- single services, one-off -----------------------------
        "logo-basic":        { price: 22,   label: "Logo design — Basic",        url: "https://book.stripe.com/8x28wO3GN6Mh3PB39T0oM0k" },
        "logo-premium":      { price: 55,   label: "Logo design — Premium",      url: "https://book.stripe.com/5kQ9AS6SZ1rX0Dph0J0oM0j" },
        "animated-logo":     { price: 35,   label: "Animated logo",              url: "https://book.stripe.com/fZubJ02CJ4E9dqb7q90oM0l" },
        "intro-standard":    { price: 32,   label: "Intro visual — Standard",    url: "https://book.stripe.com/cNi28qb9feeJ4TFeSB0oM0m" },
        "intro-premium":     { price: 68,   label: "Intro visual — Premium",     url: "https://book.stripe.com/3cI3cu1yF9Ytcm711L0oM0o" },
        "loop-basic":        { price: 44,   label: "Motion loop — Basic",        url: "https://book.stripe.com/bJe8wO7X35Id2LxcKt0oM0q" },
        "loop-premium":      { price: 90,   label: "Motion loop — Premium",      url: "https://book.stripe.com/8x24gydhnc6BgCn8ud0oM0r" },
        "visuals-social":    { price: 34,   label: "Visuals — Social",           url: "https://book.stripe.com/4gMfZgelrgmR2Lxh0J0oM0n" },
        "visuals-brand":     { price: 72,   label: "Visuals — Brand",            url: "https://book.stripe.com/cNiaEWcdjgmR2Lx8ud0oM0p" },

        // --- bundles, one-off -------------------------------------
        "bundle-starter":    { price: 168,  label: "Starter bundle",             url: "https://book.stripe.com/4gMeVcfpvfiN1Ht11L0oM06" },
        "bundle-creator":    { price: 240,  label: "Creator bundle",             url: "https://book.stripe.com/cNicN44KR8Upbi339T0oM0a" },
        "bundle-business":   { price: 336,  label: "Business bundle",            url: "https://book.stripe.com/fZucN4fpv9Yt71NbGp0oM07" },

        // --- custom work ------------------------------------------
        // Custom projects stay enquiry-first. After the scope is agreed,
        // the studio sends a Stripe deposit invoice, then invoices the
        // remaining balance after delivery. Keep this URL empty so the
        // site opens the project brief instead of an instant checkout.
        "deposit-custom":    { price: 50,   label: "Custom project — invoice deposit", url: "" },
        "deposit-website":   { price: 50,   label: "Custom website — booking fee", url: "" },

        // --- website packages, recurring --------------------------
        "web-basic-monthly":     { price: 45,   label: "Website Basic — monthly",     url: "", recurring: "month" },
        "web-basic-yearly":      { price: 449,  label: "Website Basic — yearly",      url: "", recurring: "year" },
        "web-premium-monthly":   { price: 79,   label: "Website Premium — monthly",   url: "", recurring: "month" },
        "web-premium-yearly":    { price: 799,  label: "Website Premium — yearly",    url: "", recurring: "year" },
        "web-exclusive-monthly": { price: 129,  label: "Website Exclusive — monthly", url: "", recurring: "month" },
        "web-exclusive-yearly":  { price: 1299, label: "Website Exclusive — yearly",  url: "", recurring: "year" },
        "care-monthly":          { price: 25,   label: "SPNVISUALZ Care — monthly",   url: "", recurring: "month" },
        "care-yearly":           { price: 249,  label: "SPNVISUALZ Care — yearly",    url: "", recurring: "year" }
      }
    },

    consent: {
      version: "2026-09-06",
      storageKey: "spn_privacy_choices",
      useBuiltInBanner: true
    },
    debug: false
  });
})();
