// Visual Lab field — the constellation shell the specimen sits inside.
//
// Points rather than geometry: a few thousand additive sprites cost almost
// nothing next to the same impression built from meshes, and they give the
// hero the sense of a measured volume around the subject instead of an
// object floating on a flat background.
//
// The scan band is shared with the specimen material (same uScan uniform in
// the same object space), so the sweep crosses the shell and the crystal as
// one continuous pass — that agreement is the whole trick; two independent
// sweeps immediately read as decoration.

export const labFieldVertex = /* glsl */ `
attribute float aSeed;   // per-point random, stable across frames
attribute float aScale;  // per-point base size

uniform float uTime;
uniform float uScan;
uniform float uSize;     // pixel size, already multiplied by DPR by the scene
uniform float uEnergy;
uniform float uReveal;

varying float vGlow;
varying float vSeed;

void main() {
  vSeed = aSeed;

  vec3 pos = position;

  // Each point drifts on its own small orbit. Sampling the same seed at
  // three different frequencies is enough to keep the shell alive without
  // any of it looking like a synchronised wave.
  float t = uTime * 0.28;
  pos += vec3(
    sin(t + aSeed * 12.9898) * 0.055,
    cos(t * 1.17 + aSeed * 78.233) * 0.055,
    sin(t * 0.83 + aSeed * 39.425) * 0.055
  );

  // Radial breathing, so the shell feels like a volume under pressure.
  pos *= 1.0 + sin(uTime * 0.4 + aSeed * 6.2831853) * 0.02;

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vec4 viewPos = viewMatrix * worldPos;

  // Points crossing the scan band flare, then settle.
  float dy = pos.y - uScan;
  vGlow = exp(-dy * dy * 26.0) * (0.65 + uEnergy * 0.35);

  // Intro: the shell populates from the base up, in step with the specimen.
  // Ascending edges only — see the note in labSpecimen's fragment shader.
  float wipe = mix(-2.6, 2.6, uReveal);
  float born = 1.0 - smoothstep(wipe - 0.5, wipe + 0.5, pos.y);

  gl_Position = projectionMatrix * viewPos;
  // -viewPos.z is the linear view-space depth; dividing by it is the standard
  // perspective size attenuation so distant points genuinely recede.
  // The sweep brightens points; it must not inflate them. A large size boost
  // here reads as a row of white blobs crossing the shell rather than as the
  // band lighting up the points already there.
  gl_PointSize = uSize * aScale * born * (1.0 + vGlow * 0.45) / max(0.35, -viewPos.z);
}
`;

export const labFieldFragment = /* glsl */ `
// highp, not mediump: uEnergy is also declared in the vertex stage, where the
// default float precision is highp. A uniform of the same name must carry the
// same precision in both stages or the program fails to link
// ("Precisions of uniform 'uEnergy' differ between VERTEX and FRAGMENT
// shaders"), which silently costs you the whole particle shell.
precision highp float;

uniform float uEnergy;

varying float vGlow;
varying float vSeed;

void main() {
  // gl_PointCoord is the 0..1 square of the sprite; anything outside the
  // inscribed circle is thrown away so points are round, not square.
  vec2 offset = gl_PointCoord - 0.5;
  float dist = dot(offset, offset);
  if (dist > 0.25) discard;

  // A wide soft falloff on every sprite turns the shell into fog. Keep the
  // halo faint and put most of the energy in a tight core so the field reads
  // as points of light with air between them, and the specimen stays legible
  // through it.
  float falloff = 1.0 - smoothstep(0.0, 0.25, dist);
  float core = pow(falloff, 7.0);

  vec3 cool = vec3(0.42, 0.28, 0.86);
  vec3 warm = vec3(0.86, 0.80, 1.0);
  vec3 color = mix(cool, warm, fract(vSeed * 7.31));
  color = mix(color, vec3(1.0, 0.96, 1.0), vGlow * 0.8);

  float alpha = falloff * (0.055 + uEnergy * 0.04) + core * (0.5 + vGlow * 0.4);
  gl_FragColor = vec4(color * (0.8 + vGlow * 0.9), alpha);
}
`;
