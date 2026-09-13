// Visual Lab specimen — the black-chrome crystal at the centre of the Lab hero.
//
// The homepage planet is the studio's "world" object; the Lab needed its own
// subject rather than a second planet, so this is a faceted mineral specimen
// held under observation. Its material identity is the same one the site
// sells — black chrome, violet rim, controlled specular — but expressed as
// hard facets instead of an atmosphere.
//
// There is no environment map. A chrome look normally needs one, but a cube
// texture is another network request and another thing to art-direct per
// breakpoint; `studioEnv()` below fakes a three-source photographic studio
// procedurally along the reflection vector, which is both cheaper and easier
// to keep on-brand.

export const labSpecimenVertex = /* glsl */ `
// Per-face random, flat-shaded across the triangle so each facet can be
// tinted and animated as one surface (see LabSpecimen's geometry build).
attribute float aFacet;

uniform float uTime;
uniform float uEnergy;

varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec3 vObjectPosition;
varying float vFacet;

void main() {
  vFacet = aFacet;
  vObjectPosition = position;

  // A slow per-facet breath. Tiny on purpose: enough that the silhouette is
  // never perfectly static under a still camera, small enough that the solid
  // never reads as wobbling jelly.
  float breathe = sin(uTime * 0.55 + aFacet * 6.2831853) * 0.014 * (0.55 + uEnergy * 0.6);
  vec3 displaced = position + normal * breathe;

  vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
  vWorldPosition = worldPos.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const labSpecimenFragment = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uEnergy;
uniform float uScan;     // scan-band height, object space, travels -1.3 -> 1.3
uniform float uReveal;   // 0..1 intro wipe, bottom to top

varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec3 vObjectPosition;
varying float vFacet;

float hash11(float n) {
  return fract(sin(n * 91.3458) * 47453.5453);
}

// A three-source photographic studio, evaluated along the reflection vector.
// Key light high and camera-left, a violet kicker behind, and a tight
// horizon streak — that streak is what actually sells chrome, because it
// gives every facet a hard bright edge to catch as it turns.
vec3 studioEnv(vec3 r) {
  vec3 dir = normalize(r);

  vec3 floorTone = vec3(0.006, 0.005, 0.014);
  vec3 skyTone = vec3(0.052, 0.040, 0.115);
  vec3 col = mix(floorTone, skyTone, smoothstep(-0.85, 0.95, dir.y));

  // Every source is a broad lobe plus a tight core. A single tight highlight
  // gives plastic; the wide-plus-narrow pair is what makes a facet look
  // polished, because neighbouring faces catch the broad falloff at visibly
  // different strengths while only a few catch the core.
  float key = max(dot(dir, normalize(vec3(-0.45, 0.82, 0.36))), 0.0);
  col += vec3(1.0, 0.97, 1.0) * (pow(key, 3.0) * 0.42 + pow(key, 34.0) * 2.6);

  float kicker = max(dot(dir, normalize(vec3(0.68, -0.10, -0.72))), 0.0);
  col += vec3(0.55, 0.26, 1.0) * (pow(kicker, 2.5) * 0.34 + pow(kicker, 18.0) * 1.1);

  float fill = max(dot(dir, normalize(vec3(0.30, -0.75, 0.58))), 0.0);
  col += vec3(0.34, 0.30, 0.52) * pow(fill, 4.0) * 0.30;

  float streak = exp(-abs(dir.y) * 26.0);
  col += vec3(0.78, 0.68, 1.0) * streak * 0.55;

  return col;
}

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPosition);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  vec3 R = reflect(-V, N);

  // Facet-to-facet gain variation. Without it a procedurally lit low-poly
  // solid reads as untextured CG; real cut stone never has two faces at
  // exactly the same polish.
  float facetGain = 0.58 + 0.86 * hash11(vFacet);
  vec3 color = studioEnv(R) * facetGain;

  float fresnel = pow(1.0 - ndv, 4.2);

  // Thin-film iridescence, only at grazing angles, drifting slowly so the
  // edges shift colour as the specimen turns.
  vec3 iridescence = 0.5 + 0.5 * cos(6.2831853 * (vec3(0.0, 0.33, 0.67) + fresnel * 1.7 + uTime * 0.045));
  color += iridescence * fresnel * (0.24 + uEnergy * 0.16);
  color += vec3(0.55, 0.24, 1.0) * pow(fresnel, 1.6) * 0.34;

  // The measuring pass: a soft band travelling up the specimen, plus a
  // brighter filament at its centre so it reads as an instrument sweep
  // rather than a gradient.
  float dy = vObjectPosition.y - uScan;
  float band = exp(-dy * dy * 42.0);
  float filament = exp(-dy * dy * 900.0);
  color += vec3(0.78, 0.64, 1.0) * band * (0.22 + uEnergy * 0.26);
  color += vec3(0.96, 0.92, 1.0) * filament * 0.55;

  // Intro wipe — the specimen resolves out of the dark from the base up,
  // with a bright leading edge riding the boundary so the build-on reads as
  // the instrument drawing the object rather than a plain fade-in.
  // Note the edge order: GLSL smoothstep is undefined unless edge0 < edge1,
  // so the descending ramp has to be written as 1.0 - ascending rather than
  // by swapping the edges.
  float wipe = mix(-1.8, 1.8, uReveal);
  float visible = 1.0 - smoothstep(wipe - 0.35, wipe + 0.35, vObjectPosition.y);
  if (visible < 0.004) discard;
  float leadingEdge = exp(-pow((vObjectPosition.y - wipe) * 3.2, 2.0));
  color += vec3(0.72, 0.58, 1.0) * leadingEdge * 0.55 * (1.0 - uReveal);
  color *= visible;

  color = pow(max(color, vec3(0.0)), vec3(0.85));
  gl_FragColor = vec4(color, 1.0);
}
`;
