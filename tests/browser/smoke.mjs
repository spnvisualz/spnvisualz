// Real-browser smoke test for the homepage, run against the production
// build (`npm run build` first). Not part of `npm test`: it needs browser
// binaries. CI runs it before deploying (see .github/workflows/deploy.yml);
// locally: `npm run test:browser`.
//
// It exists because the Nov 17-18 redesign passed every unit test and
// still shipped a homepage that froze after the intro on iPhone and on
// desktop: <body> became its own scroll box while <html> was locked, so a
// swipe during the intro moved the body, window.scrollY stayed 0, and
// every scroll-driven effect stayed in its starting state (text at
// opacity 0, reels small and shaded). This drives the page like a visitor
// does, in Safari's engine (WebKit) and Chrome's, and fails on exactly
// those symptoms.

/* global document, getComputedStyle, innerHeight, scrollY, scrollBy, scrollTo */
// (browser globals: used inside page.evaluate callbacks, which run in the page)
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, webkit, devices } from "playwright";

const PORT = Number(process.env.SMOKE_PORT || 4179);
const BASE = `http://127.0.0.1:${PORT}`;
const failures = [];
const fail = (msg) => failures.push(msg);

// Started directly (not through npx, whose child would outlive a kill)
// and in its own process group, so stop() takes the whole server down.
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--outDir", process.env.SMOKE_DIST || "dist", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
const stop = () => { try { process.kill(-server.pid); } catch { /* already gone */ } };
process.on("exit", stop);

let up = false;
try { await fetch(BASE + "/"); up = true; } catch { /* expected: nothing there yet */ }
if (up) {
  console.error(`Something is already serving ${BASE}; refusing to test it instead of this build.`);
  process.exit(1);
}
// Bound to 127.0.0.1 explicitly: plain "localhost" resolves to ::1 on
// GitHub's runners, and the browsers below are pointed at IPv4.
let ready = false;
for (let i = 0; i < 60 && !ready; i++) {
  try { ready = (await fetch(BASE + "/")).ok; } catch { /* not up yet */ }
  if (!ready) await sleep(500);
}
if (!ready) {
  console.error(`The preview server never answered on ${BASE}.`);
  stop();
  process.exit(1);
}

// Share of visible, in-viewport text inside <main> that is actually readable.
const readableText = (p) => p.evaluate(() => {
  const opacity = (e) => {
    let o = 1;
    for (let n = e; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.visibility === "hidden" || cs.display === "none") return 0;
      o *= Number(cs.opacity);
    }
    return o;
  };
  const els = [...document.querySelectorAll("main h1, main h2, main h3, main p")].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.top > 80 && r.bottom < innerHeight - 40 && e.textContent.trim();
  });
  return { total: els.length, readable: els.filter((e) => opacity(e) > 0.5).length };
});

const RUNS = [
  { name: "WebKit / iPhone", engine: webkit, context: devices["iPhone 15"], touch: true },
  { name: "WebKit / desktop", engine: webkit, context: { viewport: { width: 1440, height: 900 } } },
  { name: "Chromium / desktop", engine: chromium, context: { viewport: { width: 1440, height: 900 } } }
];

for (const run of RUNS) {
  const browser = await run.engine.launch();
  const ctx = await browser.newContext(run.context);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const tag = (msg) => `${run.name}: ${msg}`;

  await page.goto(BASE + "/");
  await sleep(1200);

  // A visitor trying to scroll while the intro plays.
  if (run.touch) {
    await page.evaluate(() => {
      document.body.dispatchEvent(new Event("touchmove", { cancelable: true, bubbles: true }));
      document.body.scrollTop = 1500; // what a swipe does if <body> is a scroll box
    });
  } else {
    await page.mouse.move(700, 450);
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 700); await sleep(200); }
  }
  if (await page.evaluate(() => document.body.scrollTop) > 0) {
    fail(tag("<body> scrolled on its own during the intro (it must never be a scroll container)"));
  }

  await sleep(9000);
  await page.locator("#spnConsentNecessary").click({ timeout: 3000 }).catch(() => {});
  await sleep(500);

  const state = await page.evaluate(() => ({
    introActive: document.documentElement.classList.contains("intro-active"),
    lenisStopped: document.documentElement.classList.contains("lenis-stopped"),
    overflow: getComputedStyle(document.documentElement).overflowY
  }));
  if (state.introActive) fail(tag("intro never released the page (html.intro-active still set)"));
  if (state.lenisStopped) fail(tag("smooth scroll still stopped after the intro"));
  if (state.overflow === "hidden") fail(tag("<html> still overflow:hidden after the intro"));

  // Scrolling must move the window.
  const y0 = await page.evaluate(() => scrollY);
  if (run.touch) {
    await page.evaluate(() => scrollBy(0, 1200));
  } else {
    await page.mouse.move(700, 450);
    for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 600); await sleep(300); }
  }
  await sleep(1500);
  const y1 = await page.evaluate(() => scrollY);
  if (y1 < y0 + 300) fail(tag(`page did not scroll (window.scrollY ${y0} -> ${y1})`));

  // Text must be readable all the way down.
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (const f of [0.15, 0.35, 0.55, 0.75, 0.92]) {
    await page.evaluate((y) => scrollTo(0, y), Math.round(height * f));
    await sleep(2500);
    const t = await readableText(page);
    if (t.total && t.readable / t.total < 0.8) fail(tag(`only ${t.readable}/${t.total} text blocks readable at ${Math.round(f * 100)}% of the page`));
  }

  // The first work card must have opened (scroll effects are live).
  await page.evaluate(() => document.querySelector(".work-item")?.scrollIntoView({ block: "center" }));
  await sleep(2000);
  const card = await page.evaluate(() => {
    const meta = document.querySelector(".work-item .work-item__meta");
    return meta ? Number(getComputedStyle(meta).opacity) : 1;
  });
  if (card < 0.6) fail(tag(`work card text stuck at opacity ${card.toFixed(2)} (scroll effects frozen)`));

  if (errors.length) fail(tag(`page errors: ${errors.join(" | ")}`));
  console.log(`${run.name}: checked`);
  await browser.close();
}

stop();
if (failures.length) {
  console.error("\nBrowser smoke test FAILED:\n  " + failures.join("\n  "));
  process.exit(1);
}
console.log("\nBrowser smoke test passed.");
