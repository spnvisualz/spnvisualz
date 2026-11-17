import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry
} from "three";

// The hero's 3D piece: an orbital.
//
// Three polished chrome rings turning on different axes, like a gyroscope
// that never settles, around a dark glass core with a violet rim. Small
// points of light ride the rings the way the glints ride the ring on the
// SPNVISUALZ mark. Nothing here is a texture or an image: the chrome
// reads as chrome because it reflects a lit "studio" (studioEnvironment)
// built from a few emissive panels — white strips, a violet wash, a gold
// kicker — so every highlight on it is in the brand's own colours.

export function studioEnvironment(renderer) {
  const env = new Scene();
  env.background = new Color("#040208");
  const box = new BoxGeometry(1, 1, 1);
  const panel = (hex, intensity, position, size) => {
    const mesh = new Mesh(box, new MeshBasicMaterial({ color: new Color(hex).multiplyScalar(intensity) }));
    mesh.position.set(...position);
    mesh.scale.set(...size);
    env.add(mesh);
  };
  panel("#ffffff", 7, [0, 7, 1], [16, 0.5, 2.5]); // overhead key strip
  panel("#ffffff", 4.5, [-7, 0.5, -1], [0.35, 11, 2]); // left edge strip
  panel("#c6a7ff", 5.5, [7, -0.5, 0], [0.5, 11, 3]); // right violet strip
  panel("#8a4dff", 2.6, [0, -7, 0], [16, 0.4, 10]); // violet floor bounce
  panel("#e8c27a", 3.2, [4.5, 3.5, 7], [2.4, 1.6, 0.3]); // gold kicker
  panel("#2a1460", 1.3, [0, 0, -9], [18, 12, 0.3]); // deep violet back
  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromScene(env, 0.03);
  pmrem.dispose();
  box.dispose();
  return target.texture;
}

function glowTexture(inner, outer) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, outer);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

const rimVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
// The atmosphere: drawn on the back faces of a larger shell, brightest
// behind the core and falling away to nothing at the shell's own edge,
// so it reads as light rather than as a disc.
const hazeFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float f = pow(abs(dot(vNormal, vView)), 2.6);
    gl_FragColor = vec4(uColor, f * uStrength);
  }
`;
const rimFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float f = pow(1.0 - abs(dot(vNormal, vView)), 3.0);
    gl_FragColor = vec4(uColor, f * uStrength);
  }
`;

// [radius, tube, tilt x, tilt y, spin speed (rad/s) about x, about y]
const RINGS = [
  [1.62, 0.048, 1.15, 0.25, 0.16, 0.05],
  [1.3, 0.036, -0.55, 0.9, -0.11, 0.13],
  [1.02, 0.028, 0.35, -1.2, 0.09, -0.17]
];

export class Orbital {
  constructor({ envMap, detail = 1 } = {}) {
    this.group = new Group();
    this.tumble = new Group(); // pointer and scroll lean
    this.group.add(this.tumble);

    const chrome = new MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 1,
      roughness: 0.13,
      envMap,
      envMapIntensity: 1.3,
      clearcoat: 1,
      clearcoatRoughness: 0.06
    });

    // the core: dark glass with a violet rim
    const coreGeo = new SphereGeometry(0.6, Math.round(96 * detail), Math.round(64 * detail));
    const core = new Mesh(
      coreGeo,
      new MeshPhysicalMaterial({
        color: 0x07040e,
        metalness: 0.25,
        roughness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMap,
        envMapIntensity: 1.05
      })
    );
    const rim = new Mesh(
      coreGeo,
      new ShaderMaterial({
        uniforms: { uColor: { value: new Color("#b48cff") }, uStrength: { value: 1.25 } },
        vertexShader: rimVertex,
        fragmentShader: rimFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending
      })
    );
    rim.scale.setScalar(1.02);
    const halo = new Mesh(
      new SphereGeometry(0.6, 48, 32),
      new ShaderMaterial({
        uniforms: { uColor: { value: new Color("#7b3dff") }, uStrength: { value: 0.42 } },
        vertexShader: rimVertex,
        fragmentShader: hazeFragment,
        transparent: true,
        depthWrite: false,
        side: BackSide,
        blending: AdditiveBlending
      })
    );
    halo.scale.setScalar(1.9);
    const bloom = new Sprite(
      new SpriteMaterial({
        map: glowTexture("rgba(170,120,255,0.55)", "rgba(110,60,230,0.16)"),
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending
      })
    );
    bloom.scale.setScalar(4.2);
    bloom.renderOrder = -1;
    this.tumble.add(bloom, halo, core, rim);
    this.core = core;

    // the rings, each with a point of light riding it
    const glint = glowTexture("rgba(255,255,255,1)", "rgba(198,167,255,0.35)");
    this.rings = RINGS.map(([radius, tube, tx, ty, sx, sy], i) => {
      const pivot = new Group();
      pivot.rotation.set(tx, ty, 0);
      const ring = new Mesh(
        new TorusGeometry(radius, tube, Math.round(28 * detail), Math.round(260 * detail)),
        chrome
      );
      pivot.add(ring);
      const rider = new Sprite(
        new SpriteMaterial({ map: glint, transparent: true, depthWrite: false, blending: AdditiveBlending })
      );
      rider.scale.setScalar(0.34 - i * 0.05);
      pivot.add(rider);
      this.tumble.add(pivot);
      return { pivot, rider, radius, sx, sy, angle: i * 2.1, speed: 0.55 - i * 0.12 };
    });
  }

  // pointer: -1..1 each axis (mouse only); exit: 0..1 as the hero leaves
  tick(dt, elapsed, { pointer, exit }) {
    for (const r of this.rings) {
      r.pivot.rotation.x += r.sx * dt;
      r.pivot.rotation.y += r.sy * dt;
      r.angle += r.speed * dt;
      r.rider.position.set(Math.cos(r.angle) * r.radius, Math.sin(r.angle) * r.radius, 0);
    }
    this.core.rotation.y = elapsed * 0.12;
    // lean toward the cursor, and tip forward as the page scrolls on
    const lx = -pointer.y * 0.22 + exit * 0.9;
    const ly = pointer.x * 0.3;
    this.tumble.rotation.x += (lx - this.tumble.rotation.x) * Math.min(1, dt * 3);
    this.tumble.rotation.y += (ly - this.tumble.rotation.y) * Math.min(1, dt * 3);
  }
}
