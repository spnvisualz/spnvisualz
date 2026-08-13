(() => {
  "use strict";

  const root = document.documentElement;
  const stage = document.getElementById("spnPlanet");
  const canvas = document.getElementById("spnPlanetCanvas");
  if (!stage || !canvas) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = Boolean(connection && connection.saveData);
  let compact = innerWidth <= 720;

  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: !compact && !saveData,
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
    uniform float uKind;
    uniform float uEnergy;
    uniform float uTime;
    uniform float uAlpha;
    varying vec3 vNormal;
    varying vec3 vObject;
    varying vec3 vWorld;
    varying vec2 vUv;

    const float PI=3.14159265359;
    const float TAU=6.28318530718;

    float wrapAngle(float angle){
      return mod(angle+PI,TAU)-PI;
    }

    void main(){
      vec3 n=normalize(vNormal);
      vec3 viewDir=vec3(0.0,0.0,1.0);
      vec3 lightDir=normalize(vec3(-0.58,0.72,0.94));
      float facing=max(dot(n,viewDir),0.0);
      float diffuse=max(dot(n,lightDir),0.0);
      float spec=pow(max(dot(reflect(-lightDir,n),viewDir),0.0),72.0);
      float rim=pow(1.0-facing,2.35);
      float shell=pow(1.0-facing,1.18);

      if(uKind<0.5){
        /* The front and mirrored rear S meet at both poles as one closed loop. */
        float latitude=(0.5-vUv.y)*PI;
        float longitude=vUv.x*TAU;
        float latitudeUnit=clamp(latitude/(PI*.5),-1.0,1.0);
        float poleToPole=acos(latitudeUnit);
        float curve=sin(poleToPole*2.0);
        float frontCenter=PI*.5+curve*.62;
        float backCenter=PI*1.5-curve*.62;
        float latitudeScale=max(.085,cos(latitude));
        float frontDistance=abs(wrapAngle(longitude-frontCenter))*latitudeScale;
        float backDistance=abs(wrapAngle(longitude-backCenter))*latitudeScale;
        float ribbonDistance=min(frontDistance,backDistance);
        float ribbon=1.0-smoothstep(.108,.166,ribbonDistance);
        float ribbonEdge=1.0-smoothstep(.016,.046,abs(ribbonDistance-.129));
        float ribbonCore=1.0-smoothstep(.0,.032,ribbonDistance);

        float micro=.5+.5*sin(vObject.x*53.0+vObject.y*37.0-vObject.z*41.0);
        float chromeBand=pow(.5+.5*sin((n.y+n.x*.26)*19.0+uTime*.055),10.0);
        float horizonBand=pow(.5+.5*sin((n.y*.74-n.x*.2)*33.0),16.0);

        vec3 globeColor=vec3(.038,.022,.066);
        globeColor+=vec3(.19,.075,.38)*(diffuse*.64+rim*.64);
        globeColor+=vec3(.5,.34,.78)*(chromeBand*.12+horizonBand*.055);
        globeColor+=vec3(.98,.9,1.0)*spec*.9;
        globeColor+=vec3(.34,.14,.68)*shell*.28;

        float ribbonLight=clamp(diffuse*.78+spec*1.18+chromeBand*.22+micro*.07,0.0,1.0);
        vec3 ribbonColor=mix(vec3(.17,.095,.29),vec3(.94,.91,1.0),ribbonLight);
        ribbonColor+=vec3(.42,.17,.82)*rim*.58;
        ribbonColor+=vec3(1.0,.96,1.0)*(spec*.7+horizonBand*.12);

        vec3 color=mix(globeColor,ribbonColor,ribbon);
        color+=ribbonEdge*vec3(.78,.55,1.0)*(.35+uEnergy*.26);
        color+=ribbonCore*vec3(.34,.12,.62)*.1;
        color+=rim*vec3(.54,.27,.96)*(.42+uEnergy*.18);
        color+=spec*vec3(1.0,.96,1.0)*(.24+uEnergy*.28);
        color=pow(max(color,vec3(0.0)),vec3(.84));
        gl_FragColor=vec4(color,1.0);
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
    alpha: gl.getUniformLocation(program, "uAlpha")
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

  const sphere = createSphere(compact ? 80 : 128, compact ? 112 : 192);
  const torus = createTorus(compact ? 112 : 180, compact ? 10 : 14, 1.42, compact ? .026 : .032);

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
  let scrollYaw = 0;
  let targetEnergy = 0;
  let currentEnergy = 0;
  let navigationProgress = null;
  let navigationPath = null;
  let navigationLockUntil = 0;
  let activeChapter = -1;
  let activePath = { x: .42, y: .02, scale: .84, opacity: 1, pitch: -.08 };
  let previousScroll = scrollY;
  let previousScrollTime = performance.now();
  let previousFrame = performance.now();
  let previousDraw = 0;
  let animationFrame = 0;
  let resizeFrame = 0;
  let visible = !document.hidden;

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
      { p: 0, x: .42, y: .02, scale: 1.1, opacity: 1, pitch: -.08 },
      { p: heroEnd, x: .38, y: -.03, scale: 1.04, opacity: 1, pitch: -.03 },
      { p: studio, x: -.42, y: .02, scale: 1.12, opacity: 1, pitch: .1 },
      { p: workStart, x: .5, y: .02, scale: 1.08, opacity: 1, pitch: -.12 },
      { p: workTwo, x: -.5, y: -.08, scale: .92, opacity: 1, pitch: .08 },
      { p: workThree, x: .52, y: .12, scale: 1, opacity: 1, pitch: -.08 },
      { p: workFour, x: -.48, y: .06, scale: .92, opacity: 1, pitch: .1 },
      { p: workFive, x: .5, y: -.1, scale: 1.06, opacity: 1, pitch: -.1 },
      { p: workEnd, x: -.4, y: .1, scale: .95, opacity: 1, pitch: -.08 },
      { p: services, x: .5, y: .08, scale: 1.05, opacity: 1, pitch: .1 },
      { p: pricing, x: -.48, y: -.02, scale: 1, opacity: 1, pitch: -.1 },
      { p: process, x: .48, y: .12, scale: .98, opacity: 1, pitch: .14 },
      { p: lab, x: -.44, y: .05, scale: 1.08, opacity: 1, pitch: -.08 },
      { p: contact, x: .28, y: .02, scale: 1.35, opacity: 1, pitch: .03 },
      { p: 1, x: 0, y: 0, scale: 1.55, opacity: 1, pitch: 0 }
    ];
    const mobilePath = [
      { p: 0, x: .38, y: .12, scale: .84, opacity: 1, pitch: -.06 },
      { p: heroEnd, x: .36, y: .04, scale: .8, opacity: 1, pitch: -.02 },
      { p: studio, x: -.42, y: -.06, scale: .86, opacity: 1, pitch: .08 },
      { p: workStart, x: .38, y: -.03, scale: .9, opacity: 1, pitch: -.08 },
      { p: workTwo, x: -.4, y: -.08, scale: .78, opacity: 1, pitch: .08 },
      { p: workThree, x: .42, y: .12, scale: .84, opacity: 1, pitch: -.08 },
      { p: workFour, x: -.4, y: .06, scale: .78, opacity: 1, pitch: .08 },
      { p: workFive, x: .4, y: -.08, scale: .88, opacity: 1, pitch: -.08 },
      { p: workEnd, x: -.38, y: .08, scale: .8, opacity: 1, pitch: -.06 },
      { p: services, x: .42, y: .1, scale: .84, opacity: 1, pitch: .08 },
      { p: pricing, x: -.42, y: -.05, scale: .82, opacity: 1, pitch: -.08 },
      { p: process, x: .4, y: .14, scale: .8, opacity: 1, pitch: .1 },
      { p: lab, x: -.4, y: .08, scale: .86, opacity: 1, pitch: -.06 },
      { p: contact, x: .25, y: .06, scale: 1.05, opacity: 1, pitch: .03 },
      { p: 1, x: 0, y: 0, scale: 1.15, opacity: 1, pitch: 0 }
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

  const interpolatePath = (from, to, amount) => ({
    x: lerp(from.x, to.x, amount),
    y: lerp(from.y, to.y, amount),
    scale: lerp(from.scale, to.scale, amount),
    opacity: 1,
    pitch: lerp(from.pitch, to.pitch, amount)
  });

  const resize = () => {
    width = Math.max(1, innerWidth);
    height = Math.max(1, innerHeight);
    compact = width <= 720;
    aspect = width / height;
    const dpr = Math.min(devicePixelRatio || 1, saveData ? 1 : compact ? 2 : 2.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
    cachePath();
    targetProgress = clamp(scrollY / pageMax);
    currentProgress = targetProgress;
    scrollYaw = currentProgress * TAU * 1.35;
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
    const yaw = scrollYaw + idle;
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
    const energyEase = 1 - Math.pow(.005, delta / 1000);
    currentProgress = lerp(currentProgress, targetProgress, progressEase);
    currentEnergy = lerp(currentEnergy, targetEnergy, energyEase);
    targetEnergy *= Math.pow(.12, delta / 1000);
    const navigating = navigationProgress !== null && now < navigationLockUntil;
    const desiredYaw = currentProgress * TAU * 1.35;
    const maximumYawStep = (navigating ? 1.35 : 2.8) * delta / 1000;
    scrollYaw += clamp(desiredYaw - scrollYaw, -maximumYawStep, maximumYawStep);

    if (navigationPath) {
      const amount = clamp((now - navigationPath.started) / navigationPath.duration);
      activePath = interpolatePath(navigationPath.from, navigationPath.to, smoothstep(0, 1, amount));
      if (amount >= 1) navigationPath = null;
    } else {
      activePath = pathAt(currentProgress);
    }
    if (navigationProgress !== null && now >= navigationLockUntil) navigationProgress = null;
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
    const navigating = navigationProgress !== null && now < navigationLockUntil;
    targetEnergy = Math.max(targetEnergy, navigating ? .18 : clamp((distance / elapsed) / 2.4));
    targetProgress = navigating ? navigationProgress : clamp(nextScroll / pageMax);
    previousScroll = nextScroll;
    previousScrollTime = now;
    stage.classList.toggle("is-hint-hidden", nextScroll > height * .16);
    requestRender();
  }, { passive: true });

  addEventListener("spn:navigation-start", event => {
    const targetY = Number(event.detail?.targetY);
    if (!Number.isFinite(targetY)) return;
    const now = performance.now();
    navigationProgress = clamp(targetY / pageMax);
    navigationLockUntil = now + 1300;
    navigationPath = {
      from: copyPath(activePath),
      to: copyPath(pathAt(navigationProgress)),
      started: now,
      duration: 1300
    };
    targetProgress = navigationProgress;
    targetEnergy = Math.max(targetEnergy, .22);
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
