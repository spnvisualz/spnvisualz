(() => {
  "use strict";

  const summaryLines = document.getElementById("checkoutSummaryLines");
  const total = document.getElementById("checkoutTotal");
  const expressLine = document.getElementById("checkoutExpressLine");
  const empty = document.getElementById("checkoutEmpty");
  const loading = document.getElementById("checkoutLoading");
  const errorBox = document.getElementById("checkoutError");
  const errorMessage = document.getElementById("checkoutErrorMessage");
  const retry = document.getElementById("checkoutRetry");
  const mount = document.getElementById("checkoutMount");
  let embeddedCheckout;

  const store = () => window.SPN_CONFIG?.checkout?.store || {};
  const catalogue = () => window.SPN_CONFIG?.checkout?.items || {};
  const cartApi = () => window.SPN_CHECKOUT?.cart;

  const renderSummary = (cart) => {
    summaryLines.innerHTML = "";
    for (const line of cart.items) {
      const entry = catalogue()[line.sku];
      if (!entry) continue;
      const row = document.createElement("li");
      row.innerHTML = `<span><strong></strong><small></small></span><b></b>`;
      row.querySelector("strong").textContent = entry.label;
      row.querySelector("small").textContent = `Qty ${line.quantity} × ${cartApi().format(entry.price)}`;
      row.querySelector("b").textContent = cartApi().format(entry.price * line.quantity);
      summaryLines.append(row);
    }
    expressLine.hidden = !cart.express;
    if (cart.express) expressLine.querySelector("b").textContent = cartApi().format(catalogue()["express-delivery"]?.price || 40);
    total.textContent = cartApi().format(cart.subtotal);
  };

  const showError = (message) => {
    loading.hidden = true;
    errorMessage.textContent = message || "Please try again.";
    errorBox.hidden = false;
  };

  const startCheckout = async () => {
    errorBox.hidden = true;
    mount.innerHTML = "";
    loading.hidden = false;
    const cart = cartApi()?.snapshot();
    if (!cart || cart.count === 0) {
      loading.hidden = true;
      empty.hidden = false;
      return;
    }
    renderSummary(cart);

    try {
      const response = await fetch(store().createSessionUrl || "/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cart)
      });
      const raw = await response.text();
      let payload = {};
      try { payload = raw ? JSON.parse(raw) : {}; }
      catch (_) {}
      if (!response.ok) throw new Error(payload.error || "Secure checkout could not be prepared.");
      if (typeof window.Stripe !== "function") throw new Error("The secure payment form did not load. Check your connection and try again.");

      const stripe = window.Stripe(payload.publishableKey);
      embeddedCheckout = await stripe.createEmbeddedCheckoutPage({
        fetchClientSecret: async () => payload.clientSecret
      });
      embeddedCheckout.mount("#checkoutMount");
      loading.hidden = true;
    } catch (error) {
      showError(error.message);
    }
  };

  retry.addEventListener("click", async () => {
    if (embeddedCheckout) {
      embeddedCheckout.destroy();
      embeddedCheckout = null;
    }
    await startCheckout();
  });

  const boot = () => {
    const cart = cartApi()?.snapshot();
    if (cart) renderSummary(cart);
    startCheckout();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
