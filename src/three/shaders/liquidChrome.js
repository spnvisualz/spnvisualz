// The opening material: a living liquid-chrome surface. This is the
// literal craft SPNVISUALZ sells — cast metal, chrome lettering, molten
// reflective surfaces — rendered as a real reactive shader instead of a
// decorative backdrop. Mouse position and scroll both feed the distortion,
// so it reads as touchable, not ambient.
export const liquidChromeVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPosition;
uniform float uTime;
uniform vec2 uPointer;

void main() {
  vUv = uv;
  vec3 pos = position;

  float wave = sin(pos.x * 1.6 + uTime * 0.5) * cos(pos.y * 1.3 - uTime * 0.35);
  float pointerDist = distance(uv, uPointer * 0.5 + 0.5);
  float pointerBulge = smoothstep(0.55, 0.0, pointerDist) * 0.22;
  pos.z += wave * 0.05 + pointerBulge;

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const liquidChromeFragment = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uPointer;
uniform vec2 uResolution;
uniform float uEnergy;

varying vec2 vUv;
varying vec3 vWorldPosition;

float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float flow(vec2 p) {
  float n = 0.0;
  float amp = 0.5;
  vec2 shift = vec2(uTime * 0.035, -uTime * 0.025);
  for (int i = 0; i < 3; i++) {
    n += noise(p + shift * float(i + 1)) * amp;
    p *= 1.8;
    amp *= 0.4;
  }
  return n;
}

// A studio-light "environment" sampled by reflection direction, the way a
// real chrome render fakes reflections without ray tracing: a handful of
// bright horizontal bands (softbox lights) over a dark ground/sky gradient.
// This is what actually reads as metal — flat diffuse+spec doesn't.
vec3 studioEnvironment(vec3 dir) {
  float h = dir.y * 0.5 + 0.5;
  vec3 sky = mix(vec3(0.03, 0.028, 0.05), vec3(0.09, 0.085, 0.12), h);

  float bands = 0.0;
  bands += smoothstep(0.09, 0.0, abs(dir.y - 0.5)) * 1.0;
  bands += smoothstep(0.07, 0.0, abs(dir.y - 0.05)) * 0.65;
  bands += smoothstep(0.06, 0.0, abs(dir.y + 0.38)) * 0.5;

  vec3 bandColor = mix(vec3(0.92, 0.9, 1.0), vec3(0.95, 0.8, 0.55), 0.4 + 0.3 * sin(dir.x * 3.0));
  return sky + bandColor * bands;
}

void main() {
  vec2 uv = vUv - 0.5;
  uv.x *= uResolution.x / uResolution.y;

  float body = flow(uv * 1.1);
  vec2 grad = vec2(
    flow(uv * 1.1 + vec2(0.02, 0.0)) - body,
    flow(uv * 1.1 + vec2(0.0, 0.02)) - body
  ) / 0.02;

  vec3 normal = normalize(vec3(-grad * 0.4, 1.0));
  vec3 viewDir = normalize(vec3(uv * 0.3, 1.0));
  vec3 reflected = reflect(-viewDir, normal);

  vec3 envColor = studioEnvironment(reflected);
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.2);

  // Fine sparkle layer, independent of the macro reflection so it adds
  // texture without ever compounding into busy contour noise.
  float sparkleField = noise(uv * 26.0 + uTime * 0.08);
  float sparkle = pow(max(sparkleField, 0.0), 9.0) * 6.0;

  vec2 pointerUv = uPointer * 0.5;
  pointerUv.x *= uResolution.x / uResolution.y;
  float pointerGlow = smoothstep(0.7, 0.0, distance(uv, pointerUv));

  vec3 violet = vec3(0.5, 0.24, 0.95);
  vec3 gold = vec3(0.9, 0.7, 0.38);

  vec3 color = envColor;
  color += violet * fresnel * (0.35 + uEnergy * 0.25);
  color += (violet * 0.6 + gold * 0.4) * pointerGlow * 0.4;
  color += vec3(1.0, 0.98, 0.95) * sparkle * 0.5;

  float vignette = smoothstep(1.15, 0.2, length(uv));
  color *= mix(0.55, 1.0, vignette);

  color = color / (color + vec3(1.0));
  color = pow(max(color, vec3(0.0)), vec3(0.85));
  gl_FragColor = vec4(color, 1.0);
}
`;
