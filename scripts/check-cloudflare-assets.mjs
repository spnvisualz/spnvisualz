import { readdir, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "dist");
const maxFiles = 20_000;
const maxFileBytes = 25 * 1024 * 1024;
const files = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile()) files.push(path);
  }
}

await walk(root);
if (files.length > maxFiles) {
  throw new Error(`Cloudflare Free supports at most ${maxFiles} static files; build has ${files.length}.`);
}

const oversized = [];
for (const file of files) {
  const { size } = await stat(file);
  if (size > maxFileBytes) oversized.push(`${relative(root, file)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
}
if (oversized.length) {
  throw new Error(`Cloudflare static assets must be 25 MB or smaller:\n${oversized.join("\n")}`);
}

console.log(`Cloudflare asset check passed: ${files.length} files, none over 25 MB.`);
