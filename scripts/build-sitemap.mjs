// Regenerates public/sitemap.xml.
//
// The dates in it were maintained by hand and had stopped being true:
// fifteen of the eighteen entries claimed a lastmod older than the page's
// actual last change, some by ten days. A sitemap that is wrong about when
// things changed is worse than one that says nothing, because lastmod is
// the only part of it a crawler can act on.
//
// Everything except the date is curated and stays curated — priority,
// changefreq and the image references below are judgements about the site,
// not facts a script can derive. The date is the opposite: it is a fact,
// and the one thing that goes stale on its own. So the list lives here and
// the dates come from git.
//
// lastmod is the last commit that touched the page's own HTML. That is
// what sitemap generators conventionally use and what the spec allows; it
// does mean a change that alters no visible copy still moves the date.
//
// Run with `npm run sitemap` after adding or editing a page, and commit the
// result. It is deliberately NOT part of the build: CI checks out at
// depth 1, where `git log` sees one commit and would stamp every page with
// the same date. The script detects exactly that — every page resolving to
// a single date — and refuses rather than write it. tests/sitemap.test.mjs
// covers what CI can check without history: that the file lists every
// indexable page and nothing else.

import { execFileSync } from "node:child_process";
import { existsSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://spnvisualz.com";

// path -> the file that is served for it
const fileFor = (path) => join(root, path === "/" ? "index.html" : path.slice(1) + "index.html");

export const PAGES = [
  { path: "/", changefreq: "weekly", priority: "1.0", images: ["/assets/spnvisualz-social.jpg", "/assets/images/spnvisualz.PNG", "/assets/work-icekiid.webp", "/assets/work-gezana-lalux.webp"] },
  { path: "/work/", changefreq: "monthly", priority: "0.9", images: ["/assets/work-icekiid.webp", "/assets/work-gezana-lalux.webp", "/assets/brand-gezana.jpg"] },
  { path: "/work/icekiid/", changefreq: "monthly", priority: "0.8", images: ["/assets/work-icekiid.webp"] },
  { path: "/work/gezana-x-lalux/", changefreq: "monthly", priority: "0.8", images: ["/assets/work-gezana-lalux.webp"] },
  { path: "/websites/", changefreq: "monthly", priority: "0.9" },
  { path: "/visual-lab/", changefreq: "weekly", priority: "0.9", images: ["/assets/brand-glowvana.jpg"] },
  { path: "/visual-lab/articles/event-visual-design-trends-2026/", changefreq: "monthly", priority: "0.8", images: ["/assets/spnvisualz-social.jpg"] },
  { path: "/visual-lab/articles/how-to-make-a-brand-look-expensive/", changefreq: "monthly", priority: "0.8", images: ["/assets/brand-glowvana.jpg"] },
  { path: "/visual-lab/articles/logo-design-trends-2026/", changefreq: "monthly", priority: "0.8", images: ["/assets/brand-gezana.jpg"] },
  { path: "/visual-lab/articles/dark-website-design-inspiration/", changefreq: "monthly", priority: "0.8", images: ["/assets/work-3.jpg"] },
  { path: "/visual-lab/articles/animated-logo-vs-static-logo/", changefreq: "monthly", priority: "0.8", images: ["/assets/work-1.jpg"] },
  { path: "/visual-lab/articles/gezana-events-visual-identity-case-study/", changefreq: "monthly", priority: "0.8", images: ["/assets/brand-gezana.jpg"] },
  { path: "/visual-lab/articles/glowvana-beauty-brand-identity-case-study/", changefreq: "monthly", priority: "0.8", images: ["/assets/brand-glowvana.jpg"] },
  { path: "/visual-lab/articles/tao-black-chrome-motion-loop-case-study/", changefreq: "monthly", priority: "0.8", images: ["/assets/work-3.jpg"] },
  { path: "/visual-lab/articles/3d-logo-design-that-still-works-in-2d/", changefreq: "monthly", priority: "0.8", images: ["/assets/spnvisualz-social.jpg"] },
  { path: "/privacy/", changefreq: "yearly", priority: "0.3" },
  { path: "/about/", changefreq: "monthly", priority: "0.7" },
  { path: "/visual-lab/author/chubae/", changefreq: "monthly", priority: "0.6" }
];

const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

function lastChanged(file) {
  const date = git(["log", "-1", "--format=%cd", "--date=short", "--", file]);
  if (date) return date;
  // never committed yet — fall back to the working copy
  return new Date(statSync(file).mtime).toISOString().slice(0, 10);
}

function build() {
  // A depth-1 checkout resolves every file to the same single commit, so
  // every page would be stamped with the same date. Test for that directly
  // rather than for shallowness: a clone can be marked shallow and still
  // carry months of history, which is enough to date these pages correctly.
  const dates = new Set();

  const rows = PAGES.map((page) => {
    const file = fileFor(page.path);
    if (!existsSync(file)) throw new Error(`${page.path} is in the sitemap but ${file} does not exist`);
    const images = (page.images || [])
      .map((src) => `<image:image><image:loc>${ORIGIN}${src}</image:loc></image:image>`)
      .join("");
    const lastmod = lastChanged(file);
    dates.add(lastmod);
    return (
      `  <url><loc>${ORIGIN}${page.path}</loc>` +
      `<lastmod>${lastmod}</lastmod>` +
      `<changefreq>${page.changefreq}</changefreq>` +
      `<priority>${page.priority}</priority>` +
      `${images}</url>`
    );
  });

  if (PAGES.length > 1 && dates.size === 1) {
    throw new Error(
      `every page resolved to ${[...dates][0]} — this checkout has too little ` +
        "history for git to say when each one actually changed. Run it on a " +
        "clone with real history and commit the result."
    );
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...rows,
    "</urlset>",
    ""
  ].join("\n");
}

// Only when run directly. tests/sitemap.test.mjs imports PAGES from here to
// check the committed file against this list, and importing must not
// rewrite the file — nor run the git dating, which cannot work on CI's
// depth-1 checkout.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(join(root, "public/sitemap.xml"), build());
  console.log(`sitemap.xml written — ${PAGES.length} urls`);
}
