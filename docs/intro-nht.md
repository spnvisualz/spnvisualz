# N / H / T companion planets

The user-approved main S Orb (`public/assets/images/spn-orb-arrival.webp`) is unchanged.

## Assets

- N: [spn-planet-n.webp](../public/assets/images/spn-planet-n.webp) — fractured obsidian.
- H: [spn-planet-h.webp](../public/assets/images/spn-planet-h.webp) — eroded amethyst stone and chrome orbit.
- T: [spn-planet-t.webp](../public/assets/images/spn-planet-t.webp) — cratered basalt.

All are 768 × 768 WebP files, approximately 76–84 KB each. These are pre-rendered raster artworks composited into the existing Canvas flight, not new editable 3D meshes. Their engraved marks and lighting are baked into each image. The main Orb and original flight timings remain unchanged; the companions are slightly larger for legibility.

## Generation

Built-in image-generation tool; one separate reference-guided generation per planet. The approved main Orb was the material and purple-palette reference. No changes were made to that source asset. Black-backed outputs are composited using screen blending with an opaque silhouette beneath each planet to obscure background stars.

## Prompt set

### N

Use case: stylized-concept. Asset type: production companion planet for a cinematic SPNVISUALZ website star-flight. Input image 1 is a MATERIAL / PALETTE reference only: match its extremely detailed near-black volcanic rock, intense saturated ultraviolet-purple light, fissures, and bright violet atmospheric rim. Make one exclusive companion planet. Square image, perfectly centered spherical planet of diameter 76% of the image, generous pure-black #000000 empty background. No stars or nebula outside the silhouette, no ground, no shadows on a floor, no words, no watermark. The specified capital letter must be a BROAD DEEPLY ENGRAVED GEOLOGICAL CANYON physically recessed INTO the curved rock, with visible jagged walls and purple molten energy at its bottom, chipped bevels, bright lavender-white highlights, purple glow spilling onto nearby terrain. The letter must be clearly legible at thumbnail size; NOT an extruded letter, sticker, thin drawn stroke, floating type, printed decal or attached metal. A premium photorealistic VFX planet, not a cartoon or glossy toy. Use purple ONLY for colored light, not blue, gold or orange. Front three-quarter studio-like view with strong upper-left lighting. Exact engraved character: N (two upright vertical channels joined by one diagonal running from upper left to lower right). Broad angular fractured obsidian tectonic plates; no orbital ring. Only the single N on the visible face.

### H

Use case: stylized-concept. Asset type: production companion planet for a cinematic SPNVISUALZ website star-flight. Input image 1 is a MATERIAL / PALETTE reference only: match its extremely detailed near-black volcanic rock, intense saturated ultraviolet-purple light, fissures, and bright violet atmospheric rim. Make one exclusive companion planet. Square image, perfectly centered spherical planet of diameter 76% of the image, generous pure-black #000000 empty background. No stars or nebula outside the silhouette, no ground, no shadows on a floor, no words, no watermark. The specified capital letter must be a BROAD DEEPLY ENGRAVED GEOLOGICAL CANYON physically recessed INTO the curved rock, with visible jagged walls and purple molten energy at its bottom, chipped bevels, bright lavender-white highlights, purple glow spilling onto nearby terrain. The letter must be clearly legible at thumbnail size; NOT an extruded letter, sticker, thin drawn stroke, floating type, printed decal or attached metal. A premium photorealistic VFX planet, not a cartoon or glossy toy. Use purple ONLY for colored light, not blue, gold or orange. Front three-quarter studio-like view with strong upper-left lighting. Exact engraved character: H (two upright vertical channels joined by a horizontal middle crossbar). Eroded dark amethyst rock cliffs, with a slender polished-chrome orbital ring tilted about 25 degrees rising to the right, correctly hidden behind the sphere at the back and crossing only below the letter at the front. Ensure full ring fits inside the image with at least 5% margin. Only the single H on the visible face.

### T

Use case: stylized-concept. Asset type: production companion planet for a cinematic SPNVISUALZ website star-flight. Input image 1 is a MATERIAL / PALETTE reference only: match its extremely detailed near-black volcanic rock, intense saturated ultraviolet-purple light, fissures, and bright violet atmospheric rim. Make one exclusive companion planet. Square image, perfectly centered spherical planet of diameter 76% of the image, generous pure-black #000000 empty background. No stars or nebula outside the silhouette, no ground, no shadows on a floor, no words, no watermark. The specified capital letter must be a BROAD DEEPLY ENGRAVED GEOLOGICAL CANYON physically recessed INTO the curved rock, with visible jagged walls and purple molten energy at its bottom, chipped bevels, bright lavender-white highlights, purple glow spilling onto nearby terrain. The letter must be clearly legible at thumbnail size; NOT an extruded letter, sticker, thin drawn stroke, floating type, printed decal or attached metal. A premium photorealistic VFX planet, not a cartoon or glossy toy. Use purple ONLY for colored light, not blue, gold or orange. Front three-quarter studio-like view with strong upper-left lighting. Exact engraved character: T (one wide horizontal top channel joined to one vertical channel descending through the center). Jagged black basalt with violet crystal seams and small craters, no orbital ring. Only the single T on the visible face.

## Verification

Run `node --test tests/intro.test.mjs` and `npm run build`.

The 14 deterministic tests cover N/H/T image mappings, shipped/preloaded assets, drawing at 390×844, 360×640, 1440×900 and 844×390, unloaded images, reduced motion, repeat visits, skip/enter/keyboard exits and duplicate animation startup. These are script-level tests with a simulated canvas, not screenshots of real devices.
