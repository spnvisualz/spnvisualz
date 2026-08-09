(() => {
  "use strict";

  const config = window.SPN_CONFIG?.adsense || {};
  const rawPublisherId = String(config.publisherId || "").trim();
  const validPublisher = /^(ca-)?pub-\d{10,20}$/i.test(rawPublisherId) && rawPublisherId !== "ADSENSE_PUBLISHER_ID";
  const publisherId = rawPublisherId.startsWith("ca-") ? rawPublisherId : `ca-${rawPublisherId}`;
  let scriptRequested = false;

  const consentAllowsAds = () => window.SPNConsent?.get().advertising === true;
  const canServe = () => validPublisher && config.certifiedCmpReady === true && consentAllowsAds();

  const slotValue = (key) => String(config.slots?.[key] || "").trim();
  const validSlot = (value) => /^\d{5,20}$/.test(value) && value !== "ADSENSE_SLOT_ID";

  const renderSlots = () => {
    document.querySelectorAll("[data-ad-slot-key]").forEach(container => {
      const key = container.dataset.adSlotKey;
      const slot = slotValue(key);
      if (!canServe() || !validSlot(slot) || container.dataset.adRendered === "true") return;

      container.dataset.adRendered = "true";
      const placeholder = container.querySelector(".spn-ad-reserve__fallback");

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
        if (placeholder) placeholder.hidden = true;
      } catch (_) {
        ad.remove();
        container.dataset.adRendered = "false";
        container.dataset.adState = "reserved";
        if (placeholder) placeholder.hidden = false;
      }
    });
  };

  const loadAdSense = () => {
    if (scriptRequested || !canServe() || !document.querySelector("[data-ad-slot-key]")) return;
    scriptRequested = true;
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
    script.dataset.spnAdsense = "true";
    script.addEventListener("load", renderSlots, { once: true });
    document.head.append(script);
  };

  const reflectState = () => {
    const eligible = canServe();
    document.querySelectorAll("[data-ad-slot-key]").forEach(container => {
      if (!eligible && container.dataset.adRendered === "true") {
        container.querySelector(".adsbygoogle")?.remove();
        container.dataset.adRendered = "false";
        const fallback = container.querySelector(".spn-ad-reserve__fallback");
        if (fallback) fallback.hidden = false;
      }
      container.dataset.adState = eligible ? "eligible" : "reserved";
    });
    if (eligible && scriptRequested) renderSlots();
    else loadAdSense();
  };

  window.SPNAds = Object.freeze({
    isConfigured: () => validPublisher,
    isEligible: canServe,
    refresh: reflectState
  });

  window.addEventListener("spn:consent", reflectState);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", reflectState, { once: true });
  else reflectState();
})();