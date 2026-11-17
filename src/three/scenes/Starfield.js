import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineSegments,
  Points,
  ShaderMaterial
} from "three";

// Deep space behind the whole page.
//
// A tunnel of stars the camera travels down as the visitor scrolls: real
// perspective, so near stars rush past while far ones barely move — the
// parallax comes from depth, not from hand-tuned speeds. Scroll fast and
// every star draws a streak behind it (warp); scroll back and they stream
// the other way. One draw call for the points, one for the streaks.
//
// The tunnel is DEPTH units long and wraps in the vertex shader, so the
// journey never runs out however long the page gets.

const DEPTH = 140;

const shared = /* glsl */ `
  uniform float uTravel;
  uniform float uWarp;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uOpacity;
  attribute float aSeed;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  const float DEPTH = ${DEPTH.toFixed(1)};

  vec3 place(vec3 p) {
    p.z = mod(p.z + uTravel, DEPTH) - DEPTH + 9.5;
    return p;
  }
  float fade(float dist) {
    float near = smoothstep(0.3, 3.5, dist);
    float far = 1.0 - smoothstep(55.0, 128.0, dist);
    return near * far;
  }
`;

const pointsVertex = /* glsl */ `
  ${shared}
  void main() {
    vec3 p = place(position);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.72 + 0.28 * sin(uTime * (0.8 + aSeed * 2.4) + aSeed * 41.0);
    vAlpha = fade(dist) * twinkle * uOpacity;
    vColor = aColor;
    gl_PointSize = clamp((1.0 + aSeed * 2.4) * uPixelRatio * (26.0 / max(dist, 1.0)), 1.0, 16.0);
  }
`;

const pointsFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, core * core * vAlpha);
  }
`;

const streakVertex = /* glsl */ `
  ${shared}
  attribute float aEnd;
  void main() {
    vec3 p = place(position);
    // the tail trails behind the direction of travel
    p.z -= aEnd * uWarp * (5.0 + aSeed * 12.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = fade(-mv.z) * abs(uWarp) * (1.0 - aEnd) * 0.6 * uOpacity;
    vColor = aColor;
  }
`;

const streakFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() { gl_FragColor = vec4(vColor, vAlpha); }
`;

const PALETTE = [
  { weight: 0.68, color: [0.93, 0.91, 1.0] }, // starlight
  { weight: 0.24, color: [0.78, 0.64, 1.0] }, // brand violet
  { weight: 0.08, color: [1.0, 0.84, 0.58] } // the gold accent
];

function pick(r) {
  let acc = 0;
  for (const entry of PALETTE) {
    acc += entry.weight;
    if (r <= acc) return entry.color;
  }
  return PALETTE[0].color;
}

export class Starfield {
  constructor({ count = 2400, pixelRatio = 1 } = {}) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // a hollow tunnel: nothing sits right on the axis, where the
      // page's own content is
      const r = 1.6 + Math.pow(Math.random(), 0.75) * 17;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r * 0.72;
      pos[i * 3 + 2] = -Math.random() * DEPTH;
      seed[i] = Math.random();
      const c = pick(Math.random());
      col.set(c, i * 3);
    }

    this.uniforms = {
      uTravel: { value: 0 },
      uWarp: { value: 0 },
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uOpacity: { value: 1 }
    };

    const pointsGeo = new BufferGeometry();
    pointsGeo.setAttribute("position", new Float32BufferAttribute(pos, 3));
    pointsGeo.setAttribute("aSeed", new Float32BufferAttribute(seed, 1));
    pointsGeo.setAttribute("aColor", new Float32BufferAttribute(col, 3));
    const points = new Points(
      pointsGeo,
      new ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: pointsVertex,
        fragmentShader: pointsFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending
      })
    );

    // Streaks: each star twice, head (aEnd 0) and tail (aEnd 1).
    const sPos = new Float32Array(count * 6);
    const sSeed = new Float32Array(count * 2);
    const sCol = new Float32Array(count * 6);
    const sEnd = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 2; k++) {
        const v = i * 2 + k;
        sPos.set(pos.subarray(i * 3, i * 3 + 3), v * 3);
        sCol.set(col.subarray(i * 3, i * 3 + 3), v * 3);
        sSeed[v] = seed[i];
        sEnd[v] = k;
      }
    }
    const streakGeo = new BufferGeometry();
    streakGeo.setAttribute("position", new Float32BufferAttribute(sPos, 3));
    streakGeo.setAttribute("aSeed", new Float32BufferAttribute(sSeed, 1));
    streakGeo.setAttribute("aColor", new Float32BufferAttribute(sCol, 3));
    streakGeo.setAttribute("aEnd", new Float32BufferAttribute(sEnd, 1));
    const streaks = new LineSegments(
      streakGeo,
      new ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: streakVertex,
        fragmentShader: streakFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending
      })
    );

    // Neither moves as an object (the motion is in the shader), so their
    // bounds would be wrong for culling.
    points.frustumCulled = false;
    streaks.frustumCulled = false;
    points.renderOrder = -2;
    streaks.renderOrder = -2;

    this.group = new Group();
    this.group.add(points, streaks);
    this.streaks = streaks;
    this._warp = 0;
  }

  // travel: how far down the tunnel (world units); velocity: scroll speed
  // in px per frame, from Lenis.
  tick(dt, elapsed, { travel, velocity }) {
    // Reading speed stays calm; only a real flick of the wheel or thumb
    // pulls the stars into streaks.
    const s = Math.min(1, Math.max(0, Math.abs(velocity) - 7) / 34);
    const target = Math.sign(velocity) * s * s * (3 - 2 * s);
    this._warp += (target - this._warp) * Math.min(1, dt * 6);
    this.uniforms.uWarp.value = this._warp;
    this.uniforms.uTravel.value = travel;
    this.uniforms.uTime.value = elapsed;
    this.streaks.visible = Math.abs(this._warp) > 0.02;
  }

  setOpacity(value) {
    this.uniforms.uOpacity.value = value;
  }
}
