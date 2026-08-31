import {
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  TextureLoader,
  SRGBColorSpace
} from "three";
import { planetVertexShader } from "./shaders/planetVertex.js";
import { planetFragmentShader } from "./shaders/planetFragment.js";

// Must match the <link rel="preload"> version in index.html — a mismatched
// query string defeats the preload (different cache key = wasted fetch).
const REFERENCE_TEXTURE_URL = "/assets/images/spn-reference-planet.jpg?v=20260813.1";

// The SPN-1 planet. A direct port of the production shader's visual
// character (see shaders/planetFragment.js) onto a real Three.js mesh, so
// it can be scaled/positioned/lit as a scene-graph citizen and choreographed
// across chapters instead of living in one fixed-purpose canvas.
export class Planet {
  constructor({ segments = 160, reduceMotion = false } = {}) {
    this.reduceMotion = reduceMotion;
    this.baseSpinSpeed = 0.045; // rad/s, resting rotation
    this.spinMultiplier = 1;

    const geometry = new SphereGeometry(1, segments, segments);

    this.material = new ShaderMaterial({
      vertexShader: planetVertexShader,
      fragmentShader: planetFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: 0.4 },
        uPlanetTexture: { value: null },
        uTextureReady: { value: 0 }
      }
    });

    this.mesh = new Mesh(geometry, this.material);
    this.mesh.rotation.y = 0.4;
    this.mesh.rotation.z = 0.12;

    this._loadTexture();
  }

  _loadTexture() {
    new TextureLoader().load(
      REFERENCE_TEXTURE_URL,
      (texture) => {
        texture.colorSpace = SRGBColorSpace;
        this.material.uniforms.uPlanetTexture.value = texture;
        this.material.uniforms.uTextureReady.value = 1;
      },
      undefined,
      () => {
        // Reference art failed to load — the shader's procedural terrain
        // carries the planet on its own (uTextureReady stays 0), so this
        // is a silent, intentional degrade rather than a broken sphere.
      }
    );
  }

  setEnergy(value) {
    this.material.uniforms.uEnergy.value = value;
  }

  tick(dt, elapsed) {
    this.material.uniforms.uTime.value = elapsed;
    if (!this.reduceMotion) {
      this.mesh.rotation.y += this.baseSpinSpeed * this.spinMultiplier * dt;
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    const tex = this.material.uniforms.uPlanetTexture.value;
    if (tex) tex.dispose();
  }
}
