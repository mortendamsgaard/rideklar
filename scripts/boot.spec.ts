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
function serve(staleFirstLoad = false, injectTag = '') {
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
    // A third-party tag has to be parsed as part of the document to reproduce
    // the real case; appending one from script runs too late to be equivalent.
    if (route === '/index.html' && injectTag) {
      const html = fs
        .readFileSync(file, 'utf8')
        .replace('</body>', `${injectTag}</body>`);
      res.writeHead(200, { 'content-type': TYPES['.html'] });
      return res.end(html);
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
  const site = await serve(
    false,
    '<script async src="https://gc.zgo.at/count.js"></script>',
  );
  try {
    await page.route('**gc.zgo.at/**', (r) =>
      r.fulfill({ status: 404, body: '', contentType: 'text/plain' }),
    );
    await page.goto(site.url);
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
    } finally {
      site.close();
    }
  });
});
