export function initPricing() {
  const singleTab = document.getElementById("singleTab");
  const bundleTab = document.getElementById("bundleTab");
  const singlePanel = document.getElementById("singlePrices");
  const bundlePanel = document.getElementById("bundlePrices");
  if (!singleTab || !bundleTab) return;

  const setTab = (bundles) => {
    singleTab.classList.toggle("is-active", !bundles);
    bundleTab.classList.toggle("is-active", bundles);
    singleTab.setAttribute("aria-selected", String(!bundles));
    bundleTab.setAttribute("aria-selected", String(bundles));
    singlePanel?.classList.toggle("is-active", !bundles);
    bundlePanel?.classList.toggle("is-active", bundles);
    singlePanel?.toggleAttribute("hidden", bundles);
    bundlePanel?.toggleAttribute("hidden", !bundles);
  };

  singleTab.addEventListener("click", () => setTab(false));
  bundleTab.addEventListener("click", () => setTab(true));
}
