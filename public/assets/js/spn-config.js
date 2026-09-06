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
    consent: {
      version: "2026-09-06",
      storageKey: "spn_privacy_choices",
      useBuiltInBanner: true
    },
    debug: false
  });
})();
