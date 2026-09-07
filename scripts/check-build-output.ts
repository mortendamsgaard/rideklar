import fs from 'node:fs';
// The guard that matters, and the one no unit test can stand in for: whether
// the HTML we actually ship carries a readable programme. When it held only a
// loading message, every rider whose JS failed to boot — a stale cached page
// asking for deleted chunks, a blocked script, an old browser — saw nothing at
// all. Assert real content is present rather than that the loading string is
// absent: the loading overlay is legitimate markup that may reappear.
const path = 'dist/client/index.html';
const html = fs.readFileSync(path, 'utf8');
const required = ['LA4-B', 'Indridning og hilsen', 'Hele programmet'];
const missing = required.filter((text) => !html.includes(text));
if (missing.length) {
  console.error(
    `${path} is missing prerendered content: ${missing.join(', ')}\n` +
      'The first render must hold a real programme, not a loading message.',
  );
  process.exit(1);
}
// These reach the output only by being copied out of public/, and each one is
// load-bearing: robots.txt steers crawlers, .nojekyll stops Jekyll hiding the
// _next/ bundle, CNAME is needed if the Pages build type is ever switched. A
// build-config change could drop them silently.
for (const asset of ['robots.txt', '.nojekyll', 'CNAME']) {
  if (!fs.existsSync(`dist/client/${asset}`)) {
    console.error(`dist/client/${asset} is missing from the build output.`);
    process.exit(1);
  }
}
console.log(`${path}: default programme prerendered (${html.length} bytes)`);
