import { getLenis } from "../motion/scrollTimeline.js";

export function initServices({ onOrder } = {}) {
  const rows = Array.from(document.querySelectorAll(".service-row"));
  const dialog = document.getElementById("serviceDialog");
  const closeDialogBtn = document.getElementById("closeServiceDialog");
  // Always hand back the same shape, so a caller can ask for a service by
  // name without first checking whether this page had any.
  if (!rows.length) return { openProduct: () => false };

  rows.forEach((row) => {
    row.addEventListener("click", () => {
      rows.forEach((r) => r.classList.toggle("is-active", r === row));
      openDetails(row);
    });
  });

  function openDetails(row) {
    if (!dialog) return;
    const title = dialog.querySelector("#serviceDialogTitle");
    const price = dialog.querySelector("#serviceDialogPrice");
    const desc = dialog.querySelector("#serviceDialogDescription");
    const list = dialog.querySelector("#serviceDialogIncludes");
    const orderBtn = dialog.querySelector("#serviceDialogOrder");
    if (title) title.textContent = row.querySelector("strong")?.textContent || "";
    if (price) price.textContent = row.dataset.price || "";
    if (desc) desc.textContent = row.dataset.description || "";
    if (list) {
      list.innerHTML = "";
      (row.dataset.includes || "").split("|").filter(Boolean).forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        list.appendChild(li);
      });
    }
    // The detail panel's button buys the service outright when that
    // service has a checkout URL, and falls back to the enquiry dialog
    // when it does not — so the panel never becomes a dead end while the
    // catalogue is still being filled in.
    if (orderBtn) {
      const sku = row.dataset.sku || "";
      const buyable = sku && window.SPN_CHECKOUT?.isConfigured(sku);
      orderBtn.dataset.buy = buyable ? sku : "";
      const priceLabel = row.dataset.price ? ` — ${row.dataset.price.replace(/^From\s*/i, "")}` : "";
      orderBtn.textContent = buyable ? `Order this${priceLabel}` : "Order this";
      orderBtn.onclick = () => {
        if (buyable && window.SPN_CHECKOUT.open(sku)) return;
        dialog.close();
        onOrder?.(row.dataset.product || "");
      };
    }
    dialog.showModal();
    getLenis()?.stop();
  }

  closeDialogBtn?.addEventListener("click", () => dialog?.close());

  // The backdrop of a <dialog> reports the dialog element itself as the
  // click target, and nothing inside the shell ever does — so this is the
  // whole test. It used to compare the pointer against the shell's bounding
  // box instead, which is true of a backdrop click but also of several
  // things that are not one: a keyboard-activated button reports its click
  // at (0, 0), and a native select popup can render past the shell's edge.
  // Either one landed outside the box and shut the dialog.
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  // The page behind a modal must not move. The order dialog parks Lenis
  // while it is open; this one did not, so a wheel or trackpad gesture
  // anywhere outside the shell scrolled the homepage underneath it.
  // data-lenis-prevent on the shell only stops the shell's own overflow
  // from propagating — it says nothing about the rest of the page.
  dialog?.addEventListener("close", () => getLenis()?.start());

  return {
    openProduct(product) {
      const row = rows.find((r) => r.dataset.product === product);
      if (!row) return false;
      rows.forEach((r) => r.classList.toggle("is-active", r === row));
      openDetails(row);
      return true;
    }
  };
}
