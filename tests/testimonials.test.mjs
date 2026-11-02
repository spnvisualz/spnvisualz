import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TESTIMONIALS } from "../src/testimonials/testimonials.js";
import { MARKER, publishable, renderTestimonials } from "../src/testimonials/render.js";
import { PROJECTS } from "../src/work/projects.js";

test("the homepage carries the testimonials marker exactly once", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.equal(html.split(MARKER).length - 1, 1);
});

test("an empty list renders no section at all", () => {
  assert.equal(renderTestimonials([]), "");
  assert.equal(renderTestimonials(undefined), "");
});

test("only entries the client approved are published", () => {
  const list = [
    { quote: "Approved words", name: "A", approved: true },
    { quote: "Not yet approved", name: "B" },
    { quote: "Approved but nameless", name: " ", approved: true }
  ];
  assert.deepEqual(publishable(list).map((t) => t.name), ["A"]);
  const html = renderTestimonials(list);
  assert.match(html, /Approved words/);
  assert.doesNotMatch(html, /Not yet approved|nameless/);
});

test("quotes are escaped and linked projects show their title", () => {
  const html = renderTestimonials(
    [{ quote: "<b>x</b> & y", name: "C", role: "Artist", project: PROJECTS[0].slug, approved: true }],
    PROJECTS
  );
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt; &amp; y/);
  assert.ok(html.includes(`Artist · ${PROJECTS[0].title.replace(/&/g, "&amp;")}`));
});

test("every published testimonial is complete and points at a real project", () => {
  const slugs = new Set(PROJECTS.map((p) => p.slug));
  for (const t of publishable(TESTIMONIALS)) {
    if (t.project) assert.ok(slugs.has(t.project), `unknown project slug: ${t.project}`);
  }
});
