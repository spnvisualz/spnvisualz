import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { PROJECTS } from "../src/work/projects.js";
import { caseStudyPages, isHandWritten, serviceFor, GENERATED_MARK } from "../scripts/build-case-studies.mjs";

// uploadDate comes from git history, which CI's depth-1 checkout cannot
// reproduce, so it is left out of the comparison.
const stable = (html) => html.replace(/"uploadDate": "[^"]*"/, '"uploadDate": ""');

test("every Selected Work project has a case-study page", () => {
  for (const p of PROJECTS) {
    assert.ok(existsSync(new URL(`../work/${p.slug}/index.html`, import.meta.url)), `missing work/${p.slug}/index.html`);
  }
});

test("generated case-study pages are up to date (run npm run case-studies)", () => {
  const pages = caseStudyPages();
  assert.ok(pages.length >= 1);
  for (const page of pages) {
    const onDisk = readFileSync(page.file, "utf8");
    assert.ok(onDisk.includes(GENERATED_MARK));
    assert.equal(stable(onDisk), stable(page.html), `work/${page.slug}/index.html is stale`);
  }
});

test("the 'from' price on each page is the cheapest catalogue price for that service", () => {
  for (const p of PROJECTS.filter((p) => !isHandWritten(p.slug))) {
    const html = readFileSync(new URL(`../work/${p.slug}/index.html`, import.meta.url), "utf8");
    const { name, from } = serviceFor(p);
    assert.ok(html.includes(`${name} from ${from} —`), `${p.slug}: expected "${name} from ${from}"`);
  }
});

test("the work index links every card to its case study", () => {
  const html = readFileSync(new URL("../work/index.html", import.meta.url), "utf8");
  for (const p of PROJECTS) assert.ok(html.includes(`href="/work/${p.slug}/"`), `work/index.html does not link /work/${p.slug}/`);
});

test("VideoObject.uploadDate is a full ISO 8601 date-time with a timezone", () => {
  for (const page of caseStudyPages()) {
    const m = page.html.match(/"uploadDate": "([^"]*)"/);
    assert.ok(m, `${page.slug}: no uploadDate`);
    assert.match(m[1], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/, `${page.slug}: ${m[1]}`);
    assert.ok(!Number.isNaN(Date.parse(m[1])), `${page.slug}: unparseable ${m[1]}`);
  }
});
