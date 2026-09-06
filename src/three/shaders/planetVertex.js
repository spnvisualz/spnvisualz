// Planet vertex shader — Three.js handles model/view/projection, so this is
// far simpler than the raw-WebGL original (which hand-rolled rotation and a
// fake orthographic projection). We just forward object-space position
// (for rotation-stable procedural terrain) and world-space normal/position
// (for lighting that stays correct as the camera/planet move through the
// scroll journey — the original hardcoded a fixed view direction, which
// only worked because its camera never actually moved).
export const planetVertexShader = /* glsl */ `
varying vec3 vObjectPosition;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
  vObjectPosition = position;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);

  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vUv = uv;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;
