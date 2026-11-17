import { IcosahedronGeometry, Mesh, ShaderMaterial, Color } from "three";
import { facetVertex, facetFragment } from "../shaders/facet.js";

// Kept inside the brand: violet, gold and chrome, one pairing per service.
const SERVICE_PALETTE = [
  ["#c6a7ff", "#8a4dff"],
  ["#ffd48a", "#b0662e"],
  ["#ece8f6", "#6f6296"],
  ["#d9bfff", "#5a2dbf"],
  ["#ffe2a8", "#8a4dff"],
  ["#ffffff", "#c6a7ff"]
];

export class FacetObject {
  constructor() {
    const geometry = new IcosahedronGeometry(1, 3);
    this.material = new ShaderMaterial({
      vertexShader: facetVertex,
      fragmentShader: facetFragment,
      uniforms: {
        uTime: { value: 0 },
        uDistortion: { value: 0.08 },
        uColorA: { value: new Color(SERVICE_PALETTE[0][0]) },
        uColorB: { value: new Color(SERVICE_PALETTE[0][1]) }
      }
    });
    this.mesh = new Mesh(geometry, this.material);
    this._targetA = new Color(SERVICE_PALETTE[0][0]);
    this._targetB = new Color(SERVICE_PALETTE[0][1]);
  }

  setService(index) {
    const [a, b] = SERVICE_PALETTE[index % SERVICE_PALETTE.length];
    this._targetA.set(a);
    this._targetB.set(b);
  }

  tick(dt, elapsed) {
    this.material.uniforms.uTime.value = elapsed;
    this.mesh.rotation.y += dt * 0.18;
    this.mesh.rotation.x += dt * 0.07;
    this.material.uniforms.uColorA.value.lerp(this._targetA, Math.min(1, dt * 3));
    this.material.uniforms.uColorB.value.lerp(this._targetB, Math.min(1, dt * 3));
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
