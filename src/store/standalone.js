/*
 * The basket on the static sub-sites.
 *
 * /websites/, /visual-lab/ and /work/ are plain HTML outside the
 * homepage's module graph, so nothing there ever wired the basket up: the
 * header control sat in their markup doing nothing and the count read
 * zero however full the basket was.
 *
 * Built by esbuild into one self-contained IIFE at a stable path, because
 * these pages reference scripts by name and cannot use a hashed bundle.
 * The stylesheet is carried inline for the same reason — one file to load,
 * nothing else to keep in step.
 */
import css from "../styles/basket.css";
import { initBasketUI } from "./basketUI.js";

const STYLE_ID = "spn-basket-style";

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

function start() {
  injectStyles();
  initBasketUI();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
