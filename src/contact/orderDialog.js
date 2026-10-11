import { getLenis } from "../motion/scrollTimeline.js";

// Sends the brief through the same-origin Worker so visitors never have to
// leave the site or have a local email application configured.
export function initOrderDialog() {
  const dialog = document.getElementById("orderDialog");
  const closeBtn = document.getElementById("closeOrderDialog");
  const form = document.getElementById("orderForm");
  const serviceSelect = document.getElementById("serviceSelect");
  let lastFocus = null;

  const open = (product = "", { billing = "" } = {}) => {
    if (!dialog) return;
    lastFocus = document.activeElement;
    const billingField = document.getElementById("orderBilling");
    if (billingField) billingField.value = billing;
    if (serviceSelect && product) {
      const hasOption = Array.from(serviceSelect.options).some((o) => o.value === product);
      serviceSelect.value = hasOption ? product : "Custom Project";
    }
    dialog.showModal();
    getLenis()?.stop();
    setTimeout(() => dialog.querySelector("input")?.focus(), 60);
  };

  const close = () => {
    if (dialog?.open) dialog.close();
  };

  document.querySelectorAll("[data-order]").forEach((btn) =>
    btn.addEventListener("click", () => open(btn.dataset.product || ""))
  );
  closeBtn?.addEventListener("click", close);
  dialog?.addEventListener("close", () => {
    if (lastFocus instanceof HTMLElement) lastFocus.focus();
    getLenis()?.start();
  });
  // A backdrop click reports the dialog element itself as its target, and
  // nothing inside the shell ever does. The previous test compared the
  // pointer against the shell's bounding box, which is also true of a
  // keyboard-activated button (those report their click at 0, 0) and of a
  // native select popup drawn past the shell's edge — so picking a service
  // with the keyboard, or from a dropdown that overflowed the panel, could
  // shut the form instead.
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const service = String(data.get("service") || "Custom Project");
    const button = form.querySelector('button[type="submit"]');
    const label = button?.querySelector("span");
    const status = form.querySelector("[data-enquiry-status]");
    if (button) button.disabled = true;
    if (label) label.textContent = "Sending…";
    if (status) status.textContent = "";
    try {
      const response = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "project",
          name: data.get("name"),
          contact: data.get("contact"),
          service,
          billing: data.get("billing"),
          message: data.get("brief"),
          website: data.get("website")
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Your brief could not be sent.");
      form.reset();
      if (status) status.textContent = "Brief received. We’ll get back to you shortly.";
      if (label) label.textContent = "Brief sent";
      setTimeout(close, 1400);
    } catch (error) {
      if (status) status.textContent = error.message || "Your brief could not be sent. Please try again.";
      if (label) label.textContent = "Send project brief";
      if (button) button.disabled = false;
    }
  });

  return { open };
}
