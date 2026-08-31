// Planet fragment shader — ported from the production raw-WebGL
// implementation (assets/js/cosmic-flight.js) on the current live site.
// The terrain/cloud noise fields, the "S" signal-ribbon distance field, the
// reference-texture hemisphere projection and the lighting layering are the
// site's actual shader identity, carried forward on purpose. Only the
// lighting inputs changed: the original hardcoded a fixed view direction
// because its camera never moved; here viewDir/normal are real world-space
// values so the material stays correct once the planet is choreographed
// (scale/position/camera moves) across chapters.
export const planetFragmentShader = /* glsl */ `
precision highp float;

uniform float uEnergy;
uniform float uTime;
uniform sampler2D uPlanetTexture;
uniform float uTextureReady;
// Note: cameraPosition is a built-in uniform Three.js injects automatically
// into every ShaderMaterial — do not redeclare it.

varying vec3 vObjectPosition;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

float wrapAngle(float angle) {
  return mod(angle + PI, TAU) - PI;
}

float terrainField(vec3 p) {
  float a = sin(dot(p, vec3(2.73, 3.91, 4.37)));
  float b = sin(dot(p.yzx, vec3(5.21, 6.83, 4.79)) + a * 1.35);
  float c = sin(dot(p.zxy, vec3(11.37, 8.17, 13.11)) + b * 1.72 - a * .42);
  float d = sin(dot(p, vec3(23.71, 19.37, 27.13)) + c * 1.31 + b * .56);
  return clamp(.5 + .5 * (a * .46 + b * .29 + c * .17 + d * .08), 0.0, 1.0);
}

float detailField(vec3 p) {
  float a = sin(dot(p, vec3(41.17, 53.29, 47.83)));
  float b = sin(dot(p.yzx, vec3(79.31, 61.73, 71.11)) + a * 1.8);
  return .5 + .5 * (a * .68 + b * .32);
}

// The signal ribbon: a wrapped "S" that reads the same after a 180-degree
// turn, so it never looks broken mid-rotation.
float signalRibbonDistance() {
  float latitude = (0.5 - vUv.y) * PI;
  float longitude = vUv.x * TAU;
  float latitudeUnit = clamp(latitude / (PI * .5), -1.0, 1.0);
  float poleToPole = acos(latitudeUnit);
  float curve = sin(poleToPole * 2.0) * .72;
  float frontCenter = PI * .5 + curve;
  float rearCenter = PI * 1.5 + curve;
  float latitudeScale = max(.055, cos(latitude));
  float frontDistance = abs(wrapAngle(longitude - frontCenter)) * latitudeScale;
  float rearDistance = abs(wrapAngle(longitude - rearCenter)) * latitudeScale;
  return min(frontDistance, rearDistance);
}

void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 lightDir = normalize(vec3(-0.62, 0.76, 0.88));
  vec3 fillDir = normalize(vec3(0.66, -0.32, 0.72));
  vec3 halfDir = normalize(lightDir + viewDir);

  float facing = max(dot(n, viewDir), 0.0);
  float diffuse = max(dot(n, lightDir), 0.0);
  float fill = max(dot(n, fillDir), 0.0);
  float spec = pow(max(dot(n, halfDir), 0.0), 92.0);
  float broadSpec = pow(max(dot(n, halfDir), 0.0), 16.0);
  float rim = pow(1.0 - facing, 2.7);
  float shell = pow(1.0 - facing, 1.22);

  vec3 objectPoint = normalize(vObjectPosition);
  float continents = terrainField(objectPoint * 1.28 + vec3(.23, -.17, .31));
  float shelves = terrainField(objectPoint.zxy * 2.18 + vec3(1.7, .4, -.8));
  float mineral = detailField(objectPoint * 1.12);
  float land = smoothstep(.49, .66, continents * .77 + shelves * .23);
  float highland = smoothstep(.63, .83, continents * .72 + mineral * .28);
  float fracture = pow(1.0 - abs(sin(dot(objectPoint, vec3(31.7, 23.9, 37.1)) + continents * 8.2)), 18.0);
  float cloudField = terrainField(objectPoint.yzx * 3.2 + vec3(-1.1, .6, 1.9));
  float cloud = smoothstep(.69, .85, cloudField + highland * .12) * (0.35 + 0.65 * diffuse);

  vec2 frontUv = vec2(.514 + objectPoint.x * .376, .516 + objectPoint.y * .212);
  vec2 rearUv = vec2(.514 - objectPoint.x * .376, .516 + objectPoint.y * .212);
  float hemisphereBlend = smoothstep(-.16, .16, objectPoint.z);
  vec3 referenceColor = mix(
    texture2D(uPlanetTexture, rearUv).rgb,
    texture2D(uPlanetTexture, frontUv).rgb,
    hemisphereBlend
  );
  referenceColor = pow(max(referenceColor, vec3(0.0)), vec3(.82));

  vec3 abyss = vec3(.004, .003, .012);
  vec3 deepViolet = vec3(.025, .011, .062);
  vec3 stone = vec3(.31, .28, .43);
  vec3 ice = vec3(.72, .68, .82);

  vec3 globeColor = mix(abyss, deepViolet, .36 + continents * .44 + fill * .12);
  globeColor = mix(globeColor, stone, land * (.35 + diffuse * .48));
  globeColor = mix(globeColor, ice, highland * (.22 + diffuse * .55));
  globeColor += vec3(.26, .09, .58) * (fill * .18 + shell * .23);
  globeColor += vec3(.51, .37, .78) * fracture * land * (.055 + diffuse * .12);
  globeColor += vec3(.67, .62, .83) * cloud * .22;
  globeColor *= .42 + diffuse * .76 + fill * .2;

  vec3 referenceLit = referenceColor * (.62 + diffuse * .52 + fill * .12) + referenceColor * rim * .18;
  globeColor = mix(globeColor, referenceLit, uTextureReady * .68);
  globeColor += vec3(.72, .63, .95) * broadSpec * (.055 + .11 * highland);
  globeColor += vec3(1.0, .97, 1.0) * spec * (.65 + .25 * mineral);

  float ribbonDistance = signalRibbonDistance();
  float aura = 1.0 - smoothstep(.09, .29, ribbonDistance);
  float bed = 1.0 - smoothstep(.105, .18, ribbonDistance);
  float edge = 1.0 - smoothstep(.008, .025, abs(ribbonDistance - .125));
  float currentLine = 1.0 - smoothstep(.006, .018, abs(ribbonDistance - (.042 + .012 * sin(vUv.y * 47.0 + uTime * .7))));
  float currentPulse = .58 + .42 * sin(vUv.y * 91.0 - uTime * 2.2 + mineral * 5.0);
  vec3 ribbonBed = mix(vec3(.14, .035, .37), vec3(.56, .27, 1.0), diffuse * .7 + broadSpec * .28);

  vec3 color = mix(globeColor, ribbonBed, bed * .72);
  color += aura * vec3(.25, .055, .78) * (.22 + uEnergy * .18);
  color += edge * vec3(.79, .55, 1.0) * (.66 + uEnergy * .28);
  color += currentLine * vec3(.94, .84, 1.0) * (.35 + currentPulse * .35 + uEnergy * .16);
  color += rim * vec3(.48, .19, 1.0) * (.72 + uEnergy * .2);
  color += shell * vec3(.18, .04, .48) * .18;
  color = pow(max(color, vec3(0.0)), vec3(.82));

  gl_FragColor = vec4(color, 1.0);
}
`;
