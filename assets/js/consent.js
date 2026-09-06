(() => {
  "use strict";

  /*
   * Built-in privacy banner — ANALYTICS ONLY.
   *
   * This banner is NOT a Google-certified CMP. It therefore must never
   * grant advertising consent: doing so would mean serving ads on a
   * consent signal Google does not recognise. It previously offered an
   * "Advertising" toggle that flipped ad_storage / ad_user_data /
   * ad_personalization to granted, which is exactly that problem.
   *
   * Advertising consent now has exactly one legitimate source: a
   * Google-certified CMP calling SPNConsent.syncFromCmp(). Until that is
   * deployed, the ad_* signals stay denied for every visitor and ads.js
   * refuses to request or render anything.
   */

  const config = window.SPN_CONFIG?.consent || {};
  const storageKey = config.storageKey || "spn_privacy_choices";
  const consentVersion = config.version || "1";
  const defaults = Object.freeze({ necessary: true, analytics: false, advertising: false });

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };

  // Google Consent Mode v2 must default to denied before any measurement or ad tag loads.
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500
  });
  window.gtag("set", "ads_data_redaction", true);

  // `advertising` is only ever true when a certified CMP supplied it.
  // Any other source (the built-in banner, stored state written before
  // this rule existed, a stray API call) is normalised back to false.
  const normalize = (value = {}, source = "") => ({
    necessary: true,
    analytics: value.analytics === true,
    advertising: value.advertising === true && source === "certified_cmp"
  });

  const readStored = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (!stored || stored.version !== consentVersion) return null;
      // Stored advertising grants are re-validated against their source,
      // so a consent given to the old uncertified banner does not carry
      // over as an advertising grant after this change.
      return normalize(stored, stored.source === "certified_cmp" ? "certified_cmp" : "");
    } catch (_) {
      return null;
    }
  };

  let state = readStored() || { ...defaults };
  let hasDecision = Boolean(readStored());
  let layer = null;
  let lastFocus = null;

  const updateGoogleConsent = (next) => {
    window.gtag("consent", "update", {
      analytics_storage: next.analytics ? "granted" : "denied",
      ad_storage: next.advertising ? "granted" : "denied",
      ad_user_data: next.advertising ? "granted" : "denied",
      ad_personalization: next.advertising ? "granted" : "denied"
    });
  };

  const publish = (source = "stored") => {
    document.documentElement.dataset.analyticsConsent = state.analytics ? "granted" : "denied";
    document.documentElement.dataset.advertisingConsent = state.advertising ? "granted" : "denied";
    updateGoogleConsent(state);
    window.dispatchEvent(new CustomEvent("spn:consent", {
      detail: { ...state, source, hasDecision }
    }));
  };

  const save = (next, source = "banner") => {
    state = normalize(next, source);
    hasDecision = true;
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        ...state,
        version: consentVersion,
        source,
        updatedAt: new Date().toISOString()
      }));
    } catch (_) {}
    publish(source);
    closeLayer();
  };

  const closeLayer = () => {
    if (!layer) return;
    layer.hidden = true;
    document.body.classList.remove("consent-open");
    if (lastFocus instanceof HTMLElement) lastFocus.focus();
  };

  const openLayer = (view = "banner") => {
    if (!layer) return;
    lastFocus = document.activeElement;
    layer.hidden = false;
    layer.dataset.view = view;
    document.body.classList.toggle("consent-open", view === "preferences");
    layer.querySelector("[role=\"dialog\"]")?.setAttribute("aria-modal", String(view === "preferences"));
    const analytics = layer.querySelector("#spnConsentAnalytics");
    if (analytics) analytics.checked = state.analytics;
    requestAnimationFrame(() => {
      const target = layer.querySelector(view === "preferences" ? "#spnConsentSave" : "#spnConsentAccept");
      // preventScroll matters: if this panel is ever unstyled or
      // mispositioned, a plain focus() scrolls the whole document to it.
      // That is exactly how every first-time visitor to the homepage
      // ended up dumped at the bottom of the page.
      target?.focus({ preventScroll: true });
    });
  };

  const createInterface = () => {
    if (layer || config.useBuiltInBanner === false) return;

    layer = document.createElement("div");
    layer.className = "spn-consent";
    layer.id = "spnConsent";
    layer.hidden = true;
    layer.innerHTML = `
      <section class="spn-consent-panel" role="dialog" aria-modal="true" aria-labelledby="spnConsentTitle">
        <span class="spn-consent-signal" aria-hidden="true"></span>
        <div class="spn-consent-banner">
          <div>
            <p class="spn-consent-kicker">SPNVISUALZ / PRIVACY</p>
            <h2 id="spnConsentTitle">Your visit. Your choice.</h2>
            <p>We use optional analytics to understand what visitors value. No advertising or ad-personalisation cookies are used on this site.</p>
          </div>
          <div class="spn-consent-actions">
            <button type="button" class="spn-consent-primary" id="spnConsentAccept">Accept all</button>
            <button type="button" id="spnConsentNecessary">Necessary only</button>
            <button type="button" id="spnConsentManage">Manage choices</button>
          </div>
        </div>

        <div class="spn-consent-preferences">
          <header>
            <div><p class="spn-consent-kicker">PRIVACY CONTROL</p><h2>Choose what can run.</h2></div>
            <button type="button" class="spn-consent-close" id="spnConsentClose" aria-label="Close privacy choices"><i></i></button>
          </header>
          <div class="spn-consent-options">
            <label>
              <span><strong>Necessary</strong><small>Site operation and remembering your privacy choice.</small></span>
              <input type="checkbox" checked disabled><i aria-hidden="true"></i>
            </label>
            <label>
              <span><strong>Analytics</strong><small>Anonymous traffic and interaction measurement through GA4 after activation.</small></span>
              <input type="checkbox" id="spnConsentAnalytics"><i aria-hidden="true"></i>
            </label>
          </div>
          <p class="spn-consent-note">You can change this later from “Privacy settings” in the footer. Read the <a href="/privacy/">privacy notice</a>.</p>
          <div class="spn-consent-actions">
            <button type="button" class="spn-consent-primary" id="spnConsentSave">Save choices</button>
            <button type="button" id="spnConsentAcceptPreferences">Accept all</button>
          </div>
        </div>
      </section>
    `;

    document.body.append(layer);

    layer.querySelector("#spnConsentAccept")?.addEventListener("click", () => save({ analytics: true }, "accept_all"));
    layer.querySelector("#spnConsentAcceptPreferences")?.addEventListener("click", () => save({ analytics: true }, "accept_all"));
    layer.querySelector("#spnConsentNecessary")?.addEventListener("click", () => save(defaults, "necessary_only"));
    layer.querySelector("#spnConsentManage")?.addEventListener("click", () => openLayer("preferences"));
    layer.querySelector("#spnConsentSave")?.addEventListener("click", () => save({
      analytics: layer.querySelector("#spnConsentAnalytics")?.checked === true
    }, "custom"));
    layer.querySelector("#spnConsentClose")?.addEventListener("click", () => {
      if (hasDecision) closeLayer();
      else openLayer("banner");
    });

    layer.addEventListener("click", (event) => {
      if (event.target === layer && hasDecision) closeLayer();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !layer.hidden && hasDecision) closeLayer();
    });

    document.addEventListener("click", (event) => {
      const opener = event.target instanceof Element ? event.target.closest("[data-consent-settings]") : null;
      if (!opener) return;
      event.preventDefault();
      openLayer("preferences");
    });

    if (!hasDecision) openLayer("banner");
  };

  window.SPNConsent = Object.freeze({
    get: () => ({ ...state }),
    hasDecision: () => hasDecision,
    // Cannot grant advertising — normalize() rejects it from this source.
    set: (next) => save(next, "api"),
    open: () => openLayer("preferences"),
    // A certified CMP bridge can call this after it resolves a TCF decision.
    syncFromCmp: (next) => save(next, "certified_cmp")
  });

  if (hasDecision) updateGoogleConsent(state);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      createInterface();
      publish(hasDecision ? "stored" : "default");
    }, { once: true });
  } else {
    createInterface();
    publish(hasDecision ? "stored" : "default");
  }
})();