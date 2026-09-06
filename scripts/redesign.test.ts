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
  for (const token of ['@import', '@theme', '@apply', '@layer', '@custom-variant']) {
    assert.doesNotMatch(css, new RegExp(token), `${token} should be gone`);
  }
  assert.doesNotMatch(read('app/layout.tsx'), /antialiased/);
  assert.doesNotMatch(read('vite.config.ts'), /tailwind/i);

  const pkg = JSON.parse(read('package.json'));
  assert.deepEqual(
    Object.keys(pkg.dependencies).sort(),
    ['lucide-react', 'react', 'react-dom', 'react-server-dom-webpack', 'vinext'],
  );
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
    '--leather': '#b5722a',
    '--ink': '#3a2c1d',
    '--surface': '#fffdf8',
    '--muted': '#6b5741',
  };
  for (const [name, value] of Object.entries(tokens)) {
    assert.match(css, new RegExp(`${name}:\\s*${value}`), `${name} should be ${value}`);
  }
  assert.doesNotMatch(css, /#f4f6f5|#176d5e/, 'old sage palette should be gone');

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
