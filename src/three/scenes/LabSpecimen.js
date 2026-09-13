import { BufferAttribute, IcosahedronGeometry, Mesh, ShaderMaterial } from "three";
import { labSpecimenVertex, labSpecimenFragment } from "../shaders/labSpecimen.js";

// The faceted mineral at the centre of the Visual Lab hero.
//
// Geometry is built in three deliberate steps, and the order matters:
//
//   1. displace the *indexed* icosahedron, so vertices shared between faces
//      are moved by the same amount and the solid stays watertight,
//   2. only then split it into unshared triangles,
//   3. recompute normals, which are now per-face and give true flat facets.
//
// Doing (2) before (1) tears the solid apart into floating triangles;
// skipping (3) leaves the smooth sphere normals behind and the crystal reads
// as a lumpy ball instead of cut stone.

// Smooth, deterministic, and seedless on purpose — the specimen must be
// byte-identical on every load so it can be art-directed once. Three
// sinusoids of the direction vector are plenty of structure at this scale;
// a full fbm would cost more code for a difference nobody can see.
function crystalField(x, y, z) {
  const a = Math.sin(x * 2.1 + y * 1.3 - z * 0.7);
  const b = Math.sin(y * 3.3 - z * 2.1 + x * 1.1) * 0.6;
  const c = Math.sin(z * 4.7 + x * 2.9 - y * 1.7) * 0.35;
  return (a + b + c) / 1.95;
}

export class LabSpecimen {
  constructor({ detail = 2, amplitude = 0.23, reduceMotion = false } = {}) {
    this.reduceMotion = reduceMotion;
    this.spinSpeed = 0.085;

    const geometry = new IcosahedronGeometry(1, detail);

    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const scale = 1 + crystalField(x, y, z) * amplitude;
      positions.setXYZ(i, x * scale, y * scale, z * scale);
    }

    const faceted = geometry.toNonIndexed();
    geometry.dispose();
    faceted.computeVertexNormals();

    // One random per triangle, written to all three of its vertices so it
    // interpolates to a constant across the face.
    const vertexCount = faceted.attributes.position.count;
    const facetIds = new Float32Array(vertexCount);
    for (let i = 0; i < vertexCount; i += 3) {
      const id = (i / 3) % 997 / 997;
      facetIds[i] = id;
      facetIds[i + 1] = id;
      facetIds[i + 2] = id;
    }
    faceted.setAttribute("aFacet", new BufferAttribute(facetIds, 1));

    this.material = new ShaderMaterial({
      vertexShader: labSpecimenVertex,
      fragmentShader: labSpecimenFragment,
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: 0.35 },
        uScan: { value: -1.6 },
        uReveal: { value: 0 }
      }
    });

    this.mesh = new Mesh(faceted, this.material);
    this.mesh.rotation.set(0.32, 0.6, 0.14);
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

  tick(dt, elapsed) {
    this.material.uniforms.uTime.value = elapsed;
    if (this.reduceMotion) return;
    this.mesh.rotation.y += this.spinSpeed * dt;
    this.mesh.rotation.x = 0.32 + Math.sin(elapsed * 0.21) * 0.09;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
