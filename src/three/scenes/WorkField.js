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
  constructor(projects, { spacing = 5.6, startZ = 0, lateralSpread = 1 } = {}) {
    this.spacing = spacing;
    this.startZ = startZ;
    // lateralSpread scales the side-to-side offset/rotation each panel
    // gets. At 1 (desktop) panels alternate left/right like a gallery
    // wall. Narrower viewports pass a smaller value — off-axis panels
    // under a narrow FOV can appear larger than the true nearest one
    // (perspective foreshortening), making "which one is active" visually
    // ambiguous. Centering them keeps depth the only thing that matters.
    this.lateralSpread = lateralSpread;
    this.group = new Group();
    this.items = projects.map((project, index) => this._buildItem(project, index));
    this.items.forEach((item) => this.group.add(item.mesh));
    this.activeIndex = -1;
  }

  _buildItem(project, index) {
    const aspect = project.aspect || 16 / 9;
    const width = PANEL_WIDTH;
    const height = PANEL_WIDTH / aspect;

    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "none";
    video.crossOrigin = "anonymous";
    video.src = project.video;

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
    const frameGeometry = new PlaneGeometry(width + FRAME_MARGIN, height + FRAME_MARGIN);
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
    // lined up like a slideshow.
    const side = index % 2 === 0 ? 1 : -1;
    const depth = this.startZ - index * this.spacing;
    mesh.position.set(
      side * 1.05 * this.lateralSpread,
      Math.sin(index * 1.7) * 0.4 * this.lateralSpread,
      depth
    );
    mesh.rotation.y = side * -0.22 * this.lateralSpread;
    mesh.rotation.z = Math.sin(index * 2.3) * 0.025 * this.lateralSpread;

    return { project, video, videoTexture, mesh, panel, frameMaterial, material, depth, videoBound: false };
  }

  _bindVideoTexture(item) {
    if (item.videoBound) return;
    item.material.map = item.videoTexture;
    item.material.color.set(0xffffff);
    item.material.needsUpdate = true;
    item.videoBound = true;
  }

  _unbindVideoTexture(item) {
    if (!item.videoBound) return;
    if (item.material.posterTexture) item.material.map = item.material.posterTexture;
    item.material.needsUpdate = true;
    item.videoBound = false;
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
  update(cameraZ, focusOffset = -7.2, falloffTightness = 1) {
    const focusZ = cameraZ + focusOffset;
    const falloffRadius = this.spacing * 0.85;
    const activationGate = this.spacing * 0.55;
    let nearestIndex = -1;
    let nearestDist = Infinity;
    this.items.forEach((item, i) => {
      const d = Math.abs(item.depth - focusZ);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIndex = i;
      }
      // Depth cueing: the focused panel sits notably larger/brighter than
      // its neighbors so "which one is active" reads at a glance, without
      // any single panel ever filling the whole frame. A power curve (not
      // a linear one scaled by tightness) keeps settle pinned at 1 when
      // d=0 regardless of falloffTightness — only the *rate* neighbors
      // recede changes, so the active panel never shrinks just because
      // scroll landed a fraction off dead-center.
      const linear = 1 - Math.min(1, d / falloffRadius);
      const settle = Math.pow(linear, falloffTightness);
      const scale = 0.62 + settle * 0.5;
      item.mesh.scale.setScalar(scale);
      item.frameMaterial.opacity = 0.18 + settle * 0.5;
    });

    if (nearestIndex !== this.activeIndex && nearestDist < activationGate) {
      this._setActive(nearestIndex);
    }
  }

  _setActive(index) {
    const prev = this.items[this.activeIndex];
    if (prev) {
      prev.video.pause();
      this._unbindVideoTexture(prev);
    }
    this.activeIndex = index;
    const next = this.items[index];
    if (!next) return;
    this._bindVideoTexture(next);
    next.video.play().catch(() => {});
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
