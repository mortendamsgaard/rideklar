import vinext from 'vinext';
import { defineConfig } from 'vite';

// The footer shows when the site was last deployed, so the value is frozen at
// build time. It cannot be computed during render: the page is prerendered, so
// a clock read would give one answer in the static HTML and another in the
// visitor's browser, which is a hydration mismatch.
//
// Formatted here rather than in the browser for the same reason, and in
// Copenhagen time regardless of the build machine's timezone — CI runs in UTC.
const deployedAt = new Date();
const inCopenhagen = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('da-DK', {
    timeZone: 'Europe/Copenhagen',
    ...options,
  }).format(deployedAt);

export default defineConfig({
  define: {
    __DEPLOYED_AT__: JSON.stringify(
      `${inCopenhagen({ dateStyle: 'short' })} kl. ${inCopenhagen({
        timeStyle: 'short',
      })}`,
    ),
    // Taken from the same formatted instant so the copyright year cannot
    // disagree with the date beside it across a new year.
    __DEPLOY_YEAR__: JSON.stringify(inCopenhagen({ year: 'numeric' })),
  },
  plugins: [vinext()],
});
