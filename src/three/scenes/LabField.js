import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial } from "three";
import { labFieldVertex, labFieldFragment } from "../shaders/labField.js";

// The constellation shell around the specimen.
//
// Points are distributed with the Fibonacci sphere rather than by rejecting
// random samples: it is O(n) with no retries and, more importantly, it is
// *even*. Uniform random directions clump visibly at this density, and the
// clumps read as a rendering bug rather than as a field.
//
// Radii are jittered across a shell band so the result is a volume with
// depth, not a soap bubble with everything on one surface.

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export class LabField {
  constructor({ count = 2600, innerRadius = 1.55, outerRadius = 2.5, size = 190, reduceMotion = false } = {}) {
    this.reduceMotion = reduceMotion;

    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const scales = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      // y walks evenly from +1 to -1; the golden angle keeps successive
      // points maximally spread in longitude.
      const y = 1 - (i / Math.max(1, count - 1)) * 2;
      const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = GOLDEN_ANGLE * i;

      // Deterministic pseudo-random in [0,1) — the field must be identical
      // on every load for the same reason the specimen is.
      const jitter = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
      const radius = innerRadius + (outerRadius - innerRadius) * jitter;

      positions[i * 3] = Math.cos(theta) * ringRadius * radius;
      positions[i * 3 + 1] = y * radius;
      positions[i * 3 + 2] = Math.sin(theta) * ringRadius * radius;

      seeds[i] = jitter;
      scales[i] = 0.55 + jitter * 0.85;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));
    geometry.setAttribute("aScale", new BufferAttribute(scales, 1));

    this.material = new ShaderMaterial({
      vertexShader: labFieldVertex,
      fragmentShader: labFieldFragment,
      uniforms: {
        uTime: { value: 0 },
        uScan: { value: -1.6 },
        uSize: { value: size },
        uEnergy: { value: 0.35 },
        uReveal: { value: 0 }
      },
      transparent: true,
      blending: AdditiveBlending,
      // Additive sprites must not write depth: whichever drew first would
      // otherwise punch a hole in every point behind it, and the shell would
      // flicker as the camera turns.
      depthWrite: false
    });

    this.points = new Points(geometry, this.material);
  }

  setEnergy(value) {
    this.material.uniforms.uEnergy.value = value;
  }

  setScan(value) {
    this.material.uniforms.uScan.value = value;
  }

  setReveal(value) {
    this.material.uniforms.uReveal.value = value;
  }

  setSize(value) {
    this.material.uniforms.uSize.value = value;
  }

  tick(dt, elapsed) {
    this.material.uniforms.uTime.value = elapsed;
    if (this.reduceMotion) return;
    // Counter-rotating against the specimen so the two never lock together.
    this.points.rotation.y -= dt * 0.038;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
