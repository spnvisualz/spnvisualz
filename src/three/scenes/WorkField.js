import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  VideoTexture,
  TextureLoader,
  LinearFilter,
  SRGBColorSpace,
  Color
} from "three";

// Selected Work as real geometry: each project is a video-textured panel,
// held in a thin frame, placed at its own depth/offset in the world the
// camera dollies through — instead of a DOM crossfade pretending to be
// spatial. Every panel always shows its real poster image; only the panel
// nearest the camera's focus point ever gets its *video* actually playing,
// so decode cost never exceeds one clip regardless of scroll speed.
//
// Deliberately framed SMALLER than the viewport and viewed from further
// back than the first pass: filling the frame edge-to-edge exaggerated
// this footage's real web-video compression into something that read as
// "bad quality." A well-composed, correctly-aspected panel with visible
// space around it reads as curated regardless of source resolution.
const PANEL_WIDTH = 2.5;
const FRAME_MARGIN = 0.045;
const textureLoader = new TextureLoader();

export class WorkField {
  constructor(projects, {
    spacing = 5.6,
    startZ = 0,
    lateralSpread = 1,
    sizeBoost = 1,
    preferMobileVideo = false,
    slideAmplitude = 1.05
  } = {}) {
    this.spacing = spacing;
    this.startZ = startZ;
    this.preferMobileVideo = preferMobileVideo;
    // How far a panel travels side-to-side across its screen time. Kept
    // small (close to the original static offset) on desktop, where a
    // full cross-screen sweep read as chaotic on a composition that was
    // already working well — the wide slide is a narrow/portrait-aspect
    // fix (see SceneDirector), not a universal one.
    this.slideAmplitude = slideAmplitude;
    // lateralSpread scales the side-to-side offset/rotation each panel
    // gets. At 1 (desktop) panels alternate left/right like a gallery
    // wall. Narrower viewports pass a smaller value — off-axis panels
    // under a narrow FOV can appear larger than the true nearest one
    // (perspective foreshortening), making "which one is active" visually
    // ambiguous. Centering them keeps depth the only thing that matters.
    this.lateralSpread = lateralSpread;
    // The aspect-compensation in SceneDirector (pushing panels further
    // back so apparent width-vs-viewport stays constant across aspects)
    // shrinks a portrait phone's *area* far more than its width, since a
    // phone has much more spare vertical room than a 16:9 desktop — the
    // focused panel read as a small thumbnail lost in empty space rather
    // than a held gallery piece. sizeBoost (>1 on narrow aspects, passed
    // in by SceneDirector) enlarges the panel geometry itself to claw
    // back some of that, deliberately less than the full distance
    // increase so it stays a "pulled back" composition, not a reversion
    // to the original zoomed-in complaint.
    this.sizeBoost = sizeBoost;
    this.group = new Group();
    this.items = projects.map((project, index) => this._buildItem(project, index));
    this.items.forEach((item) => this.group.add(item.mesh));
    this.activeIndex = -1;
  }

  _buildItem(project, index) {
    const aspect = project.aspect || 16 / 9;
    const width = PANEL_WIDTH * this.sizeBoost;
    const height = width / aspect;

    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "none";
    video.crossOrigin = "anonymous";
    video.src = (this.preferMobileVideo && project.videoMobile) || project.video;

    const videoTexture = new VideoTexture(video);
    videoTexture.minFilter = LinearFilter;
    videoTexture.magFilter = LinearFilter;
    videoTexture.colorSpace = SRGBColorSpace;

    const mesh = new Group();

    const panelGeometry = new PlaneGeometry(width, height, 1, 1);
    const material = new MeshBasicMaterial({ map: null, color: new Color(0x050308), toneMapped: false });
    const panel = new Mesh(panelGeometry, material);
    mesh.add(panel);

    // A thin glowing outline held slightly in front — reads as a held
    // frame/slide rather than a flat crop of raw footage.
    const margin = FRAME_MARGIN * this.sizeBoost;
    const frameGeometry = new PlaneGeometry(width + margin, height + margin);
    const frameEdges = new EdgesGeometry(frameGeometry);
    const frameMaterial = new LineBasicMaterial({ color: 0xc6a7ff, transparent: true, opacity: 0.55 });
    const frame = new LineSegments(frameEdges, frameMaterial);
    frame.position.z = 0.01;
    mesh.add(frame);

    textureLoader.load(project.poster, (tex) => {
      tex.colorSpace = SRGBColorSpace;
      if (!material.map) {
        material.map = tex;
        // material.color multiplies the texture — it's only a near-black
        // placeholder tint for the brief window before a texture exists.
        // Leaving it dark after a real texture loads would silently crush
        // every plane toward black regardless of the source video/image.
        material.color.set(0xffffff);
        material.needsUpdate = true;
      }
      material.posterTexture = tex;
    });

    // Deterministic-but-varied placement: alternating sides, gentle drift
    // in y, mild rotation so panels read as floating in space rather than
    // lined up like a slideshow. X is re-driven every frame in update() —
    // this is just the resting position before the first update() call.
    const side = index % 2 === 0 ? 1 : -1;
    const depth = this.startZ - index * this.spacing;
    const baseY = Math.sin(index * 1.7) * 0.4 * this.lateralSpread;
    mesh.position.set(side * this.slideAmplitude, baseY, depth);
    mesh.rotation.y = side * -0.22 * this.lateralSpread;
    mesh.rotation.z = Math.sin(index * 2.3) * 0.025 * this.lateralSpread;

    return { project, video, videoTexture, mesh, panel, frameMaterial, material, depth, side, baseY, videoBound: false, videoReadyHandler: null };
  }

  // `_setActive` calls video.play() the instant a panel gains focus, but a
  // freshly-`preload="none"` video has zero decoded frames at that point —
  // on a fast local server the fetch finishes within a frame or two and
  // this is invisible, but over a real network it can take seconds, during
  // which a VideoTexture with no data samples as solid black. That read as
  // the whole panel silently failing to render rather than "loading" — it
  // showed instantly in every local/dev test and only over the real
  // network in production. Keeping the poster bound until the video
  // actually has a decodable frame (readyState >= HAVE_CURRENT_DATA)
  // guarantees something is always visible regardless of connection speed.
  _bindVideoTexture(item) {
    if (item.videoBound) return;
    item.videoBound = true;
    const swap = () => {
      item.material.map = item.videoTexture;
      item.material.color.set(0xffffff);
      item.material.needsUpdate = true;
    };
    if (item.video.readyState >= 2) {
      swap();
    } else {
      item.videoReadyHandler = swap;
      item.video.addEventListener("loadeddata", swap, { once: true });
    }
  }

  _deactivateVideo(item) {
    const finish = () => {
      // A later _setActive may have already reactivated this same item
      // (rapid back-and-forth scroll) by the time a pending play()
      // settles — don't pause/unbind out from under it.
      if (this.items[this.activeIndex] === item) return;
      item.video.pause();
      this._unbindVideoTexture(item);
    };
    if (item.playPromise) {
      item.playPromise.then(finish, finish);
    } else {
      finish();
    }
  }

  _unbindVideoTexture(item) {
    if (item.videoReadyHandler) {
      item.video.removeEventListener("loadeddata", item.videoReadyHandler);
      item.videoReadyHandler = null;
    }
    if (!item.videoBound) return;
    if (item.material.posterTexture) item.material.map = item.material.posterTexture;
    item.material.needsUpdate = true;
    item.videoBound = false;
    // Every project's VideoTexture stays alive for the whole page session
    // (only one is ever bound to a material, but all 9 objects exist from
    // construction). Once GPU-uploaded, a texture's memory isn't freed
    // just because the material stopped pointing at it — nine uploaded
    // 1080p video frames is real pressure on a phone GPU, a plausible
    // contributor to the reported "scene freezes solid" failures.
    // Disposing here releases that panel's GPU texture the moment it's no
    // longer the one on screen; Three.js re-uploads automatically from
    // the still-intact <video> element the next time this panel binds.
    item.videoTexture.dispose();
  }

  // cameraZ: current world-space camera Z. Focus is whichever panel's
  // depth is closest to (cameraZ - focusOffset). falloffTightness > 1
  // makes neighboring panels recede faster — on a narrow/portrait
  // viewport several simultaneously-visible neighbors read as clutter
  // (there's no room for a "gallery wall" the way there is on desktop),
  // so mobile passes a tighter falloff to keep one clear focal panel.
  //
  // The falloff radius and activation gate are both derived from
  // this.spacing rather than fixed constants — they were hardcoded
  // desktop-tuned numbers (5 and 3.4) in an earlier version, which broke
  // badly once mobile's aspect-compensated spacing grew ~3.5x: the gate
  // almost never opened (activeIndex stayed stuck on whatever it was at
  // construction) while a physically-closer neighbor, already past the
  // saturated falloff radius, rendered larger via plain perspective —
  // two different panels disagreeing about which one was "active".
  // workProgress: 0..1 fraction of the way through Selected Work, driven
  // directly by scroll (see SceneDirector). This is the sole source of
  // which project is active/playing — a simple, always-well-defined
  // mapping that can never fail to trigger. The panels' visual
  // position/scale (below) still comes from comparing 3D depths against
  // the camera, which is a richer effect but was fragile enough as an
  // *activation* signal (any drift between camera Z and panel depth could
  // mean no panel is ever "close enough" to activate) that it had caused
  // real, repeated "video never plays" failures. Decoupling the two means
  // a video always plays somewhere, regardless of any visual-positioning
  // edge case.
  update(cameraZ, workProgress, focusOffset = -7.2, falloffTightness = 1) {
    const focusZ = cameraZ + focusOffset;
    const falloffRadius = this.spacing * 0.85;
    // How much scroll-depth the full side-to-side slide spans. Smaller
    // than `spacing` so a panel has fully arrived at center before the
    // next one starts sliding in behind it, rather than the two crossing
    // mid-slide.
    const slideRange = this.spacing * 0.85;
    const amplitude = this.slideAmplitude;
    this.items.forEach((item) => {
      const d = Math.abs(item.depth - focusZ);
      // Depth cueing: the focused panel sits notably larger/brighter than
      // its neighbors so "which one is active" reads at a glance, without
      // any single panel ever filling the whole frame. A power curve (not
      // a linear one scaled by tightness) keeps settle pinned at 1 when
      // d=0 regardless of falloffTightness — only the *rate* neighbors
      // recede changes, so the active panel never shrinks just because
      // scroll landed a fraction off dead-center.
      const linear = 1 - Math.min(1, d / falloffRadius);
      const settle = Math.pow(linear, falloffTightness);
      // Live feedback: growing almost to full scale read as "zooming
      // completely in" on a panel as the camera passed it. The slide (below)
      // is now the primary sense of motion through a project — scale only
      // adds a light emphasis on top of that, not the main effect.
      const scale = 0.72 + settle * 0.32;
      item.mesh.scale.setScalar(scale);
      item.frameMaterial.opacity = 0.18 + settle * 0.5;

      // Signed distance from focus: negative while the panel is still
      // ahead (not yet reached), positive once the camera has passed it.
      // Panels enter from their designated side, cross toward center as
      // the camera nears, and continue sliding out the *opposite* side as
      // it moves on — a continuous lateral pass rather than a still,
      // centered object that merely grows and shrinks in place.
      const signedD = item.depth - focusZ;
      const slideT = Math.max(-1, Math.min(1, signedD / slideRange));
      item.mesh.position.x = -item.side * amplitude * slideT;
    });

    // Guaranteed valid for any workProgress in [0,1]: at most the last
    // index, never -1, never NaN. No gate, no "close enough" threshold —
    // scroll progress always maps to exactly one active project.
    const targetIndex = Math.min(this.items.length - 1, Math.floor(workProgress * this.items.length));
    if (targetIndex !== this.activeIndex) {
      this._setActive(targetIndex);
    }
  }

  _setActive(index) {
    const prev = this.items[this.activeIndex];
    if (prev) this._deactivateVideo(prev);
    this.activeIndex = index;
    const next = this.items[index];
    if (!next) return;
    this._bindVideoTexture(next);
    // play() is async — calling pause() while it's still settling is a
    // well-known browser race ("play() request was interrupted by a call
    // to pause()") that can leave a <video> refusing to produce further
    // frames until reloaded. Fast scrolling or a menu jump fires
    // activate/deactivate in quick succession, hitting this constantly;
    // item 0 hit it hardest of all since it can activate within the very
    // first frames of boot, right as everything else is still
    // initializing. Tracking the promise lets deactivation wait for it.
    next.playPromise = next.video.play();
    next.playPromise?.catch(() => {});
  }

  getActiveProject() {
    return this.items[this.activeIndex]?.project || null;
  }

  getActiveScreenPosition(camera) {
    const item = this.items[this.activeIndex];
    if (!item) return null;
    const v = item.mesh.position.clone().project(camera);
    return { x: (v.x * 0.5 + 0.5), y: (1 - (v.y * 0.5 + 0.5)) };
  }

  totalDepth() {
    return this.items.length * this.spacing;
  }

  dispose() {
    this.items.forEach((item) => {
      item.panel.geometry.dispose();
      item.material.dispose();
      item.videoTexture.dispose();
      item.material.posterTexture?.dispose();
      item.frameMaterial.dispose();
      item.video.src = "";
    });
  }
}
