(() => {
  "use strict";

  /*
   * SPNVISUALZ measurement and monetization configuration.
   * Replace only the placeholder values after creating the matching Google accounts.
   * No Google script loads while a placeholder remains in place.
   */
  window.SPN_CONFIG = Object.freeze({
    ga4: {
      measurementId: "GA_MEASUREMENT_ID"
    },
    adsense: {
      publisherId: "ADSENSE_PUBLISHER_ID",
      certifiedCmpReady: false,
      slots: {
        visualLabInline: "ADSENSE_SLOT_ID",
        visualLabBottom: "ADSENSE_SLOT_ID"
      }
    },
    consent: {
      version: "2026-08-09",
      storageKey: "spn_privacy_choices",
      useBuiltInBanner: true
    },
    debug: false
  });
})();