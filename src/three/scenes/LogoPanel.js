import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  WebGLRenderer
} from "three";

// A Selected Work panel whose contents are rendered live in 3D rather than
// played back as a video file.
//
// The source artwork for these marks is excellent, but delivering it as a
// compressed web video is what made it look cheap: gradients band, the
// glow blocks up, and every replay carries a seam. Rendering the mark as
// real geometry instead means it is resolution-independent (it stays sharp
// at any device pixel ratio), costs a single ~200KB still instead of
// megabytes of video, and loops perfectly because the motion is
// procedural — there is no last frame to rejoin.
//
// The mark itself is the client's own artwork, alpha-keyed from the
// delivered piece. Nothing here invents or redraws it; the code supplies
// the lighting, depth and motion around it.

// Stacked copies of the mark, each a little further back and darker, read
// as a solid extruded object once the group turns. Cheaper and steadier
// than tessellating the artwork into real geometry, and it keeps the
// original artwork's exact silhouette.
const DEPTH_LAYERS = 16;
const DEPTH_STEP = 0.013;

const sweepVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// A soft diagonal band of light travelling across the face, masked by the
// artwork's own alpha so it only ever lights the mark, never the panel.
const sweepFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.01) discard;

    float travel = fract(uTime * 0.12);
    float band = vUv.x * 0.75 + vUv.y * 0.25;
    float d = abs(band - (travel * 2.0 - 0.5));
    float highlight = smoothstep(0.22, 0.0, d);

    // Luminance keeps the sweep on the metal itself rather than washing
    // the whole silhouette.
    float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
    float amount = highlight * smoothstep(0.25, 0.9, lum);

    gl_FragColor = vec4(uColor * amount * tex.a, tex.a * amount);
  }
`;

export function mountLogoPanel(container, { src, tint = "#ffe6b0", spin = 0.32 } = {}) {
  if (!container) return null;

  const canvas = document.createElement("canvas");
  canvas.className = "logo-panel__canvas";
  container.appendChild(canvas);

  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    // No WebGL: the panel keeps whatever static image it already shows.
    canvas.remove();
    return null;
  }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 40);
  camera.position.set(0, 0, 6.4);

  const group = new Group();
  scene.add(group);

  const loader = new TextureLoader();
  const layers = [];
  let sweep = null;
  let ready = false;

  loader.load(src, (texture) => {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const iw = texture.image?.width || 1;
    const ih = texture.image?.height || 1;
    const h = 3.1;
    const w = h * (iw / ih);
    const geometry = new PlaneGeometry(w, h);

    // Back-to-front so the nearest copy is drawn last.
    for (let i = DEPTH_LAYERS - 1; i >= 0; i--) {
      const t = i / (DEPTH_LAYERS - 1); // 1 = deepest
      const material = new MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        // The deeper copies darken into the object's own shadowed side.
        color: new Color().setScalar(1 - t * 0.82)
      });
      const mesh = new Mesh(geometry, material);
      mesh.position.z = -t * DEPTH_STEP * DEPTH_LAYERS;
      group.add(mesh);
      layers.push({ mesh, material });
    }

    sweep = new Mesh(
      geometry,
      new ShaderMaterial({
        vertexShader: sweepVertex,
        fragmentShader: sweepFragment,
        uniforms: {
          uMap: { value: texture },
          uTime: { value: 0 },
          uColor: { value: new Color(tint) }
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending
      })
    );
    sweep.position.z = 0.02;
    group.add(sweep);

    ready = true;
    resize();
  });

  const size = new Vector2();
  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    size.set(w, h);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // Only spend frames on this while it is actually on screen.
  let visible = false;
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { visible = e.isIntersecting; }),
    { threshold: 0.05 }
  );
  io.observe(container);

  let raf = 0;
  let last = performance.now();
  let elapsed = 0;

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || !ready || document.hidden) return;

    elapsed += dt;
    // A slow oscillation rather than a full spin: the mark stays legible
    // and readable as a logo the whole time, while still turning enough
    // to show real depth.
    group.rotation.y = Math.sin(elapsed * spin) * 0.55;
    group.rotation.x = Math.sin(elapsed * spin * 0.6) * 0.09;
    group.position.y = Math.sin(elapsed * spin * 0.8) * 0.05;

    if (sweep) sweep.material.uniforms.uTime.value = elapsed;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      layers.forEach(({ mesh, material }) => { mesh.geometry.dispose(); material.dispose(); });
      if (sweep) { sweep.material.uniforms.uMap.value?.dispose(); sweep.material.dispose(); }
      renderer.dispose();
      canvas.remove();
    }
  };
}
