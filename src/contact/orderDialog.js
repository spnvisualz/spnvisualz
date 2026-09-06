import { getLenis } from "../motion/scrollTimeline.js";

// Preserves the production order flow exactly: there is no backend — the
// form composes a mailto: link with the brief pre-filled, matching the
// current live site's behavior (app.js). No fabricated form endpoint.
export function initOrderDialog() {
  const dialog = document.getElementById("orderDialog");
  const closeBtn = document.getElementById("closeOrderDialog");
  const form = document.getElementById("orderForm");
  const serviceSelect = document.getElementById("serviceSelect");
  let lastFocus = null;

  const open = (product = "") => {
    if (!dialog) return;
    lastFocus = document.activeElement;
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
  dialog?.addEventListener("click", (event) => {
    const shell = dialog.querySelector(".order-dialog__shell");
    const rect = shell?.getBoundingClientRect();
    if (rect && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) {
      close();
    }
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const service = String(data.get("service") || "Custom Project");
    const subject = `New SPNVISUALZ project — ${service}`;
    const body = [
      "Hi SPNVISUALZ,",
      "",
      `My name: ${data.get("name") || ""}`,
      `Contact me via: ${data.get("contact") || ""}`,
      `Service: ${service}`,
      "",
      "Project idea:",
      String(data.get("brief") || ""),
      "",
      "Sent from spnvisualz.com"
    ].join("\n");
    location.href = `mailto:spnvisualz@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  return { open };
}
