import { resolve } from "node:path";
import { cpSync, existsSync } from "node:fs";
import { defineConfig } from "vite";

const __dirname = import.meta.dirname;

// Independent static sub-sites (their own HTML/CSS/JS, no bundling needed)
// that live outside both publicDir and the Vite module graph. They resolve
// correctly in dev via Vite's normal static file serving — the default
// appType:'spa' HTML-fallback only intercepts *unmatched* requests, and
// these are real files. But `vite build` only ever copies publicDir; it
// has no reason to know about arbitrary project-root directories, so
// without this they'd silently go missing from dist/ while looking fine
// in dev. (Moving them into publicDir instead breaks dev serving — the
// SPA fallback there ends up shadowing nested public/ HTML before static
// resolution gets a chance to run. This plugin is the fix that doesn't
// trade one working mode for the other.)
const STATIC_SUBSITES = ["visual-lab", "websites", "work", "privacy", "about"];

// Legacy noindex,follow meta-refresh redirect stubs for old bookmarked/
// indexed URLs (e.g. /contact.html -> /#contact). Not linked from anywhere
// current, but real visitors can still land on them directly.
const STATIC_REDIRECT_STUBS = [
  "about.html",
  "booking.html",
  "contact.html",
  "splash.html",
  "thank-you.html",
  "work.html"
];

// Authoring artifacts that must never reach the published site. The
// article template is a scaffold full of unresolved {{PLACEHOLDER}}
// tokens — harmless in the repo, but a reviewer or crawler reaching it
// on the live domain sees a broken, contentless page.
const EXCLUDED_FROM_BUILD = new Set(["article-template.html"]);

function copyStaticSubsites() {
  return {
    name: "copy-static-subsites",
    apply: "build",
    closeBundle() {
      for (const dir of STATIC_SUBSITES) {
        const src = resolve(__dirname, dir);
        if (!existsSync(src)) continue;
        cpSync(src, resolve(__dirname, "dist", dir), {
          recursive: true,
          filter: (from) => !EXCLUDED_FROM_BUILD.has(from.split("/").pop())
        });
      }
      for (const file of STATIC_REDIRECT_STUBS) {
        const src = resolve(__dirname, file);
        if (!existsSync(src)) continue;
        cpSync(src, resolve(__dirname, "dist", file));
      }
    }
  };
}

// Static multi-page site. HTML files stay at their existing public paths so
// current URLs / SEO / GitHub Pages routing are unaffected by the move to
// a build step. Large binary assets (video/image/audio) live in /public and
// are copied through untouched — only JS/CSS get bundled and hashed.
export default defineConfig({
  publicDir: "public",
  plugins: [copyStaticSubsites()],
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
    rollupOptions: {
      // dev/planet-lab.html and dev/liquid-lab.html are internal shader/
      // scene iteration harnesses — served fine by `vite`'s dev server on
      // their own, but not real pages and not worth shipping to the
      // production site, so they're deliberately not build inputs.
      input: {
        main: resolve(__dirname, "index.html")
      }
    }
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: false
  }
});
