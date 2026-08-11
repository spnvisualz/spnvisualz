(() => {
  "use strict";

  const root = document.documentElement;
  const stage = document.getElementById("spnPlanet");
  const canvas = document.getElementById("spnPlanetCanvas");
  if (!stage || !canvas) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = Boolean(connection && connection.saveData);
  let compact = innerWidth <= 720;

  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: !compact,
    depth: true,
    premultipliedAlpha: true,
    powerPreference: compact ? "low-power" : "high-performance"
  }) || canvas.getContext("experimental-webgl");

  if (!gl) {
    stage.classList.add("is-fallback");
    return;
  }

  const TAU = Math.PI * 2;
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const smoothstep = (edge0, edge1, value) => {
    const amount = clamp((value - edge0) / Math.max(.00001, edge1 - edge0));
    return amount * amount * (3 - 2 * amount);
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
    uniform sampler2D uSurface;
    uniform float uKind;
    uniform float uEnergy;
    uniform float uTime;
    uniform float uAlpha;
    varying vec3 vNormal;
    varying vec3 vObject;
    varying vec3 vWorld;
    varying vec2 vUv;

    void main(){
      vec3 n=normalize(vNormal);
      vec3 viewDir=vec3(0.0,0.0,1.0);
      vec3 lightDir=normalize(vec3(-0.58,0.72,0.94));
      float facing=max(dot(n,viewDir),0.0);
      float diffuse=max(dot(n,lightDir),0.0);
      float spec=pow(max(dot(reflect(-lightDir,n),viewDir),0.0),72.0);
      float rim=pow(1.0-facing,2.35);

      if(uKind<0.5){
        vec4 surface=texture2D(uSurface,vUv);
        float land=smoothstep(0.42,0.61,surface.r);
        float edge=1.0-smoothstep(0.025,0.13,abs(surface.r-0.515));
        float micro=surface.g;
        float chromeBand=pow(0.5+0.5*sin((n.y+n.x*.28)*18.0+micro*4.0),8.0);
        float horizonBand=pow(0.5+0.5*sin((n.y*.72-n.x*.18)*31.0),14.0);

        vec3 voidColor=vec3(0.006,0.004,0.015);
        voidColor+=vec3(0.035,0.012,0.085)*(diffuse*.55+rim*.42);
        voidColor+=vec3(0.34,0.22,0.58)*(spec*.65+chromeBand*.055);

        vec3 landDark=vec3(0.055,0.012,0.15);
        vec3 landLight=vec3(0.55,0.34,0.92);
        vec3 landChrome=mix(landDark,landLight,diffuse*.62+micro*.24);
        landChrome+=vec3(0.9,0.83,1.0)*(spec*1.12+chromeBand*.21+horizonBand*.08);
        landChrome+=vec3(0.22,0.08,0.58)*rim*.62;

        vec3 color=mix(voidColor,landChrome,land);
        color+=edge*vec3(0.31,0.12,0.78)*(.18+uEnergy*.26);
        color+=rim*vec3(0.24,0.09,0.62)*(.32+uEnergy*.24);
        color+=spec*vec3(0.72,0.63,1.0)*(.32+uEnergy*.34);
        gl_FragColor=vec4(color,uAlpha);
      }else{
        float pulse=.72+.28*sin(vUv.x*50.0-uTime*1.1);
        vec3 ringDark=vec3(0.12,0.045,0.27);
        vec3 ringLight=vec3(0.82,0.73,1.0);
        vec3 color=mix(ringDark,ringLight,clamp(diffuse*.66+spec*.9,0.0,1.0));
        color+=vec3(0.42,0.18,0.92)*(rim*.5+pulse*.09+uEnergy*.18);
        color+=spec*vec3(1.0,0.96,1.0);
        gl_FragColor=vec4(color,uAlpha*(.58+spec*.32+pulse*.1));
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
    stage.classList.add("is-fallback");
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    stage.classList.add("is-fallback");
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
    alpha: gl.getUniformLocation(program, "uAlpha"),
    surface: gl.getUniformLocation(program, "uSurface")
  };

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

  const hash3 = (x, y, z) => {
    let value = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  };

  const noise3 = (x, y, z) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const xf = x - xi;
    const yf = y - yi;
    const zf = z - zi;
    const sx = xf * xf * (3 - 2 * xf);
    const sy = yf * yf * (3 - 2 * yf);
    const sz = zf * zf * (3 - 2 * zf);
    const x00 = lerp(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), sx);
    const x10 = lerp(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), sx);
    const x01 = lerp(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), sx);
    const x11 = lerp(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), sx);
    return lerp(lerp(x00, x10, sy), lerp(x01, x11, sy), sz);
  };

  const fbm3 = (x, y, z) => {
    let value = 0;
    let amplitude = .56;
    let frequency = 1;
    for (let octave = 0; octave < 4; octave += 1) {
      value += noise3(x * frequency, y * frequency, z * frequency) * amplitude;
      frequency *= 2.03;
      amplitude *= .48;
    }
    return value;
  };

  const createSurfaceTexture = () => {
    const textureWidth = compact ? 256 : 512;
    const textureHeight = compact ? 128 : 256;
    const data = new Uint8Array(textureWidth * textureHeight * 4);
    for (let y = 0; y < textureHeight; y += 1) {
      const v = y / (textureHeight - 1);
      const latitude = (v - .5) * Math.PI;
      const cosLatitude = Math.cos(latitude);
      for (let x = 0; x < textureWidth; x += 1) {
        const u = x / (textureWidth - 1);
        const longitude = u * TAU;
        const px = cosLatitude * Math.cos(longitude);
        const py = Math.sin(latitude);
        const pz = cosLatitude * Math.sin(longitude);
        const broad = fbm3(px * 2.05 + 3.2, py * 2.05 - 1.7, pz * 2.05 + 5.4);
        const detail = fbm3(px * 6.4 - 4.1, py * 6.4 + 2.8, pz * 6.4 + 1.3);
        const frontness = smoothstep(.05, .55, pz);
        const sCenter = -.4 * Math.sin(py * 3.45);
        const sWidth = .115 + .035 * (1 - Math.abs(py));
        const sStroke = (1 - smoothstep(sWidth, sWidth + .065, Math.abs(px - sCenter)))
          * (1 - smoothstep(.69, .82, Math.abs(py))) * frontness;
        const plates = clamp((broad - .43) * 2.4 + (detail - .5) * .3);
        const farSideLand = plates * (1 - frontness * .9);
        const field = clamp(Math.max(farSideLand, sStroke * (.82 + detail * .18)));
        const index = (y * textureWidth + x) * 4;
        data[index] = Math.round(field * 255);
        data[index + 1] = Math.round(detail * 255);
        data[index + 2] = Math.round(broad * 255);
        data[index + 3] = 255;
      }
    }
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, textureWidth, textureHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  };

  const sphere = createSphere(compact ? 38 : 58, compact ? 52 : 78);
  const torus = createTorus(compact ? 72 : 112, compact ? 6 : 9, 1.42, compact ? .026 : .032);
  const surfaceTexture = createSurfaceTexture();
  gl.uniform1i(uniforms.surface, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, surfaceTexture);

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
  let width = 1;
  let height = 1;
  let aspect = 1;
  let pageMax = 1;
  let keyframes = [];
  let chapterMetrics = [];
  let targetProgress = 0;
  let currentProgress = 0;
  let targetEnergy = 0;
  let currentEnergy = 0;
  let targetPointerX = 0;
  let targetPointerY = 0;
  let pointerX = 0;
  let pointerY = 0;
  let manualYaw = 0;
  let manualPitch = 0;
  let activeChapter = -1;
  let activePath = { x: .42, y: .02, scale: .84, opacity: .95, pitch: -.08 };
  let previousScroll = scrollY;
  let previousScrollTime = performance.now();
  let previousFrame = performance.now();
  let previousDraw = 0;
  let animationFrame = 0;
  let resizeFrame = 0;
  let visible = !document.hidden;
  let dragging = false;
  let dragMode = "";
  let dragId = -1;
  let dragX = 0;
  let dragY = 0;

  const sectionPoint = (selector, amount = 0) => {
    const element = document.querySelector(selector);
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    return clamp((scrollY + rect.top + rect.height * amount) / pageMax);
  };

  const cachePath = () => {
    pageMax = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    chapterMetrics = chapterDefinitions.map(([selector, name, slug], index) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return {
        name,
        slug,
        index,
        top: rect ? scrollY + rect.top : index * innerHeight,
        height: rect ? rect.height : innerHeight
      };
    });

    const heroEnd = sectionPoint("#top", .88);
    const studio = sectionPoint(".manifesto", .42);
    const workStart = sectionPoint("#work", .04);
    const workMiddle = sectionPoint("#work", .5);
    const workEnd = sectionPoint("#work", .96);
    const services = sectionPoint("#services", .42);
    const pricing = sectionPoint("#pricing", .42);
    const process = sectionPoint(".process", .45);
    const lab = sectionPoint("#visual-lab", .45);
    const contact = sectionPoint("#contact", .46);
    const desktopPath = [
      { p: 0, x: .43, y: .03, scale: .88, opacity: .98, pitch: -.08 },
      { p: heroEnd, x: .43, y: -.03, scale: .8, opacity: .9, pitch: -.03 },
      { p: studio, x: .5, y: -.08, scale: .62, opacity: .55, pitch: .1 },
      { p: workStart, x: -.05, y: .04, scale: 1.08, opacity: .26, pitch: -.12 },
      { p: workMiddle, x: .5, y: .21, scale: .5, opacity: .32, pitch: .12 },
      { p: workEnd, x: -.46, y: -.18, scale: .46, opacity: .36, pitch: -.08 },
      { p: services, x: -.5, y: .12, scale: .58, opacity: .5, pitch: .1 },
      { p: pricing, x: .5, y: -.08, scale: .54, opacity: .47, pitch: -.1 },
      { p: process, x: -.48, y: .18, scale: .48, opacity: .4, pitch: .14 },
      { p: lab, x: .48, y: .12, scale: .57, opacity: .48, pitch: -.08 },
      { p: contact, x: .34, y: .02, scale: 1.02, opacity: .72, pitch: .03 },
      { p: 1, x: 0, y: 0, scale: 1.36, opacity: .22, pitch: 0 }
    ];
    const mobilePath = [
      { p: 0, x: .5, y: .17, scale: .63, opacity: .92, pitch: -.06 },
      { p: heroEnd, x: .45, y: .07, scale: .58, opacity: .72, pitch: -.02 },
      { p: studio, x: .5, y: -.2, scale: .44, opacity: .4, pitch: .08 },
      { p: workStart, x: 0, y: -.05, scale: .82, opacity: .2, pitch: -.08 },
      { p: workMiddle, x: .5, y: .24, scale: .38, opacity: .25, pitch: .1 },
      { p: workEnd, x: -.5, y: -.18, scale: .38, opacity: .3, pitch: -.06 },
      { p: services, x: -.53, y: .14, scale: .45, opacity: .38, pitch: .08 },
      { p: pricing, x: .52, y: -.06, scale: .42, opacity: .35, pitch: -.08 },
      { p: process, x: -.52, y: .2, scale: .4, opacity: .32, pitch: .1 },
      { p: lab, x: .52, y: .12, scale: .44, opacity: .36, pitch: -.06 },
      { p: contact, x: .38, y: .08, scale: .7, opacity: .5, pitch: .03 },
      { p: 1, x: 0, y: 0, scale: .9, opacity: .18, pitch: 0 }
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

  const resize = () => {
    width = Math.max(1, innerWidth);
    height = Math.max(1, innerHeight);
    compact = width <= 720;
    aspect = width / height;
    const dpr = Math.min(devicePixelRatio || 1, saveData ? 1 : compact ? 1 : 1.35);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
    cachePath();
    targetProgress = clamp(scrollY / pageMax);
    currentProgress = targetProgress;
    activePath = pathAt(currentProgress);
  };

  const scheduleResize = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      resize();
      requestRender();
    });
  };

  const updateChapter = () => {
    const marker = scrollY + height * .5;
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
    gl.uniform1f(uniforms.scale, path.scale);
    gl.uniform2f(uniforms.offset, path.x, path.y);
    gl.uniform1f(uniforms.aspect, aspect);
    gl.uniform1f(uniforms.kind, kind);
    gl.uniform1f(uniforms.energy, currentEnergy);
    gl.uniform1f(uniforms.time, time);
    gl.uniform1f(uniforms.alpha, alpha);
  };

  const draw = now => {
    const time = now * .001;
    const path = activePath;
    const idle = reduceMotion || saveData ? 0 : time * (compact ? .055 : .08);
    const yaw = currentProgress * TAU * 3.4 + manualYaw + pointerX * .3 + idle;
    const pitch = path.pitch + manualPitch - pointerY * .2 + Math.sin(currentProgress * TAU * 1.7) * .075;
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
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    bindGeometry(torus);
    setGeometryUniforms(path, yaw * .22, pitch * .45, roll, 1.02, time * .09 + currentProgress * .4, -.25, 1, .86, time);
    gl.drawElements(gl.TRIANGLES, torus.count, gl.UNSIGNED_SHORT, 0);
    setGeometryUniforms(path, yaw * .14, pitch * .35, roll, .34, time * -.065, .93, 1, .46, time);
    gl.drawElements(gl.TRIANGLES, torus.count, gl.UNSIGNED_SHORT, 0);
    gl.depthMask(true);

    root.style.setProperty("--planet-opacity", path.opacity.toFixed(3));
    root.style.setProperty("--planet-energy", currentEnergy.toFixed(3));
    root.style.setProperty("--planet-glow-x", `${((path.x + 1) * 50).toFixed(2)}%`);
    root.style.setProperty("--planet-glow-y", `${((1 - path.y) * 50).toFixed(2)}%`);
    if (degreeLabel) degreeLabel.textContent = `${String(Math.round(((yaw % TAU + TAU) % TAU) / TAU * 360)).padStart(3, "0")}°`;
    if (progressLine) progressLine.style.transform = `scaleX(${currentProgress.toFixed(4)})`;
  };

  const render = now => {
    animationFrame = 0;
    if (!visible) return;
    const frameLimit = saveData ? 66 : compact ? 33 : 16;
    if (now - previousDraw < frameLimit && !reduceMotion) {
      animationFrame = requestAnimationFrame(render);
      return;
    }
    previousDraw = now;
    const delta = Math.min(50, Math.max(1, now - previousFrame));
    previousFrame = now;
    const progressEase = reduceMotion || saveData ? 1 : 1 - Math.pow(.0015, delta / 1000);
    const pointerEase = reduceMotion || saveData ? 1 : 1 - Math.pow(.009, delta / 1000);
    const energyEase = 1 - Math.pow(.005, delta / 1000);
    currentProgress = lerp(currentProgress, targetProgress, progressEase);
    pointerX = lerp(pointerX, targetPointerX, pointerEase);
    pointerY = lerp(pointerY, targetPointerY, pointerEase);
    currentEnergy = lerp(currentEnergy, targetEnergy, energyEase);
    targetEnergy *= Math.pow(.12, delta / 1000);
    activePath = pathAt(currentProgress);
    draw(now);
    updateChapter();
    if (!reduceMotion && !saveData) animationFrame = requestAnimationFrame(render);
  };

  const requestRender = () => {
    if (animationFrame) return;
    previousFrame = performance.now();
    animationFrame = requestAnimationFrame(render);
  };

  addEventListener("scroll", () => {
    const now = performance.now();
    const nextScroll = scrollY;
    const distance = Math.abs(nextScroll - previousScroll);
    const elapsed = Math.max(16, now - previousScrollTime);
    targetEnergy = Math.max(targetEnergy, clamp((distance / elapsed) / 2.4));
    targetProgress = clamp(nextScroll / pageMax);
    previousScroll = nextScroll;
    previousScrollTime = now;
    stage.classList.toggle("is-hint-hidden", nextScroll > height * .16);
    requestRender();
  }, { passive: true });

  addEventListener("pointermove", event => {
    if (finePointer && !dragging) {
      targetPointerX = clamp(event.clientX / width, 0, 1) - .5;
      targetPointerY = clamp(event.clientY / height, 0, 1) - .5;
    }
    if (!dragging || event.pointerId !== dragId) return;
    const dx = event.clientX - dragX;
    const dy = event.clientY - dragY;
    if (dragMode === "pending" && Math.hypot(dx, dy) > 7) {
      if (event.pointerType === "mouse" || Math.abs(dx) > Math.abs(dy) * 1.15) dragMode = "orbit";
      else {
        dragging = false;
        dragMode = "";
        document.body.classList.remove("is-planet-dragging");
        return;
      }
    }
    if (dragMode === "orbit") {
      manualYaw += dx * (compact ? .0065 : .008);
      if (event.pointerType === "mouse") manualPitch = clamp(manualPitch - dy * .0045, -.5, .5);
      dragX = event.clientX;
      dragY = event.clientY;
      targetEnergy = 1;
      requestRender();
    }
  }, { passive: true });

  addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target.closest("a,button,input,select,textarea,summary,[role='button']")) return;
    const centerX = (activePath.x + 1) * width * .5;
    const centerY = (1 - activePath.y) * height * .5;
    const radius = activePath.scale * height * .56;
    if (Math.hypot(event.clientX - centerX, event.clientY - centerY) > radius) return;
    dragging = true;
    dragMode = event.pointerType === "mouse" ? "orbit" : "pending";
    dragId = event.pointerId;
    dragX = event.clientX;
    dragY = event.clientY;
    document.body.classList.add("is-planet-dragging");
  }, { passive: true });

  const endDrag = event => {
    if (!dragging || event.pointerId !== dragId) return;
    dragging = false;
    dragMode = "";
    dragId = -1;
    document.body.classList.remove("is-planet-dragging");
  };
  addEventListener("pointerup", endDrag, { passive: true });
  addEventListener("pointercancel", endDrag, { passive: true });
  addEventListener("pointerleave", event => {
    if (!dragging) {
      targetPointerX = 0;
      targetPointerY = 0;
    } else endDrag(event);
  }, { passive: true });

  const reactiveSelector = ".button,.project-button,.menu-toggle,.desktop-nav a,.mobile-menu nav a,.websites-menu-entry,.service-row,.price-card>button,.bundle-card button,.home-lab__index>a,.home-lab__enter";
  document.querySelectorAll(reactiveSelector).forEach(element => {
    element.setAttribute("data-planet-reactive", "");
    element.addEventListener("pointerenter", () => {
      targetEnergy = Math.max(targetEnergy, .55);
      requestRender();
    }, { passive: true });
    element.addEventListener("pointerdown", () => {
      element.classList.add("is-reacting");
      targetEnergy = 1;
      requestRender();
      setTimeout(() => element.classList.remove("is-reacting"), 320);
    }, { passive: true });
  });

  addEventListener("resize", scheduleResize, { passive: true });
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(document.body);
  }

  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
    if (!visible && animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    } else if (visible) requestRender();
  });

  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    root.classList.remove("planet-ready");
    document.body.classList.remove("planet-ready");
    stage.classList.add("is-fallback");
  }, false);

  resize();
  currentProgress = targetProgress;
  activePath = pathAt(currentProgress);
  root.classList.add("planet-ready");
  document.body.classList.add("planet-ready");
  updateChapter();
  requestRender();
})();
