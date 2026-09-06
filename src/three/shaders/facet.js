// Services' object: a faceted, slowly tumbling form whose material state
// shifts per hovered/active service — the object itself communicates
// "identity/motion/loops/visuals/brand" rather than sitting there as
// decoration next to a list that does all the actual work.
export const facetVertex = /* glsl */ `
uniform float uTime;
uniform float uDistortion;
varying vec3 vNormal;
varying vec3 vPosition;

float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec3 pos = position;
  float n = hash3(floor(pos * 2.2 + uTime * 0.15));
  pos += normal * (n - 0.5) * uDistortion;
  vPosition = pos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const facetFragment = /* glsl */ `
precision highp float;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vPosition);
  vec3 lightDir = normalize(vec3(-0.5, 0.7, 0.6));

  float diffuse = max(dot(n, lightDir), 0.0);
  float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.2);
  float facetShade = floor(diffuse * 5.0) / 5.0;

  vec3 color = mix(uColorA, uColorB, facetShade);
  color += rim * uColorB * 0.8;
  color += vec3(1.0) * pow(max(dot(reflect(-lightDir, n), viewDir), 0.0), 40.0);

  gl_FragColor = vec4(color, 1.0);
}
`;
