// What CI can check about the sitemap without git history.
//
// The dates come from `npm run sitemap`, which needs a real clone; CI
// checks out at depth 1 and cannot recompute them. What it can check is the
// part that actually goes wrong in practice — a page added to the site and
// never added to the sitemap, or a page removed and left in it — and that
// is what this covers.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Safe to import: the generator only writes when it is the entry point.
const { PAGES } = await import("../scripts/build-sitemap.mjs");

const xml = readFileSync(join(root, "public/sitemap.xml"), "utf8");
const listed = [...xml.matchAll(/<loc>https:\/\/spnvisualz\.com([^<]*)<\/loc>/g)].map((m) => m[1]);

// Every index.html on the site that is meant to be indexed --------------
function indexablePages(dir = root, found = []) {
  for (const entry of readdirSync(dir)) {
    // dev/ is scratch, public/ holds 404 and the Search Console token,
    // visual-lab/articles is walked but the template itself is not a page
    if (["node_modules", "dist", ".git", "dev", "public", "media", "scripts", "tests"].includes(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) indexablePages(path, found);
    else if (entry === "index.html") {
      const html = readFileSync(path, "utf8");
      if (/<meta\s+name="robots"[^>]*noindex/i.test(html)) continue;
      const rel = relative(root, dirname(path)).split(sep).join("/");
      found.push(rel ? `/${rel}/` : "/");
    }
  }
  return found;
}

test("the sitemap lists every indexable page, and nothing that is not one", () => {
  const onDisk = new Set(indexablePages());
  onDisk.add("/"); // the homepage is index.html at the root, not root/index.html
  const inSitemap = new Set(listed);

  const missing = [...onDisk].filter((p) => !inSitemap.has(p));
  const extra = [...inSitemap].filter((p) => !onDisk.has(p));

  assert.deepEqual(missing, [], `these pages exist but are not in the sitemap: ${missing.join(", ")}`);
  assert.deepEqual(extra, [], `these are in the sitemap but have no page: ${extra.join(", ")}`);
});

test("every sitemap entry resolves to a file that is really there", () => {
  for (const path of listed) {
    const file = join(root, path === "/" ? "index.html" : path.slice(1) + "index.html");
    assert.ok(existsSync(file), `${path} is in the sitemap but ${relative(root, file)} does not exist`);
  }
});

test("no duplicate entries", () => {
  assert.equal(new Set(listed).size, listed.length, "the same url is listed more than once");
});

test("the generator's list and the committed file agree", () => {
  assert.ok(PAGES, "scripts/build-sitemap.mjs must export PAGES");
  assert.deepEqual(
    PAGES.map((p) => p.path),
    listed,
    "public/sitemap.xml is out of step with the generator — run `npm run sitemap`"
  );
});

test("every lastmod is a real date, and not in the future", () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const m of xml.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)) {
    assert.match(m[1], /^\d{4}-\d{2}-\d{2}$/, `"${m[1]}" is not a W3C date`);
    assert.ok(m[1] <= today, `${m[1]} is in the future`);
  }
});
