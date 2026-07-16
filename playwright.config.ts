import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Not `pnpm dev` (next dev --turbopack): Turbopack still can't resolve
    // `next/package.json` from the `app/` directory in this environment and
    // fails with "Next.js inferred your workspace root, but it may not be
    // correct" -- reproduced on Next.js 16.2.10 stable even after a full
    // `rm -rf node_modules && pnpm install` and with `turbopack.root`
    // explicitly set in next.config.ts, so it's a structural clash between
    // Turbopack's native resolver and this environment's globally shared pnpm
    // virtual-store-dir (packages live under `C:\.pnpm-store`, outside any
    // node_modules tree Turbopack expects), not something introduced by this
    // plan. Task 11 also found that plain `next dev` (no flags) now defaults
    // to Turbopack on Next 16 (it used to default to webpack), so omitting
    // `--turbopack` is no longer enough -- `--webpack` must be passed
    // explicitly. Revisit if a future Next.js release fixes Turbopack's
    // resolution under this store layout, or if this ever runs somewhere
    // without the shared store.
    command: 'pnpm exec next dev --webpack',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
