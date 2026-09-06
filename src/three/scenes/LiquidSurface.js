import { Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from "three";
import { liquidChromeVertex, liquidChromeFragment } from "../shaders/liquidChrome.js";

// The opening scene's material world. A single large plane, distorted and
// lit as liquid chrome, reacting to pointer position — this is what fills
// the frame before any typography or object exists, standing in for
// "SPNVISUALZ shapes raw material."
export class LiquidSurface {
  constructor() {
    const geometry = new PlaneGeometry(9, 9, 120, 120);
    this.material = new ShaderMaterial({
      vertexShader: liquidChromeVertex,
      fragmentShader: liquidChromeFragment,
      uniforms: {
        uTime: { value: 0 },
        uPointer: { value: new Vector2(0, 0) },
        uResolution: { value: new Vector2(1, 1) },
        uEnergy: { value: 0.5 }
      }
    });
    this.mesh = new Mesh(geometry, this.material);
    this.pointerTarget = new Vector2(0, 0);
  }

  setPointer(x, y) {
    this.pointerTarget.set(x, y);
  }

  setResolution(w, h) {
    this.material.uniforms.uResolution.value.set(w, h);
  }

  setEnergy(value) {
    this.material.uniforms.uEnergy.value = value;
  }

  tick(dt, elapsed) {
    this.material.uniforms.uTime.value = elapsed;
    const p = this.material.uniforms.uPointer.value;
    p.x += (this.pointerTarget.x - p.x) * Math.min(1, dt * 3);
    p.y += (this.pointerTarget.y - p.y) * Math.min(1, dt * 3);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
