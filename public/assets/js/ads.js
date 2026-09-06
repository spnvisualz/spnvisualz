(() => {
  "use strict";

  /*
   * Manual AdSense placement for substantial Visual Lab articles only.
   *
   * Hard rules enforced here:
   *  - No Auto Ads. Only explicitly marked [data-ad-slot-key] containers.
   *  - The AdSense library is never requested until an ad is actually
   *    eligible to render. Loading it "just in case" on pages with no ad
   *    units is what an unconditional <script> tag used to do, and it
   *    both bypassed consent and put ad code on pages that must stay
   *    ad-free.
   *  - An ad requires ALL of: a valid ca-pub publisher ID, a valid
   *    numeric slot ID, and advertising consent from a Google-certified
   *    CMP. Missing any one of them renders nothing.
   *  - A container with no rendered ad is collapsed to zero height and
   *    hidden from assistive tech, so no empty "reserved" box is ever
   *    visible to a visitor or a policy reviewer.
   */

  const config = window.SPN_CONFIG?.adsense || {};

  const rawPublisherId = String(config.publisherId || "").trim();
  const validPublisher =
    /^(ca-)?pub-\d{10,20}$/i.test(rawPublisherId) &&
    !/ADSENSE_PUBLISHER_ID/i.test(rawPublisherId);
  const publisherId = rawPublisherId.startsWith("ca-") ? rawPublisherId : `ca-${rawPublisherId}`;

  // A slot is only usable if it is purely numeric. This rejects empty
  // strings and any leftover placeholder token outright.
  const slotValue = (key) => String(config.slots?.[key] || "").trim();
  const validSlot = (value) => /^\d{5,20}$/.test(value);

  // Advertising consent is only trusted when it came from a certified CMP.
  // The site's built-in banner handles analytics only and never grants
  // advertising, so this stays false until a certified CMP is deployed.
  const cmpReady = () => config.certifiedCmpReady === true;
  const consentAllowsAds = () => window.SPNConsent?.get().advertising === true;
  const canServe = () => validPublisher && cmpReady() && consentAllowsAds();

  const containers = () => document.querySelectorAll("[data-ad-slot-key]");

  // Collapse: no layout footprint, no announcement, nothing to see.
  const collapse = (container) => {
    container.dataset.adState = "unavailable";
    container.hidden = true;
    container.setAttribute("aria-hidden", "true");
  };

  const renderSlot = (container) => {
    const slot = slotValue(container.dataset.adSlotKey);
    if (!canServe() || !validSlot(slot)) {
      collapse(container);
      return;
    }
    if (container.dataset.adRendered === "true") return;

    container.hidden = false;
    container.removeAttribute("aria-hidden");
    container.dataset.adRendered = "true";

    const ad = document.createElement("ins");
    ad.className = "adsbygoogle";
    ad.style.display = "block";
    ad.dataset.adClient = publisherId;
    ad.dataset.adSlot = slot;
    ad.dataset.adFormat = container.dataset.adFormat || "auto";
    ad.dataset.fullWidthResponsive = "true";
    container.append(ad);

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      container.dataset.adState = "loaded";
    } catch (_) {
      ad.remove();
      container.dataset.adRendered = "false";
      collapse(container);
    }
  };

  let scriptRequested = false;

  const loadAdSense = () => {
    if (scriptRequested || !canServe()) return;
    // Only load the library if this page actually has a container with a
    // real slot behind it.
    const usable = [...containers()].some((c) => validSlot(slotValue(c.dataset.adSlotKey)));
    if (!usable) return;

    scriptRequested = true;
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
    script.dataset.spnAdsense = "true";
    script.addEventListener("load", () => containers().forEach(renderSlot), { once: true });
    document.head.append(script);
  };

  const reflectState = () => {
    const list = containers();
    if (!list.length) return;

    if (!canServe()) {
      list.forEach((container) => {
        // Consent may have been withdrawn after an ad was rendered.
        container.querySelector(".adsbygoogle")?.remove();
        container.dataset.adRendered = "false";
        collapse(container);
      });
      return;
    }

    if (scriptRequested) list.forEach(renderSlot);
    else {
      list.forEach((container) => {
        if (!validSlot(slotValue(container.dataset.adSlotKey))) collapse(container);
      });
      loadAdSense();
    }
  };

  window.SPNAds = Object.freeze({
    isConfigured: () => validPublisher,
    isEligible: canServe,
    refresh: reflectState
  });

  window.addEventListener("spn:consent", reflectState);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", reflectState, { once: true });
  } else {
    reflectState();
  }
})();
