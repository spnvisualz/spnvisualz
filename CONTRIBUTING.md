# Working on SPNVISUALZ

Development happens in **GitHub Codespaces**; building and publishing
happen in **GitHub Actions**. No step requires a local machine.

## Start working

Open the repo on GitHub → **Code** → **Codespaces** → **Create codespace
on main**.

The container installs Node 22, `ffmpeg` (for the Selected Work video
pipeline) and `git-lfs`, then runs `npm ci`. When it is ready:

```bash
npm run dev
```

Port 5173 forwards automatically and the preview opens. Edits hot-reload.

To check a production build the way CI does:

```bash
npm run build
npx serve dist        # or: python3 -m http.server -d dist 4999
```

## Publishing

`main` is the source of truth. Pushing to `main` triggers
`.github/workflows/deploy.yml`, which builds the site, verifies the
output, publishes it to GitHub Pages, and then checks the live site.

There is no manual build-and-upload step, and no local machine involved.

Work on a branch and open a pull request to get the same checks without
publishing — `.github/workflows/ci.yml` runs the identical build plus
HTML, JSON-LD, link and advertising-policy checks.

### What the deploy checks before publishing

- Every required page exists and is non-empty
- `CNAME`, `robots.txt`, `sitemap.xml`, `ads.txt`, `favicon.ico` present
- `visual-lab/article-template.html` is **not** published (it contains
  unresolved `{{PLACEHOLDER}}` tokens)
- Selected Work contains exactly 9 items in the HTML, not injected by JS
- Every referenced work video exists in the build
- No AdSense library tag hard-coded in markup, and no empty ad
  placeholders

After deploying it re-checks the same URLs on `https://spnvisualz.com`
and fails the run if the live site is wrong.

## Media

| What | Where | Tracking |
|---|---|---|
| Optimized web video and images (served to visitors) | `public/assets/` | Ordinary Git |
| Original masters, project files, uncompressed exports | `media/originals/` | Git LFS |

Optimized assets stay in normal history because every deploy needs them
and they are a bounded, compressed set. Originals go to LFS so a single
large render never enters ordinary history, where it would live in every
clone forever.

See `media/originals/README.md` for the transcode and seamless-loop
recipes, and `.gitattributes` for the exact rules.

Deploys check out with `lfs: false` — building the site never needs the
originals.

## Architecture notes

- **Build**: Vite. `index.html` is the only bundled entry. `visual-lab/`,
  `websites/`, `work/`, `privacy/` and `about/` are standalone static
  sub-sites copied into `dist/` by a small plugin in `vite.config.js`.
- **Motion**: Lenis owns scroll position; GSAP ScrollTrigger drives
  scroll-linked effects. One source of truth, no competing systems.
- **Selected Work**: real `<video>` elements in the HTML, played and
  paused by `IntersectionObserver`. Deliberately not a 3D corridor —
  playback used to be decided by comparing camera depth against plane
  depth, which was fragile enough that clips silently failed to play.
- **3D**: Three.js. The globe, the Services object and the opening liquid
  surface each bind to their own section.
- **Consent**: `public/assets/js/consent.js` renders an analytics-only
  dialog. It is **not** a certified CMP and must never grant advertising
  consent — `ads.js` refuses to load anything without a certified CMP,
  a real numeric slot ID and a valid publisher ID.

### Two things worth knowing before changing scroll behaviour

`ScrollTrigger` snapshots `history.scrollRestoration` at *import* time and
restores that snapshot later. Setting it in `boot()` alone is silently
undone, which once meant refreshing anywhere down the page returned the
visitor to that offset. `main.js` uses
`ScrollTrigger.clearScrollMemory("manual")` instead.

The consent dialog's styling lives in `src/styles/consent.css` so it is
part of the homepage bundle. When it lived only in `monetization.css`
(which the homepage does not load) the injected dialog rendered unstyled
and `static` at the end of the document, and focusing its button scrolled
every first-time visitor to the bottom of the site.
