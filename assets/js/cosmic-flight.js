(() => {
  "use strict";

  const root = document.documentElement;
  const stage = document.getElementById("spnPlanet");
  const canvas = document.getElementById("spnPlanetCanvas");
  if (!stage || !canvas) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = matchMedia("(pointer: coarse)").matches;
  const touchDevice = coarsePointer || navigator.maxTouchPoints > 1;
  const landscapeQuery = matchMedia("(orientation: landscape)");
  const touchLandscape = () => touchDevice && (landscapeQuery.matches || innerWidth > innerHeight);
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = Boolean(connection && connection.saveData);
  const useCompactProfile = () => innerWidth <= 720 || (touchDevice && innerWidth <= 1440);
  let compact = useCompactProfile();

  const activateFallback = (profile = "fallback") => {
    root.classList.remove("planet-ready");
    document.body.classList.remove("planet-ready");
    root.classList.add("planet-fallback");
    document.body.classList.add("planet-fallback");
    stage.classList.add("is-fallback");
    stage.dataset.renderProfile = profile;
  };

  // Never ask mobile Safari to hold a WebGL framebuffer and a decoded motion
  // reel at the same time in landscape. The fallback remains scroll-reactive.
  if (touchLandscape()) {
    root.classList.add("touch-landscape-safe");
    document.body.classList.add("touch-landscape-safe");
    activateFallback("touch-landscape-safe");
    return;
  }

  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: !saveData && !touchDevice,
    depth: true,
    premultipliedAlpha: true,
    powerPreference: saveData || touchDevice ? "low-power" : "high-performance"
  }) || canvas.getContext("experimental-webgl");

  if (!gl) {
    activateFallback();
    return;
  }

  const TAU = Math.PI * 2;
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const smoothstep = (edge0, edge1, value) => {
    const amount = clamp((value - edge0) / Math.max(.00001, edge1 - edge0));
    return amount * amount * (3 - 2 * amount);
  };
  const journeyEase = value => {
    const amount = clamp(value);
    return amount * amount * amount * (amount * (amount * 6 - 15) + 10);
  };

  const vertexShaderSource = `
    precision highp float;
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aUv;
    uniform vec3 uRotation;
    uniform vec3 uLocalRotation;
    uniform float uScale;
    uniform vec2 uOffset;
    uniform float uAspect;
    varying vec3 vNormal;
    varying vec3 vObject;
    varying vec3 vWorld;
    varying vec2 vUv;

    vec3 rotateX(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x,p.y*c-p.z*s,p.y*s+p.z*c);}
    vec3 rotateY(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x*c+p.z*s,p.y,-p.x*s+p.z*c);}
    vec3 rotateZ(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x*c-p.y*s,p.x*s+p.y*c,p.z);}
    vec3 rotateAll(vec3 p,vec3 r){p=rotateX(p,r.x);p=rotateY(p,r.y);return rotateZ(p,r.z);}

    void main(){
      vec3 p=rotateAll(aPosition,uLocalRotation);
      vec3 n=rotateAll(aNormal,uLocalRotation);
      p=rotateAll(p,uRotation);
      n=rotateAll(n,uRotation);
      vNormal=normalize(n);
      vObject=aPosition;
      vWorld=p;
      vUv=aUv;
      gl_Position=vec4(p.x*uScale/uAspect+uOffset.x,p.y*uScale+uOffset.y,-p.z*.18,1.0);
    }
  `;

  const fragmentShaderSource = `
    precision highp float;
    uniform float uKind;
    uniform float uEnergy;
    uniform float uTime;
    uniform float uAlpha;
    uniform sampler2D uPlanetTexture;
    uniform float uTextureReady;
    varying vec3 vNormal;
    varying vec3 vObject;
    varying vec3 vWorld;
    varying vec2 vUv;

    const float PI=3.14159265359;
    const float TAU=6.28318530718;

    float wrapAngle(float angle){
      return mod(angle+PI,TAU)-PI;
    }

    float terrainField(vec3 p){
      float a=sin(dot(p,vec3(2.73,3.91,4.37)));
      float b=sin(dot(p.yzx,vec3(5.21,6.83,4.79))+a*1.35);
      float c=sin(dot(p.zxy,vec3(11.37,8.17,13.11))+b*1.72-a*.42);
      float d=sin(dot(p,vec3(23.71,19.37,27.13))+c*1.31+b*.56);
      return clamp(.5+.5*(a*.46+b*.29+c*.17+d*.08),0.0,1.0);
    }

    float detailField(vec3 p){
      float a=sin(dot(p,vec3(41.17,53.29,47.83)));
      float b=sin(dot(p.yzx,vec3(79.31,61.73,71.11))+a*1.8);
      return .5+.5*(a*.68+b*.32);
    }

    float sDistance(){
      float latitude=(0.5-vUv.y)*PI;
      float longitude=vUv.x*TAU;
      float latitudeUnit=clamp(latitude/(PI*.5),-1.0,1.0);
      float poleToPole=acos(latitudeUnit);
      float curve=sin(poleToPole*2.0)*.72;
      float frontCenter=PI*.5+curve;
      /* After a 180 degree turn, the rear mark reads as the same S. */
      float rearCenter=PI*1.5+curve;
      float latitudeScale=max(.055,cos(latitude));
      float frontDistance=abs(wrapAngle(longitude-frontCenter))*latitudeScale;
      float rearDistance=abs(wrapAngle(longitude-rearCenter))*latitudeScale;
      return min(frontDistance,rearDistance);
    }

    void main(){
      vec3 n=normalize(vNormal);
      vec3 viewDir=vec3(0.0,0.0,1.0);
      vec3 lightDir=normalize(vec3(-0.62,0.76,0.88));
      vec3 fillDir=normalize(vec3(0.66,-0.32,0.72));
      vec3 halfDir=normalize(lightDir+viewDir);
      float facing=max(dot(n,viewDir),0.0);
      float diffuse=max(dot(n,lightDir),0.0);
      float fill=max(dot(n,fillDir),0.0);
      float spec=pow(max(dot(n,halfDir),0.0),92.0);
      float broadSpec=pow(max(dot(n,halfDir),0.0),16.0);
      float rim=pow(1.0-facing,2.7);
      float shell=pow(1.0-facing,1.22);

      if(uKind<0.5){
        vec3 objectPoint=normalize(vObject);
        float continents=terrainField(objectPoint*1.28+vec3(.23,-.17,.31));
        float shelves=terrainField(objectPoint.zxy*2.18+vec3(1.7,.4,-.8));
        float mineral=detailField(objectPoint*1.12);
        float land=smoothstep(.49,.66,continents*.77+shelves*.23);
        float highland=smoothstep(.63,.83,continents*.72+mineral*.28);
        float fracture=pow(1.0-abs(sin(dot(objectPoint,vec3(31.7,23.9,37.1))+continents*8.2)),18.0);
        float cloudField=terrainField(objectPoint.yzx*3.2+vec3(-1.1,.6,1.9));
        float cloud=smoothstep(.69,.85,cloudField+highland*.12)*(0.35+0.65*diffuse);

        /* Project the supplied planet artwork onto both hemispheres. */
        vec2 frontUv=vec2(.514+objectPoint.x*.376,.516+objectPoint.y*.212);
        vec2 rearUv=vec2(.514-objectPoint.x*.376,.516+objectPoint.y*.212);
        float hemisphereBlend=smoothstep(-.16,.16,objectPoint.z);
        vec3 referenceColor=mix(texture2D(uPlanetTexture,rearUv).rgb,texture2D(uPlanetTexture,frontUv).rgb,hemisphereBlend);
        referenceColor=pow(max(referenceColor,vec3(0.0)),vec3(.82));

        vec3 abyss=vec3(.004,.003,.012);
        vec3 deepViolet=vec3(.025,.011,.062);
        vec3 stone=vec3(.31,.28,.43);
        vec3 ice=vec3(.72,.68,.82);
        vec3 globeColor=mix(abyss,deepViolet,.36+continents*.44+fill*.12);
        globeColor=mix(globeColor,stone,land*(.35+diffuse*.48));
        globeColor=mix(globeColor,ice,highland*(.22+diffuse*.55));
        globeColor+=vec3(.26,.09,.58)*(fill*.18+shell*.23);
        globeColor+=vec3(.51,.37,.78)*fracture*land*(.055+diffuse*.12);
        globeColor+=vec3(.67,.62,.83)*cloud*.22;
        globeColor*=.42+diffuse*.76+fill*.2;
        vec3 referenceLit=referenceColor*(.62+diffuse*.52+fill*.12)+referenceColor*rim*.18;
        globeColor=mix(globeColor,referenceLit,uTextureReady*.68);
        globeColor+=vec3(.72,.63,.95)*broadSpec*(.055+.11*highland);
        globeColor+=vec3(1.0,.97,1.0)*spec*(.65+.25*mineral);

        float ribbonDistance=sDistance();
        float aura=1.0-smoothstep(.09,.29,ribbonDistance);
        float bed=1.0-smoothstep(.105,.18,ribbonDistance);
        float edge=1.0-smoothstep(.008,.025,abs(ribbonDistance-.125));
        float currentLine=1.0-smoothstep(.006,.018,abs(ribbonDistance-(.042+.012*sin(vUv.y*47.0+uTime*.7))));
        float currentPulse=.58+.42*sin(vUv.y*91.0-uTime*2.2+mineral*5.0);
        vec3 ribbonBed=mix(vec3(.14,.035,.37),vec3(.56,.27,1.0),diffuse*.7+broadSpec*.28);

        vec3 color=mix(globeColor,ribbonBed,bed*.72);
        color+=aura*vec3(.25,.055,.78)*(.22+uEnergy*.18);
        color+=edge*vec3(.79,.55,1.0)*(.66+uEnergy*.28);
        color+=currentLine*vec3(.94,.84,1.0)*(.35+currentPulse*.35+uEnergy*.16);
        color+=rim*vec3(.48,.19,1.0)*(.72+uEnergy*.2);
        color+=shell*vec3(.18,.04,.48)*.18;
        color=pow(max(color,vec3(0.0)),vec3(.82));
        gl_FragColor=vec4(color,1.0);
      }else if(uKind<1.5){
        float ringEdge=pow(abs(sin(vUv.y*PI)),.36);
        float chromeLine=pow(.5+.5*sin(vUv.y*TAU*3.0+vUv.x*TAU*2.0),18.0);
        float pulse=.76+.24*sin(vUv.x*58.0-uTime*.8);
        vec3 ringDark=vec3(.025,.012,.075);
        vec3 ringLight=vec3(.84,.79,1.0);
        vec3 color=mix(ringDark,ringLight,clamp(diffuse*.52+broadSpec*.36+spec*1.15,0.0,1.0));
        color+=vec3(.45,.2,1.0)*(rim*.62+chromeLine*.22+uEnergy*.12);
        color+=vec3(1.0,.97,1.0)*spec*1.2;
        gl_FragColor=vec4(color,uAlpha*(.55+ringEdge*.25+spec*.2+pulse*.06));
      }else{
        float across=abs(vUv.y*2.0-1.0);
        float softBody=1.0-smoothstep(.58,1.0,across);
        float hotEdges=1.0-smoothstep(.035,.12,abs(across-.74));
        float filament=1.0-smoothstep(.025,.085,abs(across-(.24+.07*sin(vUv.x*TAU*11.0-uTime*1.2))));
        float spark=pow(.5+.5*sin(vUv.x*TAU*97.0-uTime*3.0),22.0);
        vec3 color=mix(vec3(.16,.025,.46),vec3(.62,.31,1.0),softBody);
        color+=hotEdges*vec3(.9,.7,1.0)*(.74+uEnergy*.28);
        color+=filament*vec3(.96,.88,1.0)*(.5+spark*.55);
        color+=vec3(.29,.06,.88)*uEnergy*.24;
        float alpha=(softBody*.42+hotEdges*.58+filament*.46+spark*.08)*uAlpha;
        gl_FragColor=vec4(color,alpha);
      }
    }
  `;

  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) {
    activateFallback();
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    activateFallback();
    return;
  }
  gl.useProgram(program);

  const attributes = {
    position: gl.getAttribLocation(program, "aPosition"),
    normal: gl.getAttribLocation(program, "aNormal"),
    uv: gl.getAttribLocation(program, "aUv")
  };
  const uniforms = {
    rotation: gl.getUniformLocation(program, "uRotation"),
    localRotation: gl.getUniformLocation(program, "uLocalRotation"),
    scale: gl.getUniformLocation(program, "uScale"),
    offset: gl.getUniformLocation(program, "uOffset"),
    aspect: gl.getUniformLocation(program, "uAspect"),
    kind: gl.getUniformLocation(program, "uKind"),
    energy: gl.getUniformLocation(program, "uEnergy"),
    time: gl.getUniformLocation(program, "uTime"),
    alpha: gl.getUniformLocation(program, "uAlpha")
  };

  uniforms.planetTexture = gl.getUniformLocation(program, "uPlanetTexture");
  uniforms.textureReady = gl.getUniformLocation(program, "uTextureReady");

  const planetTexture = gl.createTexture();
  let textureReady = 0;
  let textureTarget = 0;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, planetTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([8, 3, 20, 255]));
  gl.uniform1i(uniforms.planetTexture, 0);

  const referenceImage = new Image();
  referenceImage.decoding = "async";
  referenceImage.addEventListener("load", () => {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, planetTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, referenceImage);
    textureTarget = 1;
    stage.dataset.planetTexture = "ready";
    requestRender();
  }, { once: true });
  referenceImage.addEventListener("error", () => {
    stage.dataset.planetTexture = "procedural";
  }, { once: true });
  referenceImage.src = "/assets/images/spn-reference-planet.jpg?v=20260813.1";

  const makeGeometry = (positions, normals, uvs, indices) => {
    const geometry = { count: indices.length };
    geometry.position = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry.position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    geometry.normal = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry.normal);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    geometry.uv = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry.uv);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);
    geometry.index = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    return geometry;
  };

  const createSphere = (latSegments, lonSegments) => {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    for (let lat = 0; lat <= latSegments; lat += 1) {
      const v = lat / latSegments;
      const theta = v * Math.PI;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      for (let lon = 0; lon <= lonSegments; lon += 1) {
        const u = lon / lonSegments;
        const phi = u * TAU;
        const x = sinTheta * Math.cos(phi);
        const y = cosTheta;
        const z = sinTheta * Math.sin(phi);
        positions.push(x, y, z);
        normals.push(x, y, z);
        uvs.push(u, v);
      }
    }
    for (let lat = 0; lat < latSegments; lat += 1) {
      for (let lon = 0; lon < lonSegments; lon += 1) {
        const first = lat * (lonSegments + 1) + lon;
        const second = first + lonSegments + 1;
        indices.push(first, first + 1, second, second, first + 1, second + 1);
      }
    }
    return makeGeometry(positions, normals, uvs, indices);
  };

  const createTorus = (majorSegments, minorSegments, radius, tube) => {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    for (let major = 0; major <= majorSegments; major += 1) {
      const u = major / majorSegments;
      const a = u * TAU;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (let minor = 0; minor <= minorSegments; minor += 1) {
        const v = minor / minorSegments;
        const b = v * TAU;
        const cb = Math.cos(b);
        const sb = Math.sin(b);
        const ring = radius + tube * cb;
        positions.push(ring * ca, ring * sa, tube * sb);
        normals.push(cb * ca, cb * sa, sb);
        uvs.push(u, v);
      }
    }
    for (let major = 0; major < majorSegments; major += 1) {
      for (let minor = 0; minor < minorSegments; minor += 1) {
        const first = major * (minorSegments + 1) + minor;
        const second = first + minorSegments + 1;
        indices.push(first, second, first + 1, second, second + 1, first + 1);
      }
    }
    return makeGeometry(positions, normals, uvs, indices);
  };

  const ribbonPoint = progress => {
    const t = ((progress % 1) + 1) % 1;
    const front = t < .5;
    const theta = front ? t * TAU : (1 - t) * TAU;
    const curve = Math.sin(theta * 2) * .72;
    const phi = (front ? Math.PI * .5 : Math.PI * 1.5) + curve;
    const sinTheta = Math.sin(theta);
    return [
      sinTheta * Math.cos(phi),
      Math.cos(theta),
      sinTheta * Math.sin(phi)
    ];
  };

  const normalizeVector = vector => {
    const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
    return [vector[0] / length, vector[1] / length, vector[2] / length];
  };

  const createRibbon = (segments, halfWidth) => {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const epsilon = .42 / segments;
    for (let segment = 0; segment <= segments; segment += 1) {
      const t = segment / segments;
      const normal = normalizeVector(ribbonPoint(t));
      const previous = ribbonPoint(t - epsilon);
      const next = ribbonPoint(t + epsilon);
      const tangent = normalizeVector([
        next[0] - previous[0],
        next[1] - previous[1],
        next[2] - previous[2]
      ]);
      const side = normalizeVector([
        normal[1] * tangent[2] - normal[2] * tangent[1],
        normal[2] * tangent[0] - normal[0] * tangent[2],
        normal[0] * tangent[1] - normal[1] * tangent[0]
      ]);
      [-1, 1].forEach((direction, sideIndex) => {
        const point = normalizeVector([
          normal[0] + side[0] * halfWidth * direction,
          normal[1] + side[1] * halfWidth * direction,
          normal[2] + side[2] * halfWidth * direction
        ]);
        positions.push(point[0] * 1.018, point[1] * 1.018, point[2] * 1.018);
        normals.push(point[0], point[1], point[2]);
        uvs.push(t, sideIndex);
      });
    }
    for (let segment = 0; segment < segments; segment += 1) {
      const first = segment * 2;
      indices.push(first, first + 2, first + 1, first + 1, first + 2, first + 3);
    }
    return makeGeometry(positions, normals, uvs, indices);
  };

  const sphere = createSphere(compact ? 88 : 152, compact ? 128 : 224);
  const ribbon = createRibbon(compact ? 248 : 392, compact ? .105 : .095);
  const torus = createTorus(compact ? 144 : 220, compact ? 14 : 18, 1.42, compact ? .034 : .038);

  const bindGeometry = geometry => {
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry.position);
    gl.enableVertexAttribArray(attributes.position);
    gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry.normal);
    gl.enableVertexAttribArray(attributes.normal);
    gl.vertexAttribPointer(attributes.normal, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry.uv);
    gl.enableVertexAttribArray(attributes.uv);
    gl.vertexAttribPointer(attributes.uv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.index);
  };

  const chapterDefinitions = [
    ["#top", "ORIGIN", "home"],
    [".manifesto", "STUDIO", "studio"],
    ["#work", "WORK", "work"],
    ["#services", "SERVICES", "services"],
    ["#pricing", "PRICING", "pricing"],
    [".process", "PROCESS", "process"],
    ["#visual-lab", "VISUAL LAB", "visual-lab"],
    ["#contact", "CONTACT", "contact"]
  ];

  const chapterLabel = document.getElementById("spnPlanetChapter");
  const degreeLabel = document.getElementById("spnPlanetDegrees");
  const progressLine = document.getElementById("spnPlanetProgress");
  const readScroll = () => {
    const motionScroll = Number(window.SPNScroll?.current);
    return Number.isFinite(motionScroll) ? motionScroll : scrollY;
  };
  let width = 1;
  let height = 1;
  let aspect = 1;
  let pageMax = 1;
  let keyframes = [];
  let chapterMetrics = [];
  let targetProgress = 0;
  let currentProgress = 0;
  let scrollYaw = 0;
  let idleYaw = 0;
  let previousProgress = 0;
  let targetEnergy = 0;
  let currentEnergy = 0;
  let navigationPath = null;
  let activeChapter = -1;
  let activePath = { x: .42, y: .02, scale: .84, opacity: 1, pitch: -.08 };
  let renderedScale = activePath.scale;
  let stableCompactHeight = 0;
  let previousScroll = readScroll();
  let previousScrollTime = performance.now();
  let previousFrame = performance.now();
  let previousDraw = 0;
  let animationFrame = 0;
  let resizeFrame = 0;
  let pathFrame = 0;
  let pathRefreshTimer = 0;
  let viewportResizeTimer = 0;
  let initialized = false;
  let visible = !document.hidden;
  let orientationPending = false;
  let safetyMode = false;
  let orientationSafetyTimer = 0;

  const viewportProbe = document.createElement("span");
  viewportProbe.setAttribute("aria-hidden", "true");
  viewportProbe.style.cssText = "position:fixed;left:0;top:0;width:1px;height:100lvh;visibility:hidden;pointer-events:none;contain:strict;";
  stage.appendChild(viewportProbe);

  const sectionPoint = (selector, amount = 0) => {
    const element = document.querySelector(selector);
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    return clamp((readScroll() + rect.top + rect.height * amount) / pageMax);
  };

  const measureStableViewportHeight = () => {
    if (!window.CSS?.supports?.("height", "100lvh")) return Math.max(1, innerHeight);
    const measuredHeight = viewportProbe.getBoundingClientRect().height;
    return Math.max(1, measuredHeight || innerHeight);
  };

  const cachePath = () => {
    pageMax = Math.max(1, document.documentElement.scrollHeight - Math.max(1, height));
    chapterMetrics = chapterDefinitions.map(([selector, name, slug], index) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return {
        name,
        slug,
        index,
        top: rect ? readScroll() + rect.top : index * innerHeight,
        height: rect ? rect.height : innerHeight
      };
    });

    const heroEnd = sectionPoint("#top", .88);
    const studio = sectionPoint(".manifesto", .42);
    const workStart = sectionPoint("#work", .04);
    const workTwo = sectionPoint("#work", .23);
    const workThree = sectionPoint("#work", .42);
    const workFour = sectionPoint("#work", .61);
    const workFive = sectionPoint("#work", .8);
    const workEnd = sectionPoint("#work", .96);
    const services = sectionPoint("#services", .42);
    const pricing = sectionPoint("#pricing", .42);
    const process = sectionPoint(".process", .45);
    const lab = sectionPoint("#visual-lab", .45);
    const contact = sectionPoint("#contact", .46);
    const desktopPath = [
      { p: 0, x: .26, y: .01, scale: 1.12, opacity: 1, pitch: -.07 },
      { p: heroEnd, x: .2, y: -.02, scale: 1.09, opacity: 1, pitch: -.03 },
      { p: studio, x: -.28, y: .02, scale: 1.1, opacity: 1, pitch: .08 },
      { p: workStart, x: .26, y: .01, scale: 1.12, opacity: 1, pitch: -.09 },
      { p: workTwo, x: -.24, y: -.04, scale: 1.08, opacity: 1, pitch: .07 },
      { p: workThree, x: .26, y: .05, scale: 1.11, opacity: 1, pitch: -.07 },
      { p: workFour, x: -.24, y: .03, scale: 1.08, opacity: 1, pitch: .08 },
      { p: workFive, x: .25, y: -.04, scale: 1.11, opacity: 1, pitch: -.08 },
      { p: workEnd, x: -.22, y: .04, scale: 1.09, opacity: 1, pitch: -.05 },
      { p: services, x: .28, y: .03, scale: 1.12, opacity: 1, pitch: .08 },
      { p: pricing, x: -.27, y: -.01, scale: 1.1, opacity: 1, pitch: -.08 },
      { p: process, x: .25, y: .05, scale: 1.08, opacity: 1, pitch: .1 },
      { p: lab, x: -.25, y: .03, scale: 1.13, opacity: 1, pitch: -.06 },
      { p: contact, x: .14, y: .01, scale: 1.22, opacity: 1, pitch: .03 },
      { p: 1, x: 0, y: 0, scale: 1.3, opacity: 1, pitch: 0 }
    ];
    const mobilePath = [
      { p: 0, x: .18, y: .1, scale: .96, opacity: 1, pitch: -.05 },
      { p: heroEnd, x: .16, y: .04, scale: .94, opacity: 1, pitch: -.02 },
      { p: studio, x: -.22, y: -.04, scale: .95, opacity: 1, pitch: .07 },
      { p: workStart, x: .2, y: -.02, scale: .98, opacity: 1, pitch: -.07 },
      { p: workTwo, x: -.21, y: -.04, scale: .94, opacity: 1, pitch: .07 },
      { p: workThree, x: .21, y: .06, scale: .96, opacity: 1, pitch: -.07 },
      { p: workFour, x: -.2, y: .03, scale: .94, opacity: 1, pitch: .07 },
      { p: workFive, x: .2, y: -.04, scale: .97, opacity: 1, pitch: -.07 },
      { p: workEnd, x: -.18, y: .04, scale: .95, opacity: 1, pitch: -.05 },
      { p: services, x: .22, y: .05, scale: .96, opacity: 1, pitch: .07 },
      { p: pricing, x: -.22, y: -.03, scale: .95, opacity: 1, pitch: -.07 },
      { p: process, x: .2, y: .07, scale: .94, opacity: 1, pitch: .08 },
      { p: lab, x: -.2, y: .04, scale: .97, opacity: 1, pitch: -.05 },
      { p: contact, x: .12, y: .04, scale: 1.05, opacity: 1, pitch: .03 },
      { p: 1, x: 0, y: 0, scale: 1.12, opacity: 1, pitch: 0 }
    ];
    keyframes = (compact ? mobilePath : desktopPath).sort((a, b) => a.p - b.p);
  };

  const pathAt = progress => {
    let nextIndex = keyframes.findIndex(point => point.p >= progress);
    if (nextIndex <= 0) return keyframes[0];
    if (nextIndex < 0) return keyframes[keyframes.length - 1];
    const previous = keyframes[nextIndex - 1];
    const next = keyframes[nextIndex];
    const amount = smoothstep(previous.p, next.p, progress);
    return {
      x: lerp(previous.x, next.x, amount),
      y: lerp(previous.y, next.y, amount),
      scale: lerp(previous.scale, next.scale, amount),
      opacity: lerp(previous.opacity, next.opacity, amount),
      pitch: lerp(previous.pitch, next.pitch, amount)
    };
  };

  const copyPath = path => ({
    x: path.x,
    y: path.y,
    scale: path.scale,
    opacity: path.opacity,
    pitch: path.pitch
  });

  const pathDifference = (from, to) => Math.max(
    Math.abs(from.x - to.x),
    Math.abs(from.y - to.y),
    Math.abs(from.scale - to.scale),
    Math.abs(from.pitch - to.pitch)
  );

  const interpolatePath = (from, to, amount) => ({
    x: lerp(from.x, to.x, amount),
    y: lerp(from.y, to.y, amount),
    scale: lerp(from.scale, to.scale, amount),
    opacity: 1,
    pitch: lerp(from.pitch, to.pitch, amount)
  });

  const resize = () => {
    const nextWidth = Math.max(1, innerWidth);
    const rawHeight = Math.max(1, innerHeight);
    const nextCompact = useCompactProfile();
    const widthChanged = !initialized || Math.abs(nextWidth - width) > 1;
    const compactChanged = nextCompact !== compact;
    if (!initialized || widthChanged || compactChanged || !stableCompactHeight) {
      stableCompactHeight = nextCompact ? measureStableViewportHeight() : rawHeight;
    }
    const nextHeight = nextCompact ? stableCompactHeight : rawHeight;
    const layoutChanged = !initialized || widthChanged || compactChanged || Math.abs(nextHeight - height) > 1;
    width = nextWidth;
    height = nextHeight;
    compact = nextCompact;
    aspect = width / height;
    const pixelBudget = touchDevice ? 2200000 : compact ? 2800000 : 6200000;
    const budgetDpr = Math.sqrt(pixelBudget / Math.max(1, width * height));
    const maximumDpr = saveData ? 1 : touchDevice ? 1.6 : compact ? 2.25 : 2.5;
    const dpr = Math.max(.75, Math.min(devicePixelRatio || 1, maximumDpr, budgetDpr));
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    stage.dataset.renderProfile = touchDevice ? "touch" : compact ? "compact" : "desktop";
    stage.dataset.pixelCount = String(pixelWidth * pixelHeight);
    if (!layoutChanged) return;
    const previousPath = copyPath(activePath);
    cachePath();
    const nextScroll = readScroll();
    targetProgress = clamp(nextScroll / pageMax);
    if (!initialized) {
      currentProgress = targetProgress;
      previousProgress = currentProgress;
      scrollYaw = currentProgress * TAU * .72;
      activePath = pathAt(currentProgress);
      renderedScale = activePath.scale;
      previousScroll = nextScroll;
      initialized = true;
    } else {
      currentProgress = targetProgress;
      previousProgress = currentProgress;
      if (!navigationPath) {
        const resizedPath = copyPath(pathAt(currentProgress));
        if (pathDifference(previousPath, resizedPath) > .002) {
          navigationPath = {
            from: previousPath,
            to: resizedPath,
            started: performance.now(),
            duration: reduceMotion ? 0 : 420
          };
        } else activePath = resizedPath;
      }
    }
  };

  const scheduleResize = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      resize();
      requestRender();
    });
  };

  const scheduleViewportResize = () => {
    clearTimeout(viewportResizeTimer);
    viewportResizeTimer = setTimeout(() => {
      orientationPending = false;
      scheduleResize();
    }, touchDevice ? 320 : compact ? 150 : 80);
  };

  const schedulePathRefresh = () => {
    clearTimeout(pathRefreshTimer);
    pathRefreshTimer = setTimeout(() => {
      if (pathFrame) return;
      pathFrame = requestAnimationFrame(() => {
        pathFrame = 0;
        const previousPath = copyPath(activePath);
        cachePath();
        const refreshedProgress = clamp(readScroll() / pageMax);
        targetProgress = refreshedProgress;
        if (!navigationPath) {
          currentProgress = refreshedProgress;
          previousProgress = refreshedProgress;
          const refreshedPath = copyPath(pathAt(refreshedProgress));
          if (pathDifference(previousPath, refreshedPath) > .002) {
            navigationPath = {
              from: previousPath,
              to: refreshedPath,
              started: performance.now(),
              duration: reduceMotion ? 0 : 420
            };
          } else activePath = refreshedPath;
        }
        requestRender();
      });
    }, compact ? 220 : 140);
  };

  const updateChapter = () => {
    const marker = readScroll() + height * .5;
    let index = 0;
    chapterMetrics.forEach((chapter, chapterIndex) => {
      if (marker >= chapter.top) index = chapterIndex;
    });
    if (index === activeChapter) return;
    const previousChapter = chapterMetrics[activeChapter];
    if (previousChapter) document.body.classList.remove(`planet-chapter-${previousChapter.slug}`);
    activeChapter = index;
    const chapter = chapterMetrics[index];
    if (!chapter) return;
    if (chapterLabel) chapterLabel.textContent = chapter.name;
    document.body.classList.add(`planet-chapter-${chapter.slug}`);
  };

  const setGeometryUniforms = (path, yaw, pitch, roll, localX, localY, localZ, kind, alpha, time) => {
    gl.uniform3f(uniforms.rotation, pitch, yaw, roll);
    gl.uniform3f(uniforms.localRotation, localX, localY, localZ);
    gl.uniform1f(uniforms.scale, renderedScale);
    gl.uniform2f(uniforms.offset, path.x, path.y);
    gl.uniform1f(uniforms.aspect, aspect);
    gl.uniform1f(uniforms.kind, kind);
    gl.uniform1f(uniforms.energy, currentEnergy);
    gl.uniform1f(uniforms.time, time);
    gl.uniform1f(uniforms.alpha, alpha);
    gl.uniform1f(uniforms.textureReady, textureReady);
  };

  const draw = now => {
    const time = now * .001;
    const path = activePath;
    const yaw = scrollYaw + idleYaw;
    const pitch = path.pitch + Math.sin(currentProgress * TAU * 1.7) * .075;
    const roll = Math.sin(currentProgress * TAU * 1.15) * .07;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.disable(gl.BLEND);
    gl.depthMask(true);

    bindGeometry(sphere);
    setGeometryUniforms(path, yaw, pitch, roll, 0, 0, 0, 0, 1, time);
    gl.drawElements(gl.TRIANGLES, sphere.count, gl.UNSIGNED_SHORT, 0);

    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    bindGeometry(ribbon);
    setGeometryUniforms(path, yaw, pitch, roll, 0, 0, 0, 2, .96, time);
    gl.drawElements(gl.TRIANGLES, ribbon.count, gl.UNSIGNED_SHORT, 0);

    gl.enable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    bindGeometry(torus);
    setGeometryUniforms(path, yaw * .18, pitch * .42, roll, 1.02, idleYaw * .52 + currentProgress * .34, -.25, 1, .94, time);
    gl.drawElements(gl.TRIANGLES, torus.count, gl.UNSIGNED_SHORT, 0);
    gl.depthMask(true);

    root.style.setProperty("--planet-glow-x", `${(((path.x + 1) * width) / 2).toFixed(1)}px`);
    root.style.setProperty("--planet-glow-y", `${(((1 - path.y) * height) / 2).toFixed(1)}px`);
    if (degreeLabel) degreeLabel.textContent = `${String(Math.round(((yaw % TAU + TAU) % TAU) / TAU * 360)).padStart(3, "0")}°`;
    if (progressLine) progressLine.style.transform = `scaleX(${currentProgress.toFixed(4)})`;
  };

  const render = now => {
    animationFrame = 0;
    if (!visible) return;
    const frameLimit = saveData ? 66 : touchDevice || compact ? 33 : 16;
    if (now - previousDraw < frameLimit && !reduceMotion) {
      animationFrame = requestAnimationFrame(render);
      return;
    }
    previousDraw = now;
    const delta = Math.min(50, Math.max(1, now - previousFrame));
    previousFrame = now;
    const progressEase = reduceMotion || saveData ? 1 : 1 - Math.exp(-delta * (compact ? .01 : .012));
    const energyEase = 1 - Math.pow(.005, delta / 1000);
    const textureEase = reduceMotion || saveData ? 1 : 1 - Math.exp(-delta * .0045);
    currentProgress = lerp(currentProgress, targetProgress, progressEase);
    const progressDelta = currentProgress - previousProgress;
    previousProgress = currentProgress;
    currentEnergy = lerp(currentEnergy, targetEnergy, energyEase);
    textureReady = lerp(textureReady, textureTarget, textureEase);
    targetEnergy *= Math.pow(.12, delta / 1000);
    const maximumYawStep = (navigationPath ? .72 : 1.65) * delta / 1000;
    const requestedYaw = progressDelta * TAU * .58;
    scrollYaw += clamp(requestedYaw, -maximumYawStep, maximumYawStep);
    if (!reduceMotion && !saveData) idleYaw += delta / 1000 * (compact ? .07 : .09);

    if (navigationPath) {
      const amount = clamp((now - navigationPath.started) / navigationPath.duration);
      activePath = interpolatePath(navigationPath.from, navigationPath.to, journeyEase(amount));
      if (amount >= 1) navigationPath = null;
    } else {
      activePath = pathAt(currentProgress);
    }
    const scaleEase = reduceMotion ? 1 : 1 - Math.exp(-delta * (compact ? .006 : .007));
    const maximumScaleStep = (compact ? .18 : .22) * delta / 1000;
    const requestedScaleStep = (activePath.scale - renderedScale) * scaleEase;
    renderedScale += clamp(requestedScaleStep, -maximumScaleStep, maximumScaleStep);
    draw(now);
    updateChapter();
    if (!reduceMotion && !saveData) animationFrame = requestAnimationFrame(render);
  };

  const requestRender = () => {
    if (animationFrame || orientationPending || safetyMode) return;
    previousFrame = performance.now();
    animationFrame = requestAnimationFrame(render);
  };

  addEventListener("scroll", () => {
    const now = performance.now();
    const nextScroll = readScroll();
    const distance = Math.abs(nextScroll - previousScroll);
    const elapsed = Math.max(16, now - previousScrollTime);
    targetEnergy = Math.max(targetEnergy, clamp((distance / elapsed) / 3.1));
    targetProgress = clamp(nextScroll / pageMax);
    previousScroll = nextScroll;
    previousScrollTime = now;
    stage.classList.toggle("is-hint-hidden", nextScroll > height * .16);
    requestRender();
  }, { passive: true });

  addEventListener("spn:navigation-start", event => {
    const targetY = Number(event.detail?.targetY);
    if (!Number.isFinite(targetY)) return;
    const now = performance.now();
    const navigationProgress = clamp(targetY / pageMax);
    const suppliedDuration = Number(event.detail?.durationMs);
    const duration = reduceMotion
      ? 0
      : clamp(Number.isFinite(suppliedDuration) ? suppliedDuration : 1400, 650, 3200);
    navigationPath = {
      from: copyPath(activePath),
      to: copyPath(pathAt(navigationProgress)),
      started: now,
      duration
    };
    targetEnergy = Math.max(targetEnergy, .2);
    requestRender();
  });

  addEventListener("spn:navigation-cancel", () => {
    if (!navigationPath) return;
    navigationPath = {
      from: copyPath(activePath),
      to: copyPath(pathAt(currentProgress)),
      started: performance.now(),
      duration: 360
    };
    requestRender();
  });

  addEventListener("spn:navigation-complete", () => {
    navigationPath = {
      from: copyPath(activePath),
      to: copyPath(pathAt(currentProgress)),
      started: performance.now(),
      duration: reduceMotion ? 0 : 220
    };
    requestRender();
  });

  const reactiveSelector = ".button,.project-button,.menu-toggle,.desktop-nav a,.mobile-menu nav a,.websites-menu-entry,.service-row,.price-card>button,.bundle-card button,.home-lab__index>a,.home-lab__enter";
  document.querySelectorAll(reactiveSelector).forEach(element => {
    element.setAttribute("data-planet-reactive", "");
    element.addEventListener("pointerenter", () => {
      targetEnergy = Math.max(targetEnergy, .85);
      requestRender();
    }, { passive: true });
    element.addEventListener("pointerdown", () => {
      element.classList.add("is-reacting");
      targetEnergy = 1;
      requestRender();
      setTimeout(() => element.classList.remove("is-reacting"), 320);
    }, { passive: true });
  });

  const enterTouchLandscapeSafety = () => {
    if (!touchDevice) return;
    safetyMode = true;
    orientationPending = false;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    root.classList.add("touch-landscape-safe");
    document.body.classList.add("touch-landscape-safe");
    canvas.style.display = "none";
    activateFallback("touch-landscape-safe");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };

  const settleTouchOrientation = () => {
    if (!touchDevice) return;
    if (touchLandscape()) {
      enterTouchLandscapeSafety();
    } else if (safetyMode) {
      orientationPending = false;
      schedulePathRefresh();
    } else {
      scheduleViewportResize();
    }
  };

  addEventListener("orientationchange", () => {
    if (!touchDevice) return;
    orientationPending = true;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    if (touchLandscape()) {
      enterTouchLandscapeSafety();
      return;
    }
    clearTimeout(orientationSafetyTimer);
    orientationSafetyTimer = setTimeout(settleTouchOrientation, 100);
  }, { passive: true });
  if (touchDevice) {
    if (landscapeQuery.addEventListener) landscapeQuery.addEventListener("change", settleTouchOrientation);
    else landscapeQuery.addListener(settleTouchOrientation);
  }
  addEventListener("resize", scheduleViewportResize, { passive: true });
  addEventListener("load", schedulePathRefresh, { once: true });
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(schedulePathRefresh);
    chapterDefinitions.forEach(([selector]) => {
      const element = document.querySelector(selector);
      if (element) observer.observe(element);
    });
  }

  addEventListener("pageshow", () => {
    targetProgress = clamp(readScroll() / pageMax);
    previousProgress = currentProgress;
    previousScroll = readScroll();
    schedulePathRefresh();
  });

  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
    if (!visible && animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    } else if (visible) requestRender();
  });

  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    safetyMode = true;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    activateFallback(touchLandscape() ? "touch-landscape-safe" : "webgl-fallback");
  }, false);

  resize();
  root.classList.remove("planet-fallback");
  document.body.classList.remove("planet-fallback");
  stage.classList.remove("is-fallback");
  root.classList.add("planet-ready");
  document.body.classList.add("planet-ready");
  updateChapter();
  requestRender();
})();
