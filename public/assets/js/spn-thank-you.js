(() => {
  "use strict";

  const get = (id) => document.getElementById(id);
  const icon = get("thankIcon");
  const label = get("thankLabel");
  const title = get("thankTitle");
  const lede = get("thankLede");
  const status = get("thankStatus");
  const card = get("orderCard");
  const number = get("orderNumber");
  const lines = get("orderLines");
  const total = get("orderTotal");
  const nextSteps = get("nextSteps");
  const store = window.SPN_CONFIG?.checkout?.store || {};

  const format = (minor, currency) => new Intl.NumberFormat("en", {
    style: "currency",
    currency: (currency || "eur").toUpperCase()
  }).format((minor || 0) / 100);

  const renderOrder = (order) => {
    number.textContent = `#${order.orderNumber}`;
    lines.innerHTML = "";
    for (const line of order.lines || []) {
      const row = document.createElement("li");
      const name = document.createElement("span");
      const amount = document.createElement("span");
      name.textContent = `${line.name} × ${line.quantity}`;
      amount.textContent = format(line.total, order.currency);
      row.append(name, amount);
      lines.append(row);
    }
    total.textContent = format(order.total, order.currency);
    card.hidden = false;
  };

  const paid = (order) => {
    icon.innerHTML = "&check;";
    label.textContent = "Payment confirmed";
    title.textContent = "That’s booked.";
    lede.textContent = order.customerEmail
      ? `Your payment went through. Your booking email is ${order.customerEmail}.`
      : "Your payment went through and your project is now booked with SPNVISUALZ.";
    status.textContent = "We’ll review your brief and contact you within one working day.";
    nextSteps.hidden = false;
    renderOrder(order);
    if (store.storageKey) localStorage.removeItem(store.storageKey);
  };

  const processing = (order) => {
    icon.textContent = "↻";
    label.textContent = "Payment processing";
    title.textContent = "Your order is in progress.";
    lede.textContent = "Your payment method needs a little more time. We’ll confirm the booking as soon as Stripe reports that it has cleared.";
    status.textContent = "You may safely return to the studio and revisit this page to check your payment status.";
    renderOrder(order);
  };

  const failed = (message) => {
    icon.textContent = "!";
    label.textContent = "Order not confirmed";
    title.textContent = "We couldn’t verify this payment.";
    lede.textContent = message || "The payment may have been cancelled or the order link is incomplete.";
    status.textContent = "Your basket is still saved. Return to checkout to try again, or contact the studio for help.";
  };

  const boot = async () => {
    const sessionId = new URLSearchParams(location.search).get("session_id");
    if (!sessionId) return failed("No Stripe order reference was included in this page.");
    try {
      const endpoint = store.sessionStatusUrl || "/api/checkout-session";
      const response = await fetch(`${endpoint}?session_id=${encodeURIComponent(sessionId)}`);
      const order = await response.json();
      if (!response.ok) throw new Error(order.error || "We could not find that order.");
      if (order.paymentStatus === "paid" || order.paymentStatus === "no_payment_required") paid(order);
      else if (order.status === "complete") processing(order);
      else failed("The checkout was not completed.");
    } catch (error) {
      failed(error.message);
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
