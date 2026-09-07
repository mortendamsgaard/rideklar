import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadJson, parseCatalog } from '../lib/program.ts';

const read = (p: string) =>
  fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// A fetch that never answers, which is what a captive portal or a stalled
// mobile connection actually looks like: not a failure, just silence.
const hangs = (_url: unknown, options: { signal?: AbortSignal } = {}) =>
  new Promise<Response>((_resolve, reject) => {
    options.signal?.addEventListener('abort', () =>
      reject(new DOMException('Aborted', 'AbortError')),
    );
  });

void test('a hanging request times out instead of waiting forever', async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  try {
    globalThis.fetch = hangs as typeof globalThis.fetch;
    await assert.rejects(
      loadJson('/programs/hangs.json', controller.signal, 50),
      /Forbindelsen svarede ikke/,
      'a stalled connection must surface a real error',
    );
    // The caller's own signal must stay clean. Callers use `signal.aborted` to
    // decide whether a rejection is worth reporting, so a timeout that aborted
    // that signal would be swallowed by exactly the code that needs to see it
    // — which is how a stalled request used to leave a permanent loading
    // message on screen.
    assert.equal(
      controller.signal.aborted,
      false,
      "a timeout must not abort the caller's signal",
    );
  } finally {
    globalThis.fetch = original;
  }
});

void test('a cancelled request is not reported as a timeout', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = hangs as typeof globalThis.fetch;
    const controller = new AbortController();
    const pending = loadJson('/programs/switched-away.json', controller.signal);
    controller.abort();
    await assert.rejects(pending, (e: Error) => {
      assert.doesNotMatch(
        String(e.message),
        /Forbindelsen svarede ikke/,
        'switching programme must not look like a network timeout',
      );
      return true;
    });
    assert.equal(controller.signal.aborted, true);
  } finally {
    globalThis.fetch = original;
  }
});

void test('the bundled default programme is the catalogue default', () => {
  // The default programme is imported into the build so the first render has
  // real data. That import names a file directly, so it can drift from the
  // catalogue's own defaultId; this keeps the two in step.
  const catalog = parseCatalog(
    JSON.parse(read('public/programs/index.json')) as unknown,
  );
  const entry = catalog.programs.find((p) => p.id === catalog.defaultId);
  assert.ok(entry, 'the catalogue default must exist in the catalogue');
  const bundled = read('lib/bundled-program.ts');
  assert.ok(
    bundled.includes(`../public${entry.file}`),
    `bundled-program.ts must import ${entry.file}, the catalogue default`,
  );
});
