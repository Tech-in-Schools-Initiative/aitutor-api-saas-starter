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
    // Not `pnpm dev` (next dev --turbopack): the currently-pinned
    // 15.2.0-canary.33 Turbopack build crashes with a TurbopackInternalError
    // ("Next.js package not found") in this environment -- reproduced even in
    // a pristine checkout outside any worktree, so it's an environment/canary
    // issue, not something introduced by this plan. Plain `next dev` (webpack)
    // works fine. Revisit once Task 11 lands (Next.js 16 stable) -- if the
    // stable build's Turbopack doesn't hit this, switch back to `pnpm dev`.
    command: 'pnpm exec next dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
