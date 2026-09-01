import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  VideoTexture,
  TextureLoader,
  LinearFilter,
  SRGBColorSpace,
  Color
} from "three";

// Selected Work as real geometry: each project is a video-textured plane
// placed at its own depth/offset/rotation in the world the camera dollies
// through, instead of a DOM crossfade pretending to be spatial. Every plane
// shows its real poster frame (a cheap static image) always — only the
// plane nearest the camera's focus point ever gets its *video* actually
// playing, so decode cost never exceeds one clip regardless of how many
// planes are visible at once.
const PLANE_ASPECT = 16 / 9;
const PLANE_WIDTH = 4.6;
const textureLoader = new TextureLoader();

export class WorkField {
  constructor(projects, { spacing = 5.6, startZ = 0 } = {}) {
    this.spacing = spacing;
    this.startZ = startZ;
    this.group = new Group();
    this.items = projects.map((project, index) => this._buildItem(project, index));
    this.items.forEach((item) => this.group.add(item.mesh));
    this.activeIndex = -1;
  }

  _buildItem(project, index) {
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

    const geometry = new PlaneGeometry(PLANE_WIDTH, PLANE_WIDTH / PLANE_ASPECT, 1, 1);
    const material = new MeshBasicMaterial({ map: null, color: new Color(0x050308), toneMapped: false });
    const mesh = new Mesh(geometry, material);

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
    // in y, mild rotation so planes read as floating in space rather than
    // lined up like a slideshow.
    const side = index % 2 === 0 ? 1 : -1;
    const depth = this.startZ - index * this.spacing;
    mesh.position.set(side * 1.5, Math.sin(index * 1.7) * 0.5, depth);
    mesh.rotation.y = side * -0.36;
    mesh.rotation.z = Math.sin(index * 2.3) * 0.04;

    return { project, video, videoTexture, mesh, material, depth, videoBound: false };
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

  // cameraZ: current world-space camera Z. Focus is whichever plane's
  // depth is closest to (cameraZ - focusOffset).
  update(cameraZ, focusOffset = -1.5) {
    const focusZ = cameraZ + focusOffset;
    let nearestIndex = -1;
    let nearestDist = Infinity;
    this.items.forEach((item, i) => {
      const d = Math.abs(item.depth - focusZ);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIndex = i;
      }
      // Depth cueing: the focused plane sits notably larger/brighter than
      // its neighbors so "which one is active" reads at a glance.
      const settle = 1 - Math.min(1, d / 5);
      const scale = 0.72 + settle * 0.42;
      item.mesh.scale.setScalar(scale);
    });

    if (nearestIndex !== this.activeIndex && nearestDist < 3.4) {
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
      item.mesh.geometry.dispose();
      item.material.dispose();
      item.videoTexture.dispose();
      item.material.posterTexture?.dispose();
      item.video.src = "";
    });
  }
}
