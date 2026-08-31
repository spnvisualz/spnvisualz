import { resolve } from "node:path";
import { defineConfig } from "vite";

const __dirname = import.meta.dirname;

// Static multi-page site. HTML files stay at their existing public paths so
// current URLs / SEO / GitHub Pages routing are unaffected by the move to
// a build step. Large binary assets (video/image/audio) live in /public and
// are copied through untouched — only JS/CSS get bundled and hashed.
export default defineConfig({
  publicDir: "public",
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        planetLab: resolve(__dirname, "dev/planet-lab.html")
      }
    }
  },
  server: {
    port: 5173
  }
});
