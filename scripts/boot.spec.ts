import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'dist',
  'client',
);
const TYPES: Record<string, string> = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

// Serves the real build. With `staleFirstLoad`, the first document is served
// with its JS chunks 404ing — which is precisely what a browser holding a
// cached index.html sees after a deploy has replaced every hashed chunk.
function serve(staleFirstLoad = false) {
  let documents = 0;
  let killing = staleFirstLoad;
  const server = http.createServer((req, res) => {
    let route = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (route.endsWith('/')) route += 'index.html';
    if (route === '/index.html' && ++documents > 1) killing = false;
    if (killing && route.startsWith('/_next/static/chunks/')) {
      res.writeHead(404);
      return res.end('');
    }
    const file = path.join(ROOT, route);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise<{ url: string; close: () => void }>((resolve) =>
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    }),
  );
}

test('the built page hydrates and steps between exercises', async ({
  page,
}) => {
  const site = await serve();
  try {
    await page.goto(site.url);
    await expect(page.locator('html')).toHaveAttribute('data-booted', '1');
    // The no-JavaScript notice must never reach a scripted render — that is
    // the only way this could do harm.
    await expect(page.locator('.noscript-note')).toHaveCount(0);
    const first = await page.locator('.exercise-head h2').innerText();
    await page.getByLabel('Næste øvelse').click();
    await expect(page.locator('.exercise-head h2')).not.toHaveText(first);
  } finally {
    site.close();
  }
});

test('a stale page whose chunks have been deleted heals itself', async ({
  page,
}) => {
  const site = await serve(true);
  try {
    await page.goto(site.url);
    // The guard's backstop timer is 8s, so allow for it before giving up.
    await expect(page.locator('html')).toHaveAttribute('data-booted', '1', {
      timeout: 15000,
    });
    // Prove the guard is what recovered it, rather than luck.
    const healed = await page.evaluate(() => {
      try {
        return sessionStorage.getItem('rideklar:reloaded');
      } catch {
        return null;
      }
    });
    expect(healed).toBe('1');
    // Recovery must not leave its cache-busting query behind.
    expect(new URL(page.url()).search).toBe('');
    const first = await page.locator('.exercise-head h2').innerText();
    await page.getByLabel('Næste øvelse').click();
    await expect(page.locator('.exercise-head h2')).not.toHaveText(first);
  } finally {
    site.close();
  }
});

// Analytics, and any other third-party script, is routinely blocked by ad
// blockers — that is the normal case, not an edge case. The boot guard must not
// mistake it for a dead app bundle and reload the page, so it filters on the
// app's own /_next/static/ path. This pins that filter from the permissive
// side; the stale-page test above pins it from the strict side.
test('a blocked third-party script must not trigger the guard', async ({
  page,
}) => {
  const site = await serve();
  try {
    let blocked = 0;
    await page.route('**gc.zgo.at/**', (r) => {
      blocked++;
      return r.fulfill({ status: 404, body: '', contentType: 'text/plain' });
    });
    await page.goto(site.url);
    // Without this the test goes quiet the moment the tag is removed: nothing
    // would be requested, nothing would fail, and it would pass for free.
    expect(
      blocked,
      'the analytics tag must actually be loading',
    ).toBeGreaterThan(0);
    await expect(page.locator('html')).toHaveAttribute('data-booted', '1');
    // The guard's own flag is the only reliable signal that it decided to
    // heal. The URL is not: page.tsx strips the cache-busting query on a
    // successful hydration, so a misfire leaves no trace there.
    const healed = await page.evaluate(() => {
      try {
        return sessionStorage.getItem('rideklar:reloaded');
      } catch {
        return null;
      }
    });
    expect(healed).toBeNull();
    const first = await page.locator('.exercise-head h2').innerText();
    await page.getByLabel('Næste øvelse').click();
    await expect(page.locator('.exercise-head h2')).not.toHaveText(first);
  } finally {
    site.close();
  }
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  // This is the assertion the bug was hiding behind: with no JS at all, the
  // page used to render a loading message and nothing else.
  test('the programme is still readable', async ({ page }) => {
    const site = await serve();
    try {
      await page.goto(site.url);
      await expect(page.locator('.exercise-head h2')).toHaveText(
        'Indridning og hilsen',
      );
      await expect(page.locator('.arena')).toBeVisible();
      await expect(page.getByText('Indlæser rideprogram')).toHaveCount(0);
      // Until now nothing explained why the controls did not respond.
      const note = page.locator('.noscript-note');
      await expect(note).toBeVisible();
      await expect(note).toContainText('JavaScript');
    } finally {
      site.close();
    }
  });
});
