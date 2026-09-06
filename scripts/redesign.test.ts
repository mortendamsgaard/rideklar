import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
  // A stored id for a programme that was later renamed or removed must fall
  // back to the catalogue default, not surface an error.
  assert.match(
    page,
    /readStoredProgram\(\)[^]*?c\.programs\.some[^]*?c\.defaultId/,
    'the stored id must be validated against the catalogue before use',
  );
});
