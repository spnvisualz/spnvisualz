// Every way into the homepage that is not just "/".
//
// The homepage is the destination for three kinds of link scattered across
// the rest of the site: a #hash into one of its sections, ?order=<product>
// from the website packages and the booking redirect, and
// ?service=<product>#services from the Visual Lab articles. All three are
// written in one file and answered in another, so nothing but a test keeps
// them agreeing — and for a long time they did not: the parameters were
// read by nothing at all, which left every "Choose Basic / Premium /
// Exclusive" button on /websites/ landing at the top of the homepage with
// no form and no package selected.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function htmlFiles(dir = root, found = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) htmlFiles(path, found);
    else if (entry.endsWith(".html")) found.push(path);
  }
  return found;
}

const pages = htmlFiles().map((path) => ({
  path: relative(root, path),
  html: readFileSync(path, "utf8")
}));

const index = readFileSync(join(root, "index.html"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");

// What the homepage can actually satisfy -----------------------------
const orderOptions = new Set(
  [...index.matchAll(/<option(?:\s[^>]*)?>([^<]+)<\/option>/g)]
    .map((m) => m[1].trim())
    .map((v) => v.replace(/&euro;/g, "€").replace(/&amp;/g, "&"))
);
const serviceProducts = new Set(
  [...index.matchAll(/class="service-row[^"]*"[\s\S]{0,400}?data-product="([^"]+)"/g)].map((m) => m[1])
);

// What the rest of the site asks it for ------------------------------
const decode = (v) => decodeURIComponent(v).replace(/&amp;/g, "&");
function linksNamed(param) {
  const asked = [];
  for (const { path, html } of pages) {
    for (const m of html.matchAll(new RegExp(`[?&]${param}=([^"'&#\\s]+)`, "g"))) {
      asked.push({ page: path, value: decode(m[1]) });
    }
  }
  return asked;
}

test("the homepage reads the parameters the rest of the site sends it", () => {
  assert.match(main, /new URLSearchParams\(location\.search\)/);
  assert.match(main, /params\.get\("order"\)/);
  assert.match(main, /params\.get\("service"\)/);
});

test("every ?order= product is an option in the order form", () => {
  const asked = linksNamed("order");
  assert.ok(asked.length > 0, "no ?order= links found — did they move?");
  for (const { page, value } of asked) {
    assert.ok(
      orderOptions.has(value),
      `${page} links to ?order=${value}, which is not an option in #serviceSelect — ` +
        `the brief would arrive without it. Options: ${[...orderOptions].join(", ")}`
    );
  }
});

test("every ?service= product is a service row on the homepage", () => {
  const asked = linksNamed("service");
  assert.ok(asked.length > 0, "no ?service= links found — did they move?");
  for (const { page, value } of asked) {
    assert.ok(
      serviceProducts.has(value),
      `${page} links to ?service=${value}, which no .service-row carries. ` +
        `Rows: ${[...serviceProducts].join(", ")}`
    );
  }
});

test("every #hash into the homepage points at a section that exists", () => {
  // boot() resets the scroll to defeat browser restoration on a page this
  // tall, so a hash only survives because main.js resolves and re-applies
  // it. A hash naming a section that is not there fails silently.
  assert.match(main, /deepLinkTarget/, "main.js no longer resolves the incoming hash");

  const ids = new Set([...index.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const { path, html } of pages) {
    if (path === "index.html") continue;
    for (const m of html.matchAll(/href="\/(?:\?[^"#]*)?#([A-Za-z][\w-]*)"/g)) {
      assert.ok(ids.has(m[1]), `${path} links to /#${m[1]}, which is not an id on the homepage`);
    }
  }
});

test("both modals park the page scroll while they are open", () => {
  // The order dialog always did; the services dialog did not, so a wheel
  // gesture over its backdrop scrolled the homepage 2400px underneath it.
  for (const file of ["src/contact/orderDialog.js", "src/services/services.js"]) {
    const src = readFileSync(join(root, file), "utf8");
    assert.match(src, /getLenis\(\)\?\.stop\(\)/, `${file} must stop the page scroll when it opens`);
    assert.match(src, /getLenis\(\)\?\.start\(\)/, `${file} must hand the scroll back when it closes`);
  }
});

test("neither modal decides a backdrop click by pointer coordinates", () => {
  // clientX/clientY are 0 for a keyboard-activated button, and a native
  // select popup can be drawn past the shell's edge. Both used to read as
  // clicks outside the panel and shut the dialog.
  for (const file of ["src/contact/orderDialog.js", "src/services/services.js"]) {
    const src = readFileSync(join(root, file), "utf8");
    assert.match(src, /event\.target === dialog/, `${file} must test the click target, not its coordinates`);
    assert.doesNotMatch(src, /event\.clientX/, `${file} still closes on a coordinate test`);
  }
});
