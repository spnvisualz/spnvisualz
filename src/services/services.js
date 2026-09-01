export function initServices({ onOrder } = {}) {
  const rows = Array.from(document.querySelectorAll(".service-row"));
  const dialog = document.getElementById("serviceDialog");
  const closeDialogBtn = document.getElementById("closeServiceDialog");
  if (!rows.length) return;

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
    if (orderBtn) orderBtn.onclick = () => {
      dialog.close();
      onOrder?.(row.dataset.product || "");
    };
    dialog.showModal();
  }

  closeDialogBtn?.addEventListener("click", () => dialog?.close());
  dialog?.addEventListener("click", (event) => {
    const shell = dialog.querySelector(".service-dialog__shell");
    const rect = shell?.getBoundingClientRect();
    if (rect && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) {
      dialog.close();
    }
  });
}
