// Rewrites the Selected Work structured data in index.html from
// src/work/projects.js.
//
// The list search engines read was hand-maintained and drifted: three reels
// were added to the page in October and never made it into the data, so
// Google was told about seven works while the page showed ten. Generated
// now, and tests/work.test.mjs fails if the two disagree.
//
// Each entry links to the project's own page under /work/ when one exists,
// otherwise to the Selected Work section.
//
// Run: npm run work

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://spnvisualz.com";

export async function selectedWorkData() {
  const { PROJECTS } = await import(join(root, "src/work/projects.js"));
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${ORIGIN}/#selected-work`,
    name: "SPNVISUALZ Selected Work",
    numberOfItems: PROJECTS.length,
    itemListElement: PROJECTS.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "CreativeWork",
        name: p.title,
        description: p.description,
        image: `${ORIGIN}${p.poster}`,
        creator: { "@id": `${ORIGIN}/#organization` },
        url: existsSync(join(root, "work", p.slug, "index.html")) ? `${ORIGIN}/work/${p.slug}/` : `${ORIGIN}/#work`
      }
    }))
  };
}

export function findBlock(html) {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  for (const m of html.matchAll(re)) {
    if (m[1].includes('#selected-work"')) return { start: m.index, end: m.index + m[0].length, json: m[1] };
  }
  throw new Error("index.html has no #selected-work structured data block");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = join(root, "index.html");
  const html = readFileSync(file, "utf8");
  const { start, end } = findBlock(html);
  const data = await selectedWorkData();
  const block = `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n  </script>`;
  writeFileSync(file, html.slice(0, start) + block + html.slice(end));
  console.log(`structured data written — ${data.numberOfItems} works`);
}
