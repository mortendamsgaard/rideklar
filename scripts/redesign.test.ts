import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { markerAngle } from '../app/ride-style.ts';
import { parseCatalog, resolveStoredProgram } from '../lib/program.ts';

const read = (p: string) =>
  fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

void test('the program picker is a native select with no component library', () => {
  const page = read('app/page.tsx');
  assert.match(page, /<select/, 'page.tsx should render a native <select>');
  assert.doesNotMatch(page, /@\/components/, 'no component-library imports');
  assert.doesNotMatch(page, /SelectTrigger|SelectContent|SelectItem/);
  assert.ok(
    !fs.existsSync(new URL('../components', import.meta.url)),
    'components/ directory should be gone',
  );
  assert.ok(
    !fs.existsSync(new URL('../lib/utils.ts', import.meta.url)),
    'lib/utils.ts should be gone',
  );
});

void test('no Tailwind or shadcn layer remains', () => {
  const css = read('app/globals.css');
  for (const token of [
    '@import',
    '@theme',
    '@apply',
    '@layer',
    '@custom-variant',
  ]) {
    assert.doesNotMatch(css, new RegExp(token), `${token} should be gone`);
  }
  assert.doesNotMatch(read('app/layout.tsx'), /antialiased/);
  assert.doesNotMatch(read('vite.config.ts'), /tailwind/i);

  const pkg = JSON.parse(read('package.json'));
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), [
    'lucide-react',
    'react',
    'react-dom',
    'react-server-dom-webpack',
    'vinext',
  ]);
  for (const dead of ['tailwindcss', '@tailwindcss/postcss']) {
    assert.ok(!(dead in pkg.devDependencies), `${dead} should be gone`);
  }
});

void test('stable-warmth palette and display font are defined', () => {
  const css = read('app/globals.css');
  const tokens: Record<string, string> = {
    '--sand': '#faf4e9',
    '--arena-fill': '#f2e4cc',
    '--gold': '#c98a2e',
    '--leather': '#96601f',
    '--ink': '#3a2c1d',
    '--surface': '#fffdf8',
    '--muted': '#6b5741',
  };
  for (const [name, value] of Object.entries(tokens)) {
    assert.match(
      css,
      new RegExp(`${name}:\\s*${value}`),
      `${name} should be ${value}`,
    );
  }
  assert.doesNotMatch(
    css,
    /#f4f6f5|#176d5e/,
    'old sage palette should be gone',
  );

  const layout = read('app/layout.tsx');
  assert.match(layout, /Fraunces/, 'layout should load Fraunces');
  assert.doesNotMatch(layout, /Geist/, 'Geist should be gone');
});

void test('route colours are untouched', () => {
  const style = read('app/ride-style.ts');
  for (const hex of ['#25813b', '#2365c7', '#c63838', '#62717c']) {
    assert.match(style, new RegExp(hex, 'i'), `${hex} must remain`);
  }
});

void test('the first screen fits an iPhone 14 viewport without scrolling', () => {
  const css = read('app/globals.css');
  const px = (name: string) => {
    const m = css.match(new RegExp(`${name}:\\s*(\\d+)px`));
    assert.ok(m, `${name} must be declared in :root as a px value`);
    return Number(m![1]);
  };
  const total =
    px('--h-header') +
    px('--h-arena') +
    px('--h-text') +
    px('--h-control-row') +
    px('--h-gaps') +
    px('--h-render-slack');
  const target = px('--vp-target');
  assert.equal(target, 664, 'iPhone 14 Safari visible viewport');
  assert.ok(
    total <= target,
    `first screen is ${total}px but must fit ${target}px — reduce --h-arena`,
  );
});

void test('the arena is sized by height so both arena shapes fill the same slot', () => {
  const css = read('app/globals.css');
  const rule = css.match(/\.arena\s*\{[^}]*\}/);
  assert.ok(rule, '.arena rule must exist');
  assert.match(rule![0], /height:\s*var\(--h-arena\)/);
  assert.match(rule![0], /width:\s*auto/, 'width must be auto, not 100%');
});

void test('player markup exposes the new layout hooks', () => {
  const code = read('app/program-player.tsx');
  for (const hook of [
    'app-header',
    'stage',
    'exercise-head',
    'controls-primary',
    'program-list',
    'program-row',
  ]) {
    assert.match(code, new RegExp(`["']${hook}`), `missing .${hook}`);
  }
  assert.doesNotMatch(
    code,
    /className="badges"/,
    'badges row folds into the header',
  );
  assert.doesNotMatch(
    code,
    /exercise-grid/,
    'grid of big buttons is replaced by rows',
  );
  assert.doesNotMatch(
    code,
    /LA1|LA4|la1-b|la4-b/,
    'renderer stays program-agnostic',
  );
});

void test('no sage-palette colours remain in the stylesheet', () => {
  const css = read('app/globals.css');
  const allowed = new Set([
    '#faf4e9',
    '#f2e4cc',
    '#c98a2e',
    '#96601f',
    '#5c360d',
    '#3a2c1d',
    '#fffdf8',
    '#e8dcc6',
    '#e2d0b0',
    '#6b5741',
    '#7a5a30',
    '#8f6530',
    '#f6ecd9',
    '#d8c39c',
    '#8a6c3e',
    '#fff',
    '#ffffff',
  ]);
  const found = [
    ...new Set(
      (css.match(/#[0-9a-fA-F]{3,8}/g) ?? []).map((h) => h.toLowerCase()),
    ),
  ];
  const stray = found.filter((h) => !allowed.has(h));
  assert.deepEqual(stray, [], `unmigrated colours: ${stray.join(', ')}`);
});

void test('the remembered programme is guarded and validated', () => {
  const page = read('app/page.tsx');
  // Unguarded localStorage access throws in Safari private browsing and with
  // site data blocked, which would break the whole page load rather than just
  // this convenience. Both accesses must sit inside try/catch.
  const reads = page.match(/localStorage\.(getItem|setItem)/g) ?? [];
  assert.equal(reads.length, 2, 'exactly one read and one write expected');
  for (const fn of ['readStoredProgram', 'storeProgram']) {
    const body = page.match(new RegExp(`function ${fn}[^]*?\\n\\}`))?.[0] ?? '';
    assert.match(body, /try \{/, `${fn} must guard localStorage access`);
    assert.match(body, /catch/, `${fn} must swallow storage failures`);
  }
  // The stored id must be validated against the catalogue before use. Tested
  // through the real function rather than grepped for, so renaming a local
  // variable cannot break it and deleting the guard cannot pass it.
  const catalog = parseCatalog(
    JSON.parse(read('public/programs/index.json')) as unknown,
  );
  const known = catalog.programs[3].id;
  assert.equal(
    resolveStoredProgram(known, catalog),
    known,
    'a known id is kept',
  );
  assert.equal(
    resolveStoredProgram('la9-z-pony', catalog),
    catalog.defaultId,
    'a removed programme falls back to the default',
  );
  assert.equal(
    resolveStoredProgram('', catalog),
    catalog.defaultId,
    'an empty stored value falls back to the default',
  );
  // And the page must actually route the stored value through that guard.
  assert.match(
    page,
    /resolveStoredProgram\(readStoredProgram\(\)/,
    'the stored id must pass through resolveStoredProgram before use',
  );
});

void test('the pony stays parallel to the long side during schenkelvigning', () => {
  // Leg-yield travels a diagonal but the body stays parallel to the long side,
  // facing whichever end of the arena the movement is heading towards.
  // y decreases towards C, increases towards A.
  assert.equal(markerAngle('schenkelvigning', -10, -21), -90, 'towards C');
  assert.equal(markerAngle('schenkelvigning', +10, -30), -90, 'towards C');
  assert.equal(markerAngle('schenkelvigning', -10, +21), 90, 'towards A');
  assert.equal(markerAngle('schenkelvigning', +10, +24), 90, 'towards A');

  // Every other movement follows the path tangent as before.
  assert.equal(markerAngle(undefined, 1, 0), 0);
  assert.equal(markerAngle('normal', 0, 1), 90);
  assert.equal(
    markerAngle('versade', -1, 0),
    180,
    'no dy: falls back to tangent',
  );
  assert.equal(markerAngle('versade', 1, 0), 0);
  assert.equal(markerAngle(undefined, 1, 0, true), 180, 'reverse flips it');
  // reverse must not apply to the snapped case
  assert.equal(markerAngle('schenkelvigning', -10, -21, true), -90);

  // Sidetraversade (half-pass) travels a diagonal with the body parallel to the
  // long side too, so it snaps the same way.
  assert.equal(markerAngle('travers', -10, -24), -90, 'half-pass towards C');
  assert.equal(markerAngle('travers', +10, -30), -90, 'half-pass towards C');
  assert.equal(markerAngle('travers', -10, +24), 90, 'half-pass towards A');
});

void test('every snapped lateral segment runs along the long side', () => {
  // markerAngle snaps on the sign of dy, which is only meaningful because the
  // movement is predominantly vertical. Guard that assumption against the data.
  const dir = new URL('../public/programs/', import.meta.url);
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json') || name === 'index.json') continue;
    if (name === 'program.schema.json') continue;
    const p = JSON.parse(fs.readFileSync(new URL(name, dir), 'utf8'));
    for (const e of p.exercises ?? []) {
      for (const s of e.segments) {
        if (s.movement !== 'schenkelvigning' && s.movement !== 'travers')
          continue;
        const n = (s.d.match(/-?\d+\.?\d*/g) ?? []).map(Number);
        const dx = n[n.length - 2] - n[0];
        const dy = n[n.length - 1] - n[1];
        assert.ok(
          Math.abs(dy) > Math.abs(dx),
          `${p.id} #${e.number}: ${s.movement} is not predominantly along the long side`,
        );
      }
    }
  }
});

void test('versade sits 30 degrees off the track with the head leaning in', () => {
  // The head leans towards the arena centre. Arena is 20 wide, centre x = 10.
  // Real paths: la4-b #2 runs M0 6 L0 20 (left wall, towards A);
  //             la4-b #4 runs M20 20 L20 34 (right wall, towards A).
  const left = markerAngle('versade', 0, 14, false, 0, 10);
  const right = markerAngle('versade', 0, 14, false, 20, 10);
  assert.equal(
    left,
    60,
    'left wall towards A: nose swung to +x, towards centre',
  );
  assert.equal(
    right,
    120,
    'right wall towards A: nose swung to -x, towards centre',
  );

  // Travelling the other way flips the rotation, because the head still leans
  // towards the centre while the direction of travel reverses.
  assert.equal(markerAngle('versade', 0, -14, false, 0, 10), -60);
  assert.equal(markerAngle('versade', 0, -14, false, 20, 10), -120);

  // The x-component of the heading must point towards the centre on both walls.
  for (const [x, dy] of [
    [0, 14],
    [0, -14],
    [20, 14],
    [20, -14],
  ] as const) {
    const rad = (markerAngle('versade', 0, dy, false, x, 10) * Math.PI) / 180;
    const towardsCentre = Math.sign(10 - x);
    assert.equal(
      Math.sign(Math.round(Math.cos(rad) * 100)),
      towardsCentre,
      `x=${x} dy=${dy}: head must lean towards the centre`,
    );
  }

  // Both walls lean the same way relative to the arena, never mirrored wrongly.
  assert.equal(Math.abs(left - 90), 30);
  assert.equal(Math.abs(right - 90), 30);
});

void test('every versade segment runs along a long-side wall', () => {
  // The 30-degree offset is only meaningful for a movement performed on the
  // track. Guard that the data never puts versade somewhere else.
  const dir = new URL('../public/programs/', import.meta.url);
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json') || name === 'index.json') continue;
    if (name === 'program.schema.json') continue;
    const p = JSON.parse(fs.readFileSync(new URL(name, dir), 'utf8'));
    for (const e of p.exercises ?? []) {
      for (const s of e.segments) {
        if (s.movement !== 'versade') continue;
        const n = (s.d.match(/-?\d+\.?\d*/g) ?? []).map(Number);
        const onWall = n[0] === 0 || n[0] === p.arena.width;
        assert.ok(
          onWall,
          `${p.id} #${e.number}: versade does not start on a wall`,
        );
        assert.equal(
          n[n.length - 2],
          n[0],
          `${p.id} #${e.number}: versade should run straight along the wall`,
        );
      }
    }
  }
});
