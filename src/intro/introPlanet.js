import {
  CanvasTexture,
  Color,
  LinearFilter,
  Mesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Group,
  WebGLRenderer
} from "three";

// SPN-1, as actual geometry.
//
// The intro used to land on spn-orbit-transparent.png — a flat sprite at
// the end of a 3D flight, which is exactly the seam you notice. This is
// the same object built as a real sphere and real rings so it holds up
// while it grows, turns and catches light.
//
// Reading the brand art rather than approximating it: the "S" is not a
// glowing decal painted on the planet. It is a raised chrome ridge, and
// what makes it read is that it bends the reflection — the mark catches
// the studio lights at a different angle from the body around it. So the
// mark is authored as a height mask and perturbs the normal, instead of
// being added as emissive colour. The rings are two concentric chrome
// tubes, which is what produces the pair of parallel highlights where
// the ring crosses in front of the planet in the reference.
//
// Everything is shaded in view space. The camera sits at the origin
// there, so the "studio" the chrome reflects is fixed to the viewer the
// way a product render's lighting rig is, rather than swimming as the
// object turns.

const SPHERE_SEGMENTS = 96;
const EXTENT = 1.72;          // how much of the requested width the object fills

// The studio the chrome reflects: a dark violet ground with a few bright
// horizontal softboxes. Shared by the body and the rings so they read as
// being in the same room.
const NOISE_GLSL = /* glsl */ `
float h31(vec3 p){ return fract(sin(dot(p, vec3(27.1, 61.7, 12.4))) * 43758.5453); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x),
                 mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x),
                 mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += vnoise(p) * a; p *= 2.03; a *= 0.5; }
  return s;
}
`;

const STUDIO_GLSL = /* glsl */ `
vec3 studio(vec3 d) {
  float h = d.y * 0.5 + 0.5;
  // Near-black room. The body is polished black glass, so almost all of
  // its visible detail is a reflected light, not ambient fill — lift the
  // sky and it immediately turns into flat purple plastic.
  vec3 sky = mix(vec3(0.003, 0.002, 0.008), vec3(0.018, 0.016, 0.032), h);
  float bands = 0.0;
  bands += smoothstep(0.085, 0.0, abs(d.y - 0.54)) * 1.60;
  bands += smoothstep(0.055, 0.0, abs(d.y - 0.04)) * 0.75;
  bands += smoothstep(0.045, 0.0, abs(d.y + 0.44)) * 0.55;
  vec3 tint = mix(vec3(0.96, 0.94, 1.00), vec3(0.70, 0.56, 1.00),
                  0.40 + 0.40 * sin(d.x * 2.6));
  return sky + tint * bands;
}
`;

// ---------------------------------------------------------------- the mark
//
// Drawn as a tapered ribbon along a Catmull-Rom spine rather than a
// stroked path, because the reference mark is visibly thicker through
// its middle than at its terminals and a uniform stroke loses that.
function makeMarkTexture(size = 1024) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.clearRect(0, 0, size, size);

  // Spine of the S in unit space, terminals first. Tuned against
  // spn-orbit-transparent.png: the top bowl opens down-left, the bottom
  // bowl opens up-right, and the whole figure leans slightly right.
  // An italic monogram S, traced from the reference: hairline terminals
  // that curl at both ends, heavy diagonal bellies, and the very high
  // stroke contrast of a Didone italic. Read top-terminal-first.
  const spine = [
    [0.700, 0.268],   // top terminal — tip of the hairline hook
    [0.716, 0.222],
    [0.700, 0.180],
    [0.650, 0.156],
    [0.580, 0.152],   // over the top of the upper bowl
    [0.492, 0.184],
    [0.412, 0.246],
    [0.378, 0.322],   // upper bowl, thickening
    [0.408, 0.396],
    [0.492, 0.458],   // the heavy middle diagonal
    [0.578, 0.520],
    [0.640, 0.590],
    [0.662, 0.672],   // lower belly
    [0.626, 0.752],
    [0.542, 0.808],
    [0.442, 0.828],   // under the bottom of the lower bowl
    [0.354, 0.812],
    [0.310, 0.772],
    [0.302, 0.726]    // bottom terminal — tip of the hairline hook
  ];

  // Fraction of the disc the figure is allowed to occupy. Texture space
  // maps near-linearly across the silhouette, so this reads directly as
  // "how much of the planet the mark covers".
  const FIT = 0.87;
  const fit = ([x, y]) => [0.5 + (x - 0.5) * FIT, 0.5 + (y - 0.5) * FIT];

  const at = (t) => {
    // Catmull-Rom through the control points.
    const n = spine.length - 1;
    const f = Math.min(0.9999, Math.max(0, t)) * n;
    const i = Math.floor(f);
    const u = f - i;
    const p = (k) => fit(spine[Math.min(n, Math.max(0, k))]);
    const [x0, y0] = p(i - 1), [x1, y1] = p(i), [x2, y2] = p(i + 1), [x3, y3] = p(i + 2);
    const h = (a, b, cc, d) =>
      0.5 * ((2 * b) + (-a + cc) * u + (2 * a - 5 * b + 4 * cc - d) * u * u + (-a + 3 * b - 3 * cc + d) * u * u * u);
    return [h(x0, x1, x2, x3), h(y0, y1, y2, y3)];
  };

  // Stroke contrast is what makes this read as a written letter rather
  // than a drawn ribbon: the two hooks stay hairline while the diagonal
  // through the middle carries roughly seven times their weight.
  const widthAt = (t) => {
    const b = Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.20) / 0.68)));
    return (0.0122 + 0.0640 * Math.pow(b, 1.1)) * FIT;
  };

  const STEPS = 400;
  const left = [];
  const right = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const [x, y] = at(t);
    const [xa, ya] = at(Math.max(0, t - 0.004));
    const [xb, yb] = at(Math.min(1, t + 0.004));
    const dx = xb - xa, dy = yb - ya;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const w = widthAt(t);
    left.push([(x + nx * w) * size, (y + ny * w) * size]);
    right.push([(x - nx * w) * size, (y - ny * w) * size]);
  }

  const ribbon = () => {
    g.beginPath();
    left.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
    for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
    g.closePath();
  };

  // Violet halo, then a hot core — the layering the reference shows where
  // the ridge catches the key light.
  g.save();
  g.filter = `blur(${Math.round(size * 0.008)}px)`;
  g.fillStyle = "rgba(158,104,255,0.95)";
  ribbon();
  g.fill();
  g.restore();

  g.save();
  g.filter = `blur(${Math.round(size * 0.002)}px)`;
  g.fillStyle = "rgba(255,252,255,1)";
  ribbon();
  g.fill();
  g.restore();

  const tex = new CanvasTexture(c);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const BODY_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
varying vec3 vObj;
void main() {
  vN = normalize(normalMatrix * normal);
  vObj = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vP = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const BODY_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMark;
uniform float uRidge;
uniform float uMarkFade;
varying vec3 vN;
varying vec3 vP;
varying vec3 vObj;
${NOISE_GLSL}
${STUDIO_GLSL}

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(-vP);

  // The mark lives on the facing hemisphere. Sampling by the view-space
  // normal's xy maps the texture square to the silhouette disc, so the
  // figure compresses toward the limb exactly as it would if it were on
  // the surface — no UV seam, no pole pinching.
  vec2 uv = N.xy * 0.5 + 0.5;
  float e = 0.0030;
  float m  = texture2D(uMark, uv).a;
  float mx = texture2D(uMark, uv + vec2(e, 0.0)).a - texture2D(uMark, uv - vec2(e, 0.0)).a;
  float my = texture2D(uMark, uv + vec2(0.0, e)).a - texture2D(uMark, uv - vec2(0.0, e)).a;

  float facing = smoothstep(0.02, 0.40, N.z) * uMarkFade;
  float core = smoothstep(0.40, 0.58, m) * facing;
  float halo = m * (1.0 - core) * facing;          // the bloom skirt
  vec3 Nr = normalize(N + vec3(-mx, -my, 0.0) * uRidge * facing);

  // Marbled crust. The reference planet is not a plain black ball — it is
  // dark stone shot through with violet veining, and without it the body
  // reads as flat vinyl no matter how the mark is lit.
  float marb = fbm(vObj * 3.1);
  float veins = smoothstep(0.52, 0.80, marb);
  float grain = smoothstep(0.30, 0.62, fbm(vObj * 9.0));

  vec3 L1 = normalize(vec3(-0.42, 0.60, 0.68));   // key, upper left
  vec3 L2 = normalize(vec3(0.58, -0.42, 0.70));   // cool fill, lower right
  float n1 = max(dot(Nr, normalize(L1 + V)), 0.0);
  float n2 = max(dot(Nr, normalize(L2 + V)), 0.0);
  float broad = pow(n1, 40.0) * 0.55;
  float hot   = pow(n1, 620.0) * 2.20;
  float fill  = pow(n2, 120.0) * 0.32;

  // How squarely the ridge faces the key — this is what puts the
  // white-hot points along the mark rather than lighting it evenly.
  float lit = pow(max(dot(Nr, L1), 0.0), 0.80);

  // Wide and bright. The brand art carries a heavy violet atmosphere all
  // the way around the limb; a tight rim reads as a black ball with a
  // pencil line on it.
  float fres = pow(1.0 - max(dot(N, V), 0.0), 5.6);

  vec3 col = vec3(0.006, 0.004, 0.014);
  col += vec3(0.13, 0.04, 0.34) * veins * 0.34;          // violet veining
  col += vec3(0.07, 0.06, 0.11) * grain * 0.13;          // stone grain
  col += studio(reflect(-V, Nr)) * 0.13;                 // a trace of room
  col += vec3(1.0, 0.99, 1.0) * (broad + hot + fill);

  // The mark is a light source, not a mirror. It is a violet trail with
  // white-hot points where it catches, and it throws a bloom onto the
  // surface around it. Shading it as chrome is what made it read grey
  // and cheap — it is emissive in the art, and this is the whole fix.
  // Emissive, not shaded. Tying the mark's base colour to how it faces a
  // lamp is what kept it looking like matte plastic — in the art it is a
  // light source of constant violet, and the lamps only add the white-hot
  // points that run along its length.
  col += vec3(0.62, 0.15, 1.00) * core * 2.35;                   // the trail
  col += vec3(1.00, 0.93, 1.00) * core * pow(lit, 5.0) * 2.45;   // hot points
  col += vec3(0.50, 0.13, 1.00) * halo * 2.70;                   // bloom
  col += vec3(0.50, 0.20, 1.00) * fres * 2.60;           // atmosphere

  col = col / (col + vec3(1.0));
  col = pow(max(col, vec3(0.0)), vec3(0.85));
  gl_FragColor = vec4(col, 1.0);
}
`;

const RING_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uTint;
uniform float uGain;
varying vec3 vN;
varying vec3 vP;
${STUDIO_GLSL}

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(-vP);
  vec3 R = reflect(-V, N);
  vec3 env = studio(R) * uGain;

  vec3 L = normalize(vec3(-0.40, 0.70, 0.58));
  vec3 Hv = normalize(L + V);
  float nh = max(dot(N, Hv), 0.0);
  float hot = pow(nh, 70.0) * 4.2;

  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.2);
  vec3 col = env + vec3(1.0, 0.98, 1.0) * hot + uTint * fres * 1.05;
  col = col / (col + vec3(1.0));
  col = pow(max(col, vec3(0.0)), vec3(0.85));
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createIntroPlanet(canvas) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  } catch (_) {
    return null;
  }
  if (!renderer) return null;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 7.4);

  const group = new Group();
  scene.add(group);

  const mark = makeMarkTexture(1024);
  const bodyMat = new ShaderMaterial({
    vertexShader: BODY_VERT,
    fragmentShader: BODY_FRAG,
    uniforms: {
      uMark: { value: mark },
      uRidge: { value: 1.45 },
      uMarkFade: { value: 1 }
    }
  });
  const body = new Mesh(new SphereGeometry(1, SPHERE_SEGMENTS, SPHERE_SEGMENTS), bodyMat);
  group.add(body);

  // Two concentric tubes, not one. The reference shows a pair of parallel
  // chrome highlights where the ring passes in front of the planet, which
  // a single tube cannot produce.
  const rings = new Group();
  const ringMat = (tint, gain) => new ShaderMaterial({
    vertexShader: BODY_VERT,
    fragmentShader: RING_FRAG,
    uniforms: { uTint: { value: new Color(tint) }, uGain: { value: gain } }
  });
  const hoop = new Mesh(new TorusGeometry(1.58, 0.078, 30, 240), ringMat(0xc3aaff, 8.5));
  rings.add(hoop);
  rings.rotation.set(1.300, 0, -0.50);
  group.add(rings);

  let cssW = 1;
  let cssH = 1;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = Math.max(1, window.innerWidth);
    cssH = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(dpr);
    renderer.setSize(cssW, cssH, false);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    camera.aspect = cssW / cssH;
    camera.updateProjectionMatrix();
  };
  resize();

  // World height visible at the origin, used to convert the pixel size
  // the intro asks for into a group scale.
  const visibleH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);

  return {
    resize,
    // widthPx: how wide the planet should read on screen, matching the
    // framing the 2D layer used before this existed.
    render(widthPx, progress, elapsed) {
      const k = (widthPx / cssH) * (visibleH / 2) / EXTENT;
      group.scale.setScalar(Math.max(0.0001, k));
      group.position.y = visibleH * 0.015;

      // Turns as it approaches and settles face-on, so the mark is
      // square to the viewer exactly when the flight stops.
      const settle = 1 - Math.pow(1 - Math.min(1, Math.max(0, progress)), 3);
      body.rotation.y = (1 - settle) * 1.9;
      body.rotation.x = (1 - settle) * 0.34 + Math.sin(elapsed * 0.45) * 0.022;
      rings.rotation.z = -0.50 + elapsed * 0.040;
      bodyMat.uniforms.uMarkFade.value = settle;

      renderer.render(scene, camera);
    },
    dispose() {
      body.geometry.dispose();
      bodyMat.dispose();
      mark.dispose();
      hoop.geometry.dispose();
      hoop.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
    }
  };
}
