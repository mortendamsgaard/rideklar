import { defineConfig, devices } from '@playwright/test';

// Chromium at the phone viewport the layout targets. Webkit would be closer to
// the iPhones riders actually use, but only chromium is provisioned here and
// the behaviour under test — module loading, hydration, the boot guard — is
// not engine-specific.
export default defineConfig({
  testDir: './scripts',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
  },
});
