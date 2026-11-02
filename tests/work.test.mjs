// Selected Work appears three times — the project list, the markup the
// homepage ships, and the structured data search engines read — and all
// three have to agree. The structured data drifted once already.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { PROJECTS } = await import(join(root, "src/work/projects.js"));
const { selectedWorkData, findBlock } = await import(join(root, "scripts/build-work.mjs"));
const html = readFileSync(join(root, "index.html"), "utf8");

test("the structured data lists every work, in order", async () => {
  const shipped = JSON.parse(findBlock(html).json);
  assert.deepEqual(shipped, await selectedWorkData(), "index.html is stale — run `npm run work`");
  assert.equal(shipped.numberOfItems, PROJECTS.length);
  assert.deepEqual(shipped.itemListElement.map((e) => e.item.name), PROJECTS.map((p) => p.title));
});

test("the homepage markup matches the project list", () => {
  const items = [...html.matchAll(/<article class="work-item" data-index="(\d+)" id="work-([^"]+)">[\s\S]*?work-item__num">(\d+)<\/span>/g)];
  assert.equal(items.length, PROJECTS.length, "a project is missing from the homepage markup");
  items.forEach((m, i) => {
    assert.equal(Number(m[1]), i);
    assert.equal(m[2], PROJECTS[i].slug);
    assert.equal(m[3], PROJECTS[i].number);
  });
  assert.match(html, new RegExp(`<span id="workTotal">${String(PROJECTS.length).padStart(2, "0")}</span>`));
});
