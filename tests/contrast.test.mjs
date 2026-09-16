// Contrast guards for the homepage text tokens.
//
// These exist because the obvious way to check contrast on this site is
// wrong. --bg is #030207, so measuring a token against it says everything
// passes — but the homepage's actual background through the opening
// chapters is body::before, the plum page surface, and that composites to
// rgb(83,67,91). A token can clear AA against --bg by a mile and still be
// unreadable in the hero. Both backgrounds are therefore asserted here, so
// a future alpha tweak cannot quietly re-break one while satisfying the
// other.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = readFileSync(join(root, "src/styles/tokens.css"), "utf8");
const base = readFileSync(join(root, "src/styles/base.css"), "utf8");

// --- WCAG 2.1 relative luminance / contrast -------------------------
const toLinear = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const luminance = ([r, g, b]) =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hex = (h) => {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
// Source-over compositing, which is what an rgba() text colour actually
// does against whatever is behind it.
const over = (fg, alpha, bg) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));

// --- read the real values out of the stylesheets --------------------
function alphaOf(name) {
  const m = tokens.match(new RegExp(`--${name}:\\s*rgba\\(245,242,251,\\s*(\\.?[0-9.]+)\\)`));
  assert.ok(m, `--${name} is not an rgba(245,242,251, …) token any more — update this test`);
  return Number(m[1]);
}

const TEXT = hex("#f5f2fb");
const BG = hex(tokens.match(/--bg:\s*(#[0-9a-f]{6})/i)[1]);

// The hero surface, composited in the order base.css stacks it: the plum
// band, then the pointer glow, then the vignette. The vignette is weak
// this far from the frame edge, so it is taken at roughly a third of its
// stated alpha — the same reading the token alphas were solved against.
const heroSurface = (() => {
  const band = base.match(/linear-gradient\(180deg,[^)]*?(#[0-9a-f]{6}) 42%/i);
  assert.ok(band, "the page surface's 42% gradient stop moved — update this test");
  const glow = over(hex("#9e80ba"), 0.13, hex(band[1]));
  return over(hex("#0a0612"), 0.3 * 0.35, glow);
})();

const AA = 4.5;

test("the hero surface is the mid-tone it is documented to be", () => {
  const [r, g, b] = heroSurface.map(Math.round);
  assert.deepEqual([r, g, b], [83, 67, 91]);
});

for (const [token, background, where] of [
  ["muted", BG, "--bg (Selected Work onward)"],
  ["quiet", BG, "--bg (Selected Work onward)"],
  ["muted-on-surface", heroSurface, "the page surface (opening chapters)"],
  ["quiet-on-surface", heroSurface, "the page surface (opening chapters)"]
]) {
  test(`--${token} clears AA on ${where}`, () => {
    const ratio = contrast(over(TEXT, alphaOf(token), background), background);
    assert.ok(
      ratio >= AA,
      `--${token} measures ${ratio.toFixed(2)}:1 on ${where}, under the ${AA}:1 floor`
    );
  });
}

test("the surface steps keep the same hierarchy as the --bg steps", () => {
  assert.ok(
    alphaOf("muted-on-surface") > alphaOf("quiet-on-surface"),
    "muted must stay louder than quiet"
  );
  assert.ok(
    alphaOf("muted") > alphaOf("quiet"),
    "muted must stay louder than quiet"
  );
});

test("no opening-chapter text still uses the --bg-tuned steps", () => {
  // The hero eyebrow, the scroll hint and the header's menu button are the
  // three places small text sits on the surface. Catching a regression here
  // matters more than the token values themselves: the tokens are only
  // correct if these selectors are the ones using them.
  const origin = readFileSync(join(root, "src/styles/origin.css"), "utf8");
  const nav = readFileSync(join(root, "src/styles/nav.css"), "utf8");

  const rule = (css, selector) => {
    const m = css.match(new RegExp(`\\${selector}\\s*\\{[^}]*\\}`));
    assert.ok(m, `${selector} is gone — update this test`);
    return m[0];
  };

  for (const [css, selector] of [
    [origin, ".origin-eyebrow"],
    [origin, ".origin-scroll"],
    [nav, ".menu-toggle"]
  ]) {
    const body = rule(css, selector);
    assert.match(body, /var\(--(muted|quiet)-on-surface\)/, `${selector} must use an on-surface step`);
    assert.doesNotMatch(
      body,
      /color:\s*var\(--(muted|quiet)\)/,
      `${selector} sits on the page surface, where var(--muted)/var(--quiet) measure under 4.5:1`
    );
  }
});
