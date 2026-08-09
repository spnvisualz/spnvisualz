(() => {
  "use strict";

  /*
   * SPNVISUALZ measurement and monetization configuration.
   * GA4 and AdSense ownership IDs are active below.
   * Content ad units still require valid slot IDs, advertising consent, and certified CMP activation.
   */
  window.SPN_CONFIG = Object.freeze({
    ga4: {
      measurementId: "G-QYJX274KM5"
    },
    adsense: {
      publisherId: "ca-pub-6262494647963659",
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