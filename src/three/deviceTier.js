// Capability-based render tiering for the planet.
//
// The previous implementation branched heavily on device *category*
// (touch vs. not, "Apple touch" vs. other touch, landscape vs. portrait)
// rather than what the device can actually do. Per direction: keep the
// real 3D planet everywhere it's genuinely capable of running it, and only
// step down when specific signals say otherwise — not because a device
// happens to be a phone.
//
// Tiers:
//   "full"    — full-resolution sphere, full shader, DPR up to 2
//   "reduced" — lower tessellation/DPR, same shader (visual concept intact)
//   "minimal" — static/CSS fallback (only when WebGL2 truly unavailable,
//               a context creation failure occurs, or the user has
//               data-saver / reduced-motion switched on)

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function hasWebGL2() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

function readGpuTierHint() {
  // Best-effort GPU string via the debug extension. Frequently blocked by
  // privacy settings — never depended on alone, only used as a bonus signal.
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return null;
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "";
    const lowered = String(renderer).toLowerCase();
    if (/(swiftshader|llvmpipe|software|microsoft basic render)/.test(lowered)) {
      return "software";
    }
    return "hardware";
  } catch {
    return null;
  }
}

export function assessDeviceTier() {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = Boolean(connection && connection.saveData);
  const slowConnection = Boolean(
    connection && /(^|-)2g$/.test(connection.effectiveType || "")
  );

  const webgl2 = hasWebGL2();
  const gpuHint = readGpuTierHint();
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4; // GiB, Chromium-only; defaults sanely elsewhere
  const dpr = window.devicePixelRatio || 1;

  if (!webgl2 || gpuHint === "software") {
    return {
      tier: "minimal",
      reason: !webgl2 ? "no-webgl2" : "software-renderer",
      reduceMotion,
      maxDpr: 1,
      sphereSegments: 0
    };
  }

  if (saveData || slowConnection) {
    return {
      tier: "minimal",
      reason: "data-saver",
      reduceMotion,
      maxDpr: 1,
      sphereSegments: 0
    };
  }

  const constrained = cores <= 4 || memory <= 4;

  if (constrained) {
    return {
      tier: "reduced",
      reason: "constrained-hardware",
      reduceMotion,
      maxDpr: clamp(dpr, 1, 1.75),
      sphereSegments: 72
    };
  }

  return {
    tier: "full",
    reason: "capable",
    reduceMotion,
    maxDpr: clamp(dpr, 1, 2),
    sphereSegments: 160
  };
}
