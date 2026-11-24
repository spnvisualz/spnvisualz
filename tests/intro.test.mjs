import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const code = readFileSync(new URL('../public/assets/js/intro.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function runtime({ width = 390, height = 844, reduced = false, seen = false, posterLoaded = true } = {}) {
  let now = 1, id = 0, removed = false;
  const frames = new Map(), timers = new Map(), draws = [], events = [];
  const target = () => ({
    handlers: {},
    addEventListener(name, fn) { this.handlers[name] = fn; },
    removeEventListener(name) { delete this.handlers[name]; },
    emit(name, value) { this.handlers[name]?.(value); }
  });
  const classes = () => {
    const values = new Set();
    return { add: (...names) => names.forEach(n => values.add(n)), remove: n => values.delete(n), contains: n => values.has(n) };
  };
  const context = new Proxy({}, { get(obj, key) {
    if (key === 'drawImage') return (img, ...coords) => {
      assert.ok(img.complete && img.naturalWidth, 'never draw unloaded art');
      assert.ok(coords.every(Number.isFinite), 'finite image placement');
      draws.push({ letter: img.letter, coords });
    };
    if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => ({ addColorStop() {} });
    return obj[key] ?? (() => {});
  } });
  const canvas = { style: {}, getContext: () => context };
  const poster = { ...target(), letter: 'S', complete: posterLoaded, naturalWidth: posterLoaded ? 1254 : 0, naturalHeight: 1254 };
  const enter = target(), skip = target();
  const overlay = {
    classList: classes(), remove: () => { removed = true; },
    querySelector(selector) {
      if (selector === '.spn-intro__poster') return poster;
      if (selector === '.spn-intro__enter') return enter;
      if (selector === '.spn-intro__skip') return skip;
      return null;
    }
  };
  const root = { classList: classes() };
  const document = {
    ...target(), documentElement: root, readyState: 'complete', hidden: false,
    getElementById: name => name === 'spnIntro' ? overlay : canvas
  };
  const window = { ...target(), innerWidth: width, innerHeight: height, devicePixelRatio: 2, dispatchEvent: e => events.push(e.type) };
  runInNewContext(code, {
    document, window, navigator: { hardwareConcurrency: 4 },
    matchMedia: () => ({ matches: reduced }),
    sessionStorage: { getItem: () => seen ? '1' : null, setItem() {} },
    CustomEvent: class { constructor(type) { this.type = type; } },
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: (fn, delay) => { timers.set(++id, { fn, at: now + delay }); return id; },
    performance: { now: () => now }
  });
  const advance = (end) => {
    while (now < end) {
      now += 1000 / 60;
      const queued = [...frames.values()]; frames.clear();
      queued.forEach(fn => fn(now));
      for (const [key, timer] of timers) if (timer.at <= now) { timers.delete(key); timer.fn(); }
    }
  };
  return { advance, draws, events, root, overlay, window, document, enter, skip, poster, frames, get removed() { return removed; } };
}

test('the arrival is the S planet alone; the old companion worlds are gone', () => {
  assert.ok(html.includes('src="/assets/images/spn-orb-arrival.webp"'));
  assert.ok(html.includes('as="image" href="/assets/images/spn-orb-arrival.webp"'));
  assert.ok(!html.includes('data-planet-letter'), 'no companion planet markup');
  assert.ok(!/spn-planet-[nht]\.webp/.test(html), 'no companion planet assets referenced');
  assert.ok(!code.includes('fillText'), 'no browser-font lettering in the canvas');
});

for (const [width, height] of [[390, 844], [360, 640], [1440, 900], [844, 390]]) {
  test(`planet rise lands on the S planet and exits at ${width}×${height}`, () => {
    const r = runtime({ width, height });
    r.advance(6400);
    assert.deepEqual([...new Set(r.draws.map(d => d.letter))], ['S']);
    assert.ok(r.removed);
    assert.equal(r.window.__spnIntroActive, false);
    assert.equal(r.root.classList.contains('intro-active'), false);
    assert.equal(r.frames.size, 0);
    assert.deepEqual(r.events, ['spn:intro-done']);
  });
}

test('the planet art stays a silhouette until the ring is drawn', () => {
  const r = runtime(); r.advance(3600);
  assert.equal(r.draws.length, 0, 'horizon, pull-back and ring trace use no artwork');
  r.advance(4600);
  assert.ok(r.draws.length > 0, 'lit by 4.6s');
});
test('reduced motion shows static main Orb and exits without animation', () => {
  const r = runtime({ reduced: true }); r.advance(2400);
  assert.ok(r.overlay.classList.contains('is-static'));
  assert.equal(r.draws.length, 0);
  assert.ok(r.removed);
});
test('repeat visits skip the sequence', () => {
  const r = runtime({ seen: true });
  assert.ok(r.removed); assert.equal(r.frames.size, 0);
});
for (const exit of ['skip', 'enter', 'Escape', 'Enter', ' ']) {
  test(`${JSON.stringify(exit)} exits once and releases scroll`, () => {
    const r = runtime(); r.advance(100);
    if (exit === 'skip' || exit === 'enter') r[exit].emit('click');
    else r.document.emit('keydown', { key: exit });
    r.advance(1000);
    assert.ok(r.removed);
    assert.equal(r.root.classList.contains('intro-active'), false);
    assert.deepEqual(r.events, ['spn:intro-done']);
  });
}
test('a late poster load cannot start a second animation loop', () => {
  const r = runtime({ posterLoaded: false }); r.advance(800);
  assert.equal(r.frames.size, 1);
  r.poster.complete = true; r.poster.naturalWidth = 1254;
  r.poster.emit('load');
  assert.equal(r.frames.size, 1);
  r.advance(7200); assert.ok(r.removed);
});
