# Phase 1: Dependency Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every dependency in `aitutor-api-saas-starter` to its current stable target (Next.js 16, React 19.2, Tailwind v4.3, current shadcn registry, Drizzle 0.45/0.31, Stripe 22, zod 4, and either `ai` v7 or a documented v4 freeze) behind a newly-introduced Vitest/Playwright test harness, so every later phase (monorepo conversion, email feature, design cleanup, performance pass) starts from a known-current, tested baseline.

**Architecture:** A test harness (Vitest for unit/component tests, Playwright for e2e, both wired into a new GitHub Actions CI workflow) is stood up first, against the current pre-upgrade code, as a red/green safety net. Every dependency then moves in its own task, safest-first, each committed independently so a regression bisects to exactly one dependency family. The riskiest item (`ai` v4→v7) is gated on a real compatibility check against the external `aitutor-api.vercel.app` service before any client rewrite is attempted.

**Tech Stack:** Next.js (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM + Postgres, Stripe, Vercel AI SDK, pnpm, Vitest, Playwright, GitHub Actions.

**User decisions (already made):**
- Attempt the full `ai` SDK v4→v7 upgrade (not a v4.x freeze), gated on confirming the external `aitutor-api.vercel.app` stream format is actually compatible with `@ai-sdk/react` v7's protocol; fall back to freezing at latest 4.x only if that gate fails.
- No Stripe test-mode/CLI access is available — Stripe verification in this phase is typecheck/build/code-review only; the checkout+webhook round trip is the user's own manual verification step before production.
- TypeScript stays on the newest 5.x line, not the 7.0 `tsgo` native-compiler rewrite.
- Next.js target is 16.2.10 stable (not an intermediate Next 15 stable point release).
- `experimental.ppr` and `experimental.newDevOverlay` are dropped from `next.config.ts` entirely (PPR was already canary-only/inert with zero `<Suspense>` usage in the app; `newDevOverlay` was removed from Next's own config type before Next 16 shipped).

---

### Task 1: Test Harness (Vitest + Playwright + CI)

**Goal:** Stand up Vitest and Playwright with a baseline red/green test suite against the current, pre-upgrade code, plus a CI workflow that runs it.

**Files:**
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `lib/db/seed-test.ts`
- Create: `.github/workflows/ci.yml`
- Modify: `package.json:3-12` (scripts block)
- Modify: `package.json:58-60` (devDependencies block)
- Modify: `.gitignore:9-10` (testing section)
- Test: `tests/unit/session.test.ts`
- Test: `tests/unit/utils.test.ts`
- Test: `tests/unit/tiers-limit.test.ts`
- Test: `tests/e2e/auth-and-dashboard.spec.ts`
- Test: `tests/e2e/chatbot.spec.ts`

**Acceptance Criteria:**
- [ ] `pnpm test` runs 3 unit test files (12 assertions) against the current, un-upgraded code and all pass
- [ ] `pnpm test:e2e` runs `auth-and-dashboard.spec.ts` (3 tests) against a locally-running `pnpm dev` server and all pass
- [ ] `tests/e2e/chatbot.spec.ts` exercises a real chatbot streaming reply when real `AITUTOR_API_KEY`/`WORKFLOW_ID`/`NEXT_PUBLIC_AITUTOR_TOKEN` credentials are present in the environment, and **self-skips** (not fails) when they are not — this repo's fresh `.env` has no real AI Tutor API credentials by default, and CI only ever has placeholder values, so this test cannot be a hard CI gate
- [ ] `pnpm exec tsc --noEmit` is clean with the new test files included
- [ ] `.github/workflows/ci.yml` runs typecheck, unit tests (with a Postgres service container), build, and e2e (separate job) on push/PR

**Verify:** `pnpm exec tsc --noEmit && pnpm test && pnpm test:e2e` -> `tsc` prints nothing (exit 0); `pnpm test` prints `Test Files 3 passed (3)` / `Tests 12 passed (12)`; `pnpm test:e2e` prints `3 passed` for `auth-and-dashboard.spec.ts` plus either `1 passed` or `1 skipped` for `chatbot.spec.ts` depending on whether real AI Tutor API credentials are configured

**Steps:**

- [ ] **Step 1: Write the failing tests**

`tests/unit/session.test.ts` — round-trips `signToken`/`verifyToken` and `hashPassword`/`comparePasswords` from `lib/auth/session.ts`. `session.ts` imports `cookies` from `next/headers` at module scope; Vitest cannot resolve/execute that module outside a real Next.js request context, so it must be mocked (this repo's tests never call `getSession`/`setSession`, only the pure token/hash helpers):

```ts
// tests/unit/session.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  signToken,
  verifyToken,
  hashPassword,
  comparePasswords,
} from '@/lib/auth/session';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

describe('session token round-trip', () => {
  it('signs and verifies a token, preserving the payload', async () => {
    const payload = {
      user: { id: 42 },
      expires: new Date(Date.now() + 60_000).toISOString(),
    };
    const token = await signToken(payload);
    expect(typeof token).toBe('string');

    const verified = await verifyToken(token);
    expect(verified.user.id).toBe(42);
    expect(verified.expires).toBe(payload.expires);
  });

  it('rejects a tampered token', async () => {
    const token = await signToken({
      user: { id: 1 },
      expires: new Date(Date.now() + 60_000).toISOString(),
    });
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    await expect(verifyToken(tampered)).rejects.toThrow();
  });
});

describe('password hashing round-trip', () => {
  it('hashes a password and verifies it against the original', async () => {
    const plain = 'correct-horse-battery-staple';
    const hashed = await hashPassword(plain);
    expect(hashed).not.toBe(plain);
    await expect(comparePasswords(plain, hashed)).resolves.toBe(true);
  });

  it('rejects an incorrect password against a hash', async () => {
    const hashed = await hashPassword('correct-horse-battery-staple');
    await expect(comparePasswords('wrong-password', hashed)).resolves.toBe(
      false
    );
  });
});
```

`tests/unit/utils.test.ts` — tests `cn()` from `lib/utils.ts`:

```ts
// tests/unit/utils.test.ts
import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins truthy class names with a space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, null, 'c')).toBe('a c');
  });

  it('merges conflicting Tailwind classes, keeping the last one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('merges conditional class objects', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active');
  });
});
```

`tests/unit/tiers-limit.test.ts` — tests `checkMessageLimit`/`incrementMessageCount` from `lib/db/utils.ts` against a real Postgres (a fixture team is inserted/torn down inline, following `lib/db/seed.ts`'s insert pattern; requires `POSTGRES_URL` to point at a migrated Postgres, e.g. via `pnpm db:setup` + `pnpm db:migrate` locally, or the CI Postgres service):

```ts
// tests/unit/tiers-limit.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { teams } from '@/lib/db/schema';
import { checkMessageLimit, incrementMessageCount } from '@/lib/db/utils';

let teamId: number;

beforeAll(async () => {
  const [team] = await db
    .insert(teams)
    .values({
      name: 'Vitest Fixture Team',
      messageLimit: 5,
      currentMessages: 0,
    })
    .returning();
  teamId = team.id;
});

afterAll(async () => {
  if (teamId) {
    await db.delete(teams).where(eq(teams.id, teamId));
  }
});

describe('checkMessageLimit / incrementMessageCount', () => {
  it('reports the free-tier limit (5) as remaining when no messages sent', async () => {
    const { withinLimit, remainingMessages } = await checkMessageLimit(teamId);
    expect(withinLimit).toBe(true);
    expect(remainingMessages).toBe(5);
  });

  it('decrements remaining messages after incrementMessageCount', async () => {
    await incrementMessageCount(teamId, 3);
    const { withinLimit, remainingMessages } = await checkMessageLimit(teamId);
    expect(withinLimit).toBe(true);
    expect(remainingMessages).toBe(2);
  });

  it('flips withinLimit to false once the free-tier limit is exhausted', async () => {
    await incrementMessageCount(teamId, 2);
    const { withinLimit, remainingMessages } = await checkMessageLimit(teamId);
    expect(withinLimit).toBe(false);
    expect(remainingMessages).toBe(0);
  });

  it('throws for a team id that does not exist', async () => {
    await expect(checkMessageLimit(-1)).rejects.toThrow('Team not found');
  });
});
```

`tests/e2e/auth-and-dashboard.spec.ts` — sign-up redirect, sign-in with the seeded user (`test@test.com` / `admin123`, per `lib/db/seed.ts:68-69`), dashboard load with no console errors + sidebar assertion:

```ts
// tests/e2e/auth-and-dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('auth and dashboard', () => {
  test('sign-up redirects to the dashboard', async ({ page }) => {
    const uniqueEmail = `e2e-${Date.now()}@example.com`;
    await page.goto('/sign-up');
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel('Password').fill('e2e-test-password');
    await page.getByRole('button', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test('sign-in with the seeded user lands on the dashboard', async ({
    page,
  }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill('test@test.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test('dashboard loads with no console errors and renders the sidebar', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/sign-in');
    await page.getByLabel('Email').fill('test@test.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    await expect(page.getByRole('link', { name: /workflow/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /chatbot/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /team/i })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});
```

`tests/e2e/chatbot.spec.ts` — the highest-value e2e test in this phase: it's the only automated check that actually exercises a real chatbot round trip, which is what Task 10's `ai` SDK gate decision hinges on. It requires real AI Tutor API credentials to mean anything, so it self-skips rather than false-failing when they're absent (CI's `AITUTOR_API_KEY`/`WORKFLOW_ID` are always the `ci-dummy-*` placeholders set in `.github/workflows/ci.yml`):

```ts
// tests/e2e/chatbot.spec.ts
import { test, expect } from '@playwright/test';

const hasRealAiTutorCredentials =
  !!process.env.AITUTOR_API_KEY &&
  !process.env.AITUTOR_API_KEY.startsWith('ci-dummy') &&
  !!process.env.WORKFLOW_ID &&
  !process.env.WORKFLOW_ID.startsWith('ci-dummy');

test.describe('chatbot streaming', () => {
  test.skip(
    !hasRealAiTutorCredentials,
    'Requires real AITUTOR_API_KEY/WORKFLOW_ID/NEXT_PUBLIC_AITUTOR_TOKEN credentials against the external aitutor-api.vercel.app service -- not available in CI or a fresh .env.'
  );

  test('sending a message renders a streamed assistant reply', async ({
    page,
  }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill('test@test.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/dashboard/chatbot');
    await page.getByPlaceholder('Type your message...').fill('hello');
    await page.getByRole('button', { name: /send/i }).click();

    await expect(page.locator('.bg-white\\/50.mr-8').last()).toContainText(
      /.+/,
      { timeout: 15000 }
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL with `ERR_PNPM_NO_SCRIPT  Missing script: "test"` (no `test` script and no `vitest` devDependency exist yet)

Run: `pnpm test:e2e`
Expected: FAIL with `ERR_PNPM_NO_SCRIPT  Missing script: "test:e2e"` (no `test:e2e` script and no `@playwright/test` devDependency exist yet)

- [ ] **Step 3: Write minimal implementation**

Install the harness deps:

```bash
pnpm add -D vitest@^4.1.10 @testing-library/react@^16.3.2 @testing-library/dom@^10.4.1 jsdom@^29.1.1 vite-tsconfig-paths@^6.1.1 @vitejs/plugin-react@^6.0.3 @playwright/test@^1.61.1
pnpm exec playwright install --with-deps chromium
```

Resulting `package.json` diff:

```diff
   "scripts": {
     "dev": "next dev --turbopack",
     "build": "next build",
     "start": "next start",
     "db:setup": "npx tsx lib/db/setup.ts",
     "db:seed": "npx tsx lib/db/seed.ts",
+    "db:seed:test": "npx tsx lib/db/seed-test.ts",
     "db:generate": "drizzle-kit generate",
     "db:migrate": "drizzle-kit migrate",
-    "db:studio": "drizzle-kit studio"
+    "db:studio": "drizzle-kit studio",
+    "test": "vitest run",
+    "test:watch": "vitest",
+    "test:e2e": "playwright test"
   },
```

```diff
   "devDependencies": {
-    "@types/canvas-confetti": "^1.9.0"
+    "@types/canvas-confetti": "^1.9.0",
+    "@playwright/test": "^1.61.1",
+    "@testing-library/dom": "^10.4.1",
+    "@testing-library/react": "^16.3.2",
+    "@vitejs/plugin-react": "^6.0.3",
+    "jsdom": "^29.1.1",
+    "vite-tsconfig-paths": "^6.1.1",
+    "vitest": "^4.1.10"
   }
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    env: {
      AUTH_SECRET: 'vitest-unit-test-secret-do-not-use-in-production',
    },
  },
});
```

`playwright.config.ts`:

```ts
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
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

`lib/db/seed-test.ts` — a CI/local-safe seed that inserts only the user/team the e2e suite needs, skipping `lib/db/seed.ts`'s `createStripeProductsAndPrices()` (that call hits the real Stripe API and has no test-mode credentials available in CI):

```ts
// lib/db/seed-test.ts
import { db } from './drizzle';
import { users, teams, teamMembers } from './schema';
import { hashPassword } from '@/lib/auth/session';

async function seedTest() {
  const email = 'test@test.com';
  const password = 'admin123';
  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values([{ email, passwordHash, role: 'owner' }])
    .returning();

  const [team] = await db
    .insert(teams)
    .values({ name: 'Test Team', messageLimit: 5, currentMessages: 0 })
    .returning();

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: user.id,
    role: 'owner',
  });

  console.log('Test seed complete (no Stripe calls).');
}

seedTest()
  .catch((error) => {
    console.error('Test seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
```

`.gitignore` diff:

```diff
 # testing
 /coverage
+/test-results/
+/playwright-report/
+/blob-report/
```

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [develop, main]
  pull_request:

env:
  AUTH_SECRET: ci-test-secret-not-for-production-please-change
  STRIPE_SECRET_KEY: sk_test_dummy_key_for_ci_00000000000000000000
  STRIPE_WEBHOOK_SECRET: whsec_dummy_for_ci_0000000000000000000000
  NEXT_PUBLIC_STRIPE_PUBLISHABLEKEY: pk_test_dummy_key_for_ci_0000000000000
  BASE_URL: http://localhost:3000
  AITUTOR_API_KEY: ci-dummy-aitutor-key
  WORKFLOW_ID: ci-dummy-workflow-id
  CHATBOT_ID: ci-dummy-chatbot-id
  NEXT_PUBLIC_AITUTOR_TOKEN: ci-dummy-aitutor-token
  POSTGRES_URL: postgres://postgres:postgres@localhost:5432/postgres

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16.4-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.23.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Run database migrations
        run: pnpm db:migrate
      - name: Type check
        run: pnpm exec tsc --noEmit
      - name: Unit tests
        run: pnpm test
      - name: Build
        run: pnpm build

  e2e:
    runs-on: ubuntu-latest
    needs: test
    services:
      postgres:
        image: postgres:16.4-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.23.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Run database migrations
        run: pnpm db:migrate
      - name: Seed database (test fixtures only, no Stripe)
        run: pnpm db:seed:test
      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium
      - name: Run e2e tests
        run: pnpm test:e2e
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS — `Test Files  3 passed (3)` / `Tests  12 passed (12)`

Run: `pnpm exec tsc --noEmit`
Expected: PASS — no output, exit code 0

Run: `pnpm test:e2e` (with `pnpm db:migrate && pnpm db:seed:test` run first against a local Postgres)
Expected: PASS — `auth-and-dashboard.spec.ts` reports `3 passed`; `chatbot.spec.ts` reports `1 skipped` (no real AI Tutor API credentials configured yet) or `1 passed` (if they are)

- [ ] **Step 5: Commit**
```bash
git add package.json pnpm-lock.yaml vitest.config.ts playwright.config.ts lib/db/seed-test.ts .github/workflows/ci.yml .gitignore tests/unit/session.test.ts tests/unit/utils.test.ts tests/unit/tiers-limit.test.ts tests/e2e/auth-and-dashboard.spec.ts tests/e2e/chatbot.spec.ts
git commit -m "Add Vitest + Playwright test harness and CI workflow, with a baseline suite against the pre-upgrade code"
```

---

### Task 2: Trivial/Patch Bumps + framer-motion → motion Consolidation

**Goal:** Batch every patch/minor-safe dependency bump and consolidate `framer-motion`/`motion` into a single `motion` dependency, with a regression test that locks in the import-path migration.

**Files:**
- Modify: `package.json:14-56` (dependencies block)
- Modify: `lib/db/drizzle.ts:6`
- Modify: `components/landing-page/timeline/TimelineContent.tsx:4`
- Modify: `components/landing-page/hero/hero.tsx:4`
- Modify: `components/landing-page/timeline/components/testimonial-cards.tsx:4`
- Modify: `components/landing-page/footer/animated-gradient-background.tsx:1`
- Modify: `components/landing-page/hero/components/sparkles-text.tsx:4`
- Test: `tests/unit/motion-migration.test.ts`

**Acceptance Criteria:**
- [ ] No source file imports from `"framer-motion"`; `framer-motion` is removed from `package.json`
- [ ] All 5 previously-`framer-motion` files import their motion primitives from `"motion/react"`
- [ ] The 10 `@radix-ui/react-*` packages, `postgres`, `dotenv`, `date-fns`, `tailwind-merge`, `autoprefixer`, `canvas-confetti`/`@types/canvas-confetti`, and `tailwindcss-react-aria-components` are bumped to their current latest same-major release
- [ ] `pnpm test` and `pnpm build` both stay green

**Verify:** `pnpm test && pnpm build` -> `Test Files  4 passed (4)` / `Tests  22 passed (22)`, then a clean Next.js build

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/motion-migration.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const filesThatImportedFramerMotion = [
  'components/landing-page/timeline/TimelineContent.tsx',
  'components/landing-page/hero/hero.tsx',
  'components/landing-page/timeline/components/testimonial-cards.tsx',
  'components/landing-page/footer/animated-gradient-background.tsx',
  'components/landing-page/hero/components/sparkles-text.tsx',
];

function readSource(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');
}

describe('framer-motion -> motion consolidation', () => {
  it.each(filesThatImportedFramerMotion)(
    '%s no longer imports from "framer-motion"',
    (relativePath) => {
      expect(readSource(relativePath)).not.toMatch(
        /from ['"]framer-motion['"]/
      );
    }
  );

  it.each(filesThatImportedFramerMotion)(
    '%s imports its motion primitives from "motion/react" instead',
    (relativePath) => {
      expect(readSource(relativePath)).toMatch(/from ['"]motion\/react['"]/);
    }
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/motion-migration.test.ts`
Expected: FAIL — the first `it.each` block passes (nothing to do with a stale assertion), but the second `it.each` block fails all 5 cases with `expected "... import { motion, useScroll, useTransform } from \"framer-motion\";..." to match /from ['"]motion\/react['"]/ ` since none of the 5 files import from `motion/react` yet

- [ ] **Step 3: Write minimal implementation**

`package.json` dependencies diff (trivial/patch batch + `tailwindcss-react-aria-components` per the explicit target version + `motion`/`framer-motion` consolidation):

```diff
   "dependencies": {
-    "@radix-ui/react-avatar": "^1.1.2",
-    "@radix-ui/react-dialog": "^1.1.6",
-    "@radix-ui/react-dropdown-menu": "^2.1.5",
-    "@radix-ui/react-icons": "^1.3.2",
-    "@radix-ui/react-label": "^2.1.1",
-    "@radix-ui/react-radio-group": "^1.2.2",
-    "@radix-ui/react-scroll-area": "^1.2.2",
-    "@radix-ui/react-separator": "^1.1.1",
-    "@radix-ui/react-slot": "^1.1.1",
-    "@radix-ui/react-tooltip": "^1.1.8",
+    "@radix-ui/react-avatar": "^1.2.2",
+    "@radix-ui/react-dialog": "^1.1.19",
+    "@radix-ui/react-dropdown-menu": "^2.1.20",
+    "@radix-ui/react-icons": "^1.3.2",
+    "@radix-ui/react-label": "^2.1.11",
+    "@radix-ui/react-radio-group": "^1.4.3",
+    "@radix-ui/react-scroll-area": "^1.2.14",
+    "@radix-ui/react-separator": "^1.1.11",
+    "@radix-ui/react-slot": "^1.3.0",
+    "@radix-ui/react-tooltip": "^1.2.12",
     "@tailwindcss/postcss": "4.0.3",
     "@types/bcryptjs": "^2.4.6",
     "@types/node": "^22.13.1",
     "@types/react": "19.0.8",
     "@types/react-dom": "19.0.3",
     "ai": "^4.1.44",
-    "autoprefixer": "^10.4.20",
+    "autoprefixer": "^10.5.3",
     "bcryptjs": "^2.4.3",
-    "canvas-confetti": "^1.9.3",
+    "canvas-confetti": "^1.9.4",
     "class-variance-authority": "^0.7.1",
     "clsx": "^2.1.1",
-    "date-fns": "^4.1.0",
-    "dotenv": "^16.4.7",
+    "date-fns": "^4.4.0",
+    "dotenv": "^17.4.2",
     "drizzle-kit": "^0.30.4",
     "drizzle-orm": "^0.39.1",
-    "framer-motion": "^12.4.7",
     "jose": "^5.9.6",
     "lucide-react": "^0.474.0",
     "marked": "^15.0.7",
-    "motion": "^12.4.7",
+    "motion": "^12.42.2",
     "next": "15.2.0-canary.33",
     "postcss": "^8.5.1",
-    "postgres": "^3.4.5",
+    "postgres": "^3.4.9",
     "react": "19.0.0",
     "react-dom": "19.0.0",
     "server-only": "^0.0.1",
     "stripe": "^17.6.0",
-    "tailwind-merge": "^3.0.1",
+    "tailwind-merge": "^3.6.0",
     "tailwindcss": "4.0.3",
     "tailwindcss-animate": "^1.0.7",
-    "tailwindcss-react-aria-components": "1.2.0",
+    "tailwindcss-react-aria-components": "2.2.0",
     "typescript": "^5.7.3",
     "zod": "^3.24.1"
   },
```

`lib/db/drizzle.ts` diff — dotenv 17 turns on a verbose "injecting env" console log by default; keep the previous silent behavior:

```diff
-dotenv.config();
+dotenv.config({ quiet: true });
```

Import-path edits (identical pattern in all 5 files — only the module specifier changes, no API usage changes since `motion` is a drop-in for `framer-motion` as of the current major):

```diff
--- a/components/landing-page/timeline/TimelineContent.tsx
-import { motion, useScroll, useTransform } from "framer-motion";
+import { motion, useScroll, useTransform } from "motion/react";
```
```diff
--- a/components/landing-page/hero/hero.tsx
-import { motion } from "framer-motion";
+import { motion } from "motion/react";
```
```diff
--- a/components/landing-page/timeline/components/testimonial-cards.tsx
-import { motion } from "framer-motion";
+import { motion } from "motion/react";
```
```diff
--- a/components/landing-page/footer/animated-gradient-background.tsx
-import { motion } from "framer-motion";
+import { motion } from "motion/react";
```
```diff
--- a/components/landing-page/hero/components/sparkles-text.tsx
-import { motion } from "framer-motion";
+import { motion } from "motion/react";
```

Then install:

```bash
pnpm install
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS — `Test Files  4 passed (4)` / `Tests  22 passed (22)`

Run: `pnpm build`
Expected: PASS — Next.js build completes with no errors

- [ ] **Step 5: Commit**
```bash
git add package.json pnpm-lock.yaml lib/db/drizzle.ts components/landing-page/timeline/TimelineContent.tsx components/landing-page/hero/hero.tsx components/landing-page/timeline/components/testimonial-cards.tsx components/landing-page/footer/animated-gradient-background.tsx components/landing-page/hero/components/sparkles-text.tsx tests/unit/motion-migration.test.ts
git commit -m "Batch trivial/patch dependency bumps and consolidate framer-motion into motion"
```

---

### Task 3: React 19.0.0 → 19.2.7

**Goal:** Bump React, ReactDOM, and their type packages to the current 19.2 patch release.

**Files:**
- Modify: `package.json:27-28` (`@types/react`, `@types/react-dom`)
- Modify: `package.json:47-48` (`react`, `react-dom`)
- Test: `tests/unit/react-version.test.ts`

**Acceptance Criteria:**
- [ ] `react`, `react-dom` are pinned to `19.2.7`; `@types/react` is `19.2.17`; `@types/react-dom` is `19.2.3`
- [ ] `pnpm test` and `pnpm build` stay green with no code changes required elsewhere

**Verify:** `pnpm test && pnpm build` -> `Test Files  5 passed (5)` / `Tests  24 passed (24)`, then a clean Next.js build

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/react-version.test.ts
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function installedVersion(pkg: string): string {
  return (require(`${pkg}/package.json`) as { version: string }).version;
}

function versionAtLeast(version: string, min: string): boolean {
  const v = version.split('.').map(Number);
  const m = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const vi = v[i] ?? 0;
    const mi = m[i] ?? 0;
    if (vi !== mi) return vi > mi;
  }
  return true;
}

describe('React 19.2 upgrade', () => {
  it('react and react-dom are at least 19.2.7', () => {
    expect(versionAtLeast(installedVersion('react'), '19.2.7')).toBe(true);
    expect(versionAtLeast(installedVersion('react-dom'), '19.2.7')).toBe(true);
  });

  it('@types/react and @types/react-dom match the 19.2 upgrade', () => {
    expect(versionAtLeast(installedVersion('@types/react'), '19.2.17')).toBe(
      true
    );
    expect(
      versionAtLeast(installedVersion('@types/react-dom'), '19.2.3')
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/react-version.test.ts`
Expected: FAIL — `expected false to be true` on both assertions (installed `react`/`react-dom` are `19.0.0`, `@types/react` is `19.0.8`, `@types/react-dom` is `19.0.3`, all below the 19.2 targets)

- [ ] **Step 3: Write minimal implementation**

```diff
     "@types/node": "^22.13.1",
-    "@types/react": "19.0.8",
-    "@types/react-dom": "19.0.3",
+    "@types/react": "19.2.17",
+    "@types/react-dom": "19.2.3",
     "ai": "^4.1.44",
```
```diff
     "next": "15.2.0-canary.33",
     "postcss": "^8.5.1",
     "postgres": "^3.4.9",
-    "react": "19.0.0",
-    "react-dom": "19.0.0",
+    "react": "19.2.7",
+    "react-dom": "19.2.7",
     "server-only": "^0.0.1",
```

```bash
pnpm install
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS — `Test Files  5 passed (5)` / `Tests  24 passed (24)`

Run: `pnpm build`
Expected: PASS — clean Next.js build (no `forwardRef`/`use()`/`useActionState` deprecation errors; these APIs remain supported through 19.2)

- [ ] **Step 5: Commit**
```bash
git add package.json pnpm-lock.yaml tests/unit/react-version.test.ts
git commit -m "Upgrade React and ReactDOM to 19.2.7"
```

---

### Task 4: TypeScript 5.7.3 → newest 5.x (5.9.3)

**Goal:** Bump TypeScript to the newest release on the 5.x line, explicitly staying off the 7.0 `tsgo` native-compiler rewrite.

**Files:**
- Modify: `package.json:55` (`typescript`)
- Test: `tests/unit/typescript-version.test.ts`

**Acceptance Criteria:**
- [ ] `typescript` is `^5.9.3` (not `6.x`/`7.x`)
- [ ] `pnpm exec tsc --noEmit` is clean across the whole repo

**Verify:** `pnpm exec tsc --noEmit` -> no output, exit code 0

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/typescript-version.test.ts
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function installedVersion(pkg: string): string {
  return (require(`${pkg}/package.json`) as { version: string }).version;
}

function versionAtLeast(version: string, min: string): boolean {
  const v = version.split('.').map(Number);
  const m = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const vi = v[i] ?? 0;
    const mi = m[i] ?? 0;
    if (vi !== mi) return vi > mi;
  }
  return true;
}

describe('TypeScript stays on the 5.x line', () => {
  it('is at least 5.9.3 and below the 6.0 tsgo line', () => {
    const version = installedVersion('typescript');
    expect(versionAtLeast(version, '5.9.3')).toBe(true);
    expect(versionAtLeast(version, '6.0.0')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/typescript-version.test.ts`
Expected: FAIL — `expected false to be true` (installed `typescript` is `5.7.3`, which is below `5.9.3`)

- [ ] **Step 3: Write minimal implementation**

```diff
     "tailwindcss-react-aria-components": "2.2.0",
-    "typescript": "^5.7.3",
+    "typescript": "^5.9.3",
     "zod": "^3.24.1"
```

```bash
pnpm install
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/typescript-version.test.ts`
Expected: PASS

Run: `pnpm exec tsc --noEmit`
Expected: PASS — no output, exit code 0 (TS 5.8/5.9 are feature releases with no breaking syntax/strictness changes affecting this codebase's `strict: true` config)

- [ ] **Step 5: Commit**
```bash
git add package.json pnpm-lock.yaml tests/unit/typescript-version.test.ts
git commit -m "Upgrade TypeScript to the newest 5.x release (5.9.3), staying off the 7.0 tsgo rewrite"
```

---

### Task 5: Tailwind 4.3.2 + shadcn Component Regeneration

**Goal:** Bump Tailwind to 4.3.2 and regenerate all 12 `components/ui/*.tsx` primitives from the current shadcn registry, which has moved from per-package `@radix-ui/react-*` imports + `forwardRef` to the unified `radix-ui` package + plain function components with `data-slot` attributes.

**Files:**
- Modify: `package.json:24` (`@tailwindcss/postcss`)
- Modify: `package.json:52` (`tailwindcss`)
- Modify: `package.json:14-23` (remove the 10 now-unused `@radix-ui/react-*` packages, add `radix-ui`)
- Modify: `components/ui/avatar.tsx`, `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/dropdown-menu.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `components/ui/radio-group.tsx`, `components/ui/separator.tsx`, `components/ui/sheet.tsx`, `components/ui/sidebar.tsx`, `components/ui/skeleton.tsx`, `components/ui/tooltip.tsx` (CLI-regenerated, not hand-edited)
- Test: `tests/unit/button.test.tsx`

**Acceptance Criteria:**
- [ ] All 12 `components/ui/*.tsx` files match the current shadcn `new-york` (Tailwind v4) registry output
- [ ] `git diff components/ui/` shows no lost call-site customization (none existed pre-regen — verified by reading `button.tsx`/`card.tsx`/`input.tsx` beforehand, all plain `forwardRef` boilerplate with zero repo-specific styling baked in)
- [ ] No source file outside `package.json`/`pnpm-lock.yaml` references the old individual `@radix-ui/react-*` packages
- [ ] `tests/unit/button.test.tsx` passes, asserting the new `data-slot="button"` marker

**Verify:** `pnpm test && pnpm exec tsc --noEmit && pnpm build` -> `Test Files 7 passed (7)` / `Tests 29 passed (29)`, no tsc output, clean build

**Steps:**

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/button.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders without throwing and exposes an accessible button role', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeTruthy();
  });

  it('marks itself as the shadcn button primitive via data-slot', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('data-slot')).toBe('button');
  });

  it('applies the default variant background class', () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole('button', { name: 'Default' });
    expect(button.className).toContain('bg-primary');
  });

  it('applies the destructive variant background class when requested', () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button.className).toContain('bg-destructive');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/button.test.tsx`
Expected: FAIL — the `data-slot` assertion fails with `expected null to be 'button'`, since the current `components/ui/button.tsx` (`React.forwardRef`, no `data-slot`) never sets that attribute (confirmed by reading the file: it renders `<Comp className={...} ref={ref} {...props} />` with nothing else)

- [ ] **Step 3: Write minimal implementation**

Bump Tailwind:

```diff
-    "@tailwindcss/postcss": "4.0.3",
+    "@tailwindcss/postcss": "4.3.2",
```
```diff
-    "tailwindcss": "4.0.3",
+    "tailwindcss": "4.3.2",
```

```bash
pnpm install
```

Inspect drift before touching anything (`components.json` already configures `style: "new-york"`, `iconLibrary: "lucide"`, so no extra setup is needed):

```bash
pnpm dlx shadcn@latest diff
```

Expected: a list of all 12 local components (`avatar`, `button`, `card`, `dropdown-menu`, `input`, `label`, `radio-group`, `separator`, `sheet`, `sidebar`, `skeleton`, `tooltip`) flagged as having registry updates available — this is the expected large drift since the local files are the pre-refresh `forwardRef` generation and the registry has since moved to function components + `data-slot` + the unified `radix-ui` package.

Regenerate all 12 in one pass:

```bash
pnpm dlx shadcn@latest add avatar button card dropdown-menu input label radio-group separator sheet sidebar skeleton tooltip --overwrite
```

Review the diff (verified against the live registry, not guessed):

```bash
git diff components/ui/
```

Expected shape of the diff, confirmed per-file against the current registry:
- Every file: `React.forwardRef<...>(...)` → plain `function ComponentName({ ... }: Props) { ... }`, and every rendered root element gains `data-slot="<component-name>"`.
- `avatar.tsx`, `label.tsx`, `separator.tsx`, `tooltip.tsx`: `import * as XPrimitive from "@radix-ui/react-x"` → `import { X as XPrimitive } from "radix-ui"`.
- `button.tsx`, `sidebar.tsx`: `import { Slot } from "@radix-ui/react-slot"` → `import { Slot } from "radix-ui"`.
- `sheet.tsx`: `import * as SheetPrimitive from "@radix-ui/react-dialog"` → `import { Dialog as SheetPrimitive } from "radix-ui"`; `import { X } from "lucide-react"` → `import { XIcon } from "lucide-react"`.
- `sidebar.tsx`: `import { PanelLeft } from "lucide-react"` → `import { PanelLeftIcon } from "lucide-react"`.
- `radio-group.tsx`: `import { CheckIcon } from "@radix-ui/react-icons"` + `import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"` → `import { CircleIcon } from "lucide-react"` + `import { RadioGroup as RadioGroupPrimitive } from "radix-ui"`.
- `dropdown-menu.tsx`: `import { CheckIcon, ChevronRightIcon, DotFilledIcon } from "@radix-ui/react-icons"` + `import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"` → `import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"` + `import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"`.
- `card.tsx`, `input.tsx`, `skeleton.tsx`: no Radix dependency either before or after — diff is limited to the `forwardRef` → function-component + `data-slot` refactor.
- Also check `git diff hooks/use-mobile.tsx` — the `sidebar` registry item bundles this hook as a dependency and `--overwrite` may touch it too.

Confirm no source file still references the old scoped packages:

```bash
grep -rn --include="*.ts" --include="*.tsx" "@radix-ui/react-avatar\|@radix-ui/react-dialog\|@radix-ui/react-dropdown-menu\|@radix-ui/react-icons\|@radix-ui/react-label\|@radix-ui/react-radio-group\|@radix-ui/react-scroll-area\|@radix-ui/react-separator\|@radix-ui/react-slot\|@radix-ui/react-tooltip" .
```

Expected: no matches (the shadcn CLI's own `pnpm add radix-ui` run during `add --overwrite` already added the unified package; `@radix-ui/react-scroll-area` was already unused before this regen — confirmed via the same grep pre-regen, since no `components/ui/scroll-area.tsx` exists in this repo).

Prune the now-dead individual packages and confirm the new unified one is present:

```diff
   "dependencies": {
-    "@radix-ui/react-avatar": "^1.2.2",
-    "@radix-ui/react-dialog": "^1.1.19",
-    "@radix-ui/react-dropdown-menu": "^2.1.20",
-    "@radix-ui/react-icons": "^1.3.2",
-    "@radix-ui/react-label": "^2.1.11",
-    "@radix-ui/react-radio-group": "^1.4.3",
-    "@radix-ui/react-scroll-area": "^1.2.14",
-    "@radix-ui/react-separator": "^1.1.11",
-    "@radix-ui/react-slot": "^1.3.0",
-    "@radix-ui/react-tooltip": "^1.2.12",
     "@tailwindcss/postcss": "4.3.2",
     "@types/bcryptjs": "^2.4.6",
     "@types/node": "^22.13.1",
     "@types/react": "19.2.17",
     "@types/react-dom": "19.2.3",
     "ai": "^4.1.44",
     "autoprefixer": "^10.5.3",
     "bcryptjs": "^2.4.3",
     "canvas-confetti": "^1.9.4",
     "class-variance-authority": "^0.7.1",
     "clsx": "^2.1.1",
     "date-fns": "^4.4.0",
     "dotenv": "^17.4.2",
     "drizzle-kit": "^0.30.4",
     "drizzle-orm": "^0.39.1",
     "jose": "^5.9.6",
     "lucide-react": "^0.474.0",
     "marked": "^15.0.7",
     "motion": "^12.42.2",
     "next": "15.2.0-canary.33",
     "postcss": "^8.5.1",
     "postgres": "^3.4.9",
+    "radix-ui": "^1.6.2",
     "react": "19.2.7",
     "react-dom": "19.2.7",
```

```bash
pnpm install
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS — `Test Files 7 passed (7)` / `Tests 29 passed (29)`

Run: `pnpm exec tsc --noEmit`
Expected: PASS — no output

Run: `pnpm build`
Expected: PASS — clean build

- [ ] **Step 5: Commit**
```bash
git add package.json pnpm-lock.yaml components.json components/ui/ hooks/use-mobile.tsx tests/unit/button.test.tsx
git commit -m "Bump Tailwind to 4.3.2 and regenerate all 12 shadcn ui primitives onto the unified radix-ui package + data-slot pattern"
```

---

### Task 6: lucide-react 0.474 → 1.24.0 + marked ^15 → 18.0.6

**Goal:** Bump `lucide-react`, fixing the 3 renamed-icon call sites and 1 removed-brand-icon dead import this breaks; bump `marked`, verifying its `Lexer`/`Parser` API (the one call site in `StoryDisplay.tsx` uses) is unaffected.

**Files:**
- Modify: `package.json:41-42` (`lucide-react`, `marked`)
- Modify: `app/(dashboard)/dashboard/activity/page.tsx:2-13,27,112`
- Modify: `app/(dashboard)/dashboard/invite-team.tsx:12,87`
- Modify: `components/landing-page/footer/footer.tsx:9`
- Test: `tests/unit/lucide-icon-renames.test.ts`
- Test: `tests/unit/marked-api.test.ts`

**Acceptance Criteria:**
- [ ] `pnpm exec tsc --noEmit` is clean after the `lucide-react` bump (renamed/removed icons compile)
- [ ] `activity/page.tsx` uses `CircleAlert`/`CircleCheck`, `invite-team.tsx` uses `CirclePlus` (their pre-1.0 names — `AlertCircle`/`CheckCircle`/`PlusCircle` — no longer exist in `lucide-react@1`)
- [ ] `footer.tsx` no longer imports the removed `Facebook`/`Instagram`/`Linkedin` brand icons (they were dead/unused imports already — never rendered, only `Icons.twitter`/`Icons.gitHub` from the local `./icons` file are used)
- [ ] `StoryDisplay.tsx`'s `new marked.Lexer()` / `new marked.Parser()` call site needs no code change — verified against the marked 18.0.0 changelog (trailing-blank-line trimming and a TS6 internal bump; the `Lexer`/`Parser` class shape and default-synchronous `parse()` return type are unchanged since v15)

**Verify:** `pnpm exec tsc --noEmit && pnpm test` -> no tsc output; `Test Files 9 passed (9)` / `Tests 34 passed (34)`

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lucide-icon-renames.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function readSource(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');
}

describe('lucide-react v1 icon renames', () => {
  it('activity/page.tsx uses the renamed Circle* icons, not the removed v0 names', () => {
    const source = readSource('app/(dashboard)/dashboard/activity/page.tsx');
    expect(source).not.toMatch(/\bAlertCircle\b/);
    expect(source).not.toMatch(/\bCheckCircle\b/);
    expect(source).toMatch(/\bCircleAlert\b/);
    expect(source).toMatch(/\bCircleCheck\b/);
  });

  it('invite-team.tsx uses CirclePlus, not the removed PlusCircle', () => {
    const source = readSource('app/(dashboard)/dashboard/invite-team.tsx');
    expect(source).not.toMatch(/\bPlusCircle\b/);
    expect(source).toMatch(/\bCirclePlus\b/);
  });

  it('footer.tsx no longer imports the removed brand icons from lucide-react', () => {
    const source = readSource(
      'components/landing-page/footer/footer.tsx'
    );
    expect(source).not.toMatch(/\b(Facebook|Instagram|Linkedin)\b/);
  });
});
```

```ts
// tests/unit/marked-api.test.ts
import { describe, it, expect } from 'vitest';
import { marked } from 'marked';

// Locks in the exact API surface StoryDisplay.tsx depends on
// (new marked.Lexer() / new marked.Parser(), lexer.lex(), parser.parse())
// across the ^15 -> 18.0.6 bump.
describe('marked Lexer/Parser API used by StoryDisplay.tsx', () => {
  it('lexes and parses markdown into the expected HTML', () => {
    const parser = new marked.Parser();
    const lexer = new marked.Lexer();

    const tokens = lexer.lex('# Hello\n\nThis is **bold** and *italic* text.');
    const html = parser.parse(tokens);

    expect(typeof html).toBe('string');
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('returns a synchronous string, not a Promise, with no async extensions registered', () => {
    const parser = new marked.Parser();
    const lexer = new marked.Lexer();
    const tokens = lexer.lex('Just plain text.');
    const result = parser.parse(tokens);
    expect(result).not.toBeInstanceOf(Promise);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/lucide-icon-renames.test.ts tests/unit/marked-api.test.ts`
Expected: `lucide-icon-renames.test.ts` FAILS all 3 cases (source still contains `AlertCircle`, `CheckCircle`, `PlusCircle`, and `footer.tsx` still imports `Facebook, Instagram, Linkedin`); `marked-api.test.ts` PASSES already against the currently-pinned `marked@^15.0.7` (this file is a baseline-lock regression guard, not a new-behavior test — it must keep passing unchanged after the bump)

- [ ] **Step 3: Write minimal implementation**

```diff
-    "lucide-react": "^0.474.0",
-    "marked": "^15.0.7",
+    "lucide-react": "^1.24.0",
+    "marked": "^18.0.6",
```

```bash
pnpm install
```

`app/(dashboard)/dashboard/activity/page.tsx`:

```diff
 import {
   Settings,
   LogOut,
   UserPlus,
   Lock,
   UserCog,
-  AlertCircle,
+  CircleAlert,
   UserMinus,
   Mail,
-  CheckCircle,
+  CircleCheck,
   type LucideIcon,
 } from 'lucide-react';
```
```diff
-  [ActivityType.ACCEPT_INVITATION]: CheckCircle,
+  [ActivityType.ACCEPT_INVITATION]: CircleCheck,
```
```diff
-              <AlertCircle className="h-12 w-12 text-pink-500 mb-4" />
+              <CircleAlert className="h-12 w-12 text-pink-500 mb-4" />
```

`app/(dashboard)/dashboard/invite-team.tsx`:

```diff
-import { Loader2, PlusCircle } from 'lucide-react';
+import { Loader2, CirclePlus } from 'lucide-react';
```
```diff
-                <PlusCircle className="mr-2 h-4 w-4" />
+                <CirclePlus className="mr-2 h-4 w-4" />
```

`components/landing-page/footer/footer.tsx` — `Facebook`, `Instagram`, `Linkedin` are imported but never rendered anywhere in this file (only `Icons.twitter`/`Icons.gitHub` are used), so the fix is simply deleting the now-invalid dead import:

```diff
 import { Icons } from "./icons"
 import { Button } from "@/components/ui/button"
 import { Input } from "@/components/ui/input"
 import { Label } from "@/components/ui/label"
-import { Facebook, Instagram, Linkedin } from "lucide-react"
```

No change to `components/ai-tutor-api/StoryDisplay.tsx` — its `new marked.Lexer()`/`new marked.Parser()` call site is unaffected by v18 (verified: v18.0.0's only breaking changes are trailing-blank-line trimming in block tokens and an internal TS6 bump for marked's own build, neither of which touches the `Lexer`/`Parser` class shape or the default synchronous `parse()` return).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/lucide-icon-renames.test.ts tests/unit/marked-api.test.ts`
Expected: PASS — all 5 cases green

Run: `pnpm exec tsc --noEmit`
Expected: PASS — no output (confirms no other file in the repo still references a removed/renamed lucide icon; `GemIcon`/`BotIcon`/`HistoryIcon`/`CircleIcon` used elsewhere in `app-sidebar.tsx`/`WorkflowHistoryDrawer.tsx`/`not-found.tsx` are the "Icon"-suffixed aliased names, confirmed still present in `lucide-react@1`)

Run: `pnpm test`
Expected: PASS — `Test Files 9 passed (9)` / `Tests 34 passed (34)`

- [ ] **Step 5: Commit**
```bash
git add package.json pnpm-lock.yaml "app/(dashboard)/dashboard/activity/page.tsx" "app/(dashboard)/dashboard/invite-team.tsx" components/landing-page/footer/footer.tsx tests/unit/lucide-icon-renames.test.ts tests/unit/marked-api.test.ts
git commit -m "Upgrade lucide-react to 1.24.0 (fixing renamed icons + a dead brand-icon import) and marked to 18.0.6"
```

---

### Task 7: Drizzle ORM / Drizzle Kit Upgrade

**Goal:** Bump `drizzle-orm` 0.39.1→0.45.2 and `drizzle-kit` 0.30.4→0.31.10 and prove the schema/migration/query layer still works end-to-end against a real local Postgres.

**Files:**
- Modify: `package.json:37-38`
- Modify: `pnpm-lock.yaml` (regenerated by `pnpm add`)
- Test: `tests/unit/tiers-limit.test.ts` (extends the file created in Task 1)

**Acceptance Criteria:**
- [ ] `drizzle-orm` resolves to `0.45.2` and `drizzle-kit` to `0.31.10` in `package.json` and `pnpm-lock.yaml`
- [ ] `pnpm db:generate` produces no unreviewed/unexpected SQL diff against the current `lib/db/schema.ts` (schema.ts itself is unchanged by this task — any diff `db:generate` proposes has been read and understood, not blindly accepted)
- [ ] The three existing migration files (`0000_soft_the_anarchist.sql`, `0001_amused_umar.sql`, `0002_short_roxanne_simpson.sql`) and `lib/db/migrations/meta/_journal.json` (snapshot `"version": "7"`) are untouched by `git diff` after generation
- [ ] `pnpm db:migrate` applies cleanly against the local Postgres from `lib/db/setup.ts`
- [ ] `pnpm db:seed` completes successfully against the migrated database
- [ ] `tests/unit/tiers-limit.test.ts` passes, proving `checkMessageLimit`/`incrementMessageCount` still read/write correctly through the new ORM version
- [ ] `pnpm exec tsc --noEmit` is clean

**Verify:** `pnpm exec tsc --noEmit && pnpm db:generate && pnpm db:migrate && pnpm db:seed && pnpm test -- tests/unit/tiers-limit.test.ts` → tsc clean; `db:generate` reports no schema changes (or a diff you've explicitly reviewed); `db:migrate`/`db:seed` exit 0; vitest reports `tests/unit/tiers-limit.test.ts` — 5 passed.

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/tiers-limit.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { eq } from 'drizzle-orm';
import { db, client } from '@/lib/db/drizzle';
import { teams } from '@/lib/db/schema';
import { checkMessageLimit, incrementMessageCount } from '@/lib/db/utils';

const require = createRequire(import.meta.url);

function coreVersion(v: string): number[] {
  return v.split('-')[0].split('.').map(Number);
}

function atLeast(actual: string, min: string): boolean {
  const a = coreVersion(actual);
  const m = coreVersion(min);
  for (let i = 0; i < Math.max(a.length, m.length); i++) {
    const av = a[i] ?? 0;
    const mv = m[i] ?? 0;
    if (av !== mv) return av > mv;
  }
  return true;
}

describe('drizzle-orm / drizzle-kit version pin', () => {
  it('drizzle-orm is at least 0.45.2', () => {
    const { version } = require('drizzle-orm/package.json');
    expect(
      atLeast(version, '0.45.2'),
      `installed drizzle-orm ${version} is older than 0.45.2`
    ).toBe(true);
  });

  it('drizzle-kit is at least 0.31.10', () => {
    const { version } = require('drizzle-kit/package.json');
    expect(
      atLeast(version, '0.31.10'),
      `installed drizzle-kit ${version} is older than 0.31.10`
    ).toBe(true);
  });
});

describe('checkMessageLimit / incrementMessageCount (real Postgres)', () => {
  let teamId: number;

  beforeAll(async () => {
    const [team] = await db
      .insert(teams)
      .values({ name: 'Drizzle Upgrade Test Team', messageLimit: 5, currentMessages: 0 })
      .returning();
    teamId = team.id;
  });

  afterAll(async () => {
    await db.delete(teams).where(eq(teams.id, teamId));
    await client.end();
  });

  it('reports withinLimit true and remainingMessages 5 for a fresh team', async () => {
    const result = await checkMessageLimit(teamId);
    expect(result.withinLimit).toBe(true);
    expect(result.remainingMessages).toBe(5);
  });

  it('increments currentMessages and reduces remainingMessages accordingly', async () => {
    await incrementMessageCount(teamId, 3);
    const result = await checkMessageLimit(teamId);
    expect(result.remainingMessages).toBe(2);
    expect(result.withinLimit).toBe(true);
  });

  it('flips withinLimit to false once the free-tier limit of 5 is reached', async () => {
    await incrementMessageCount(teamId, 2);
    const result = await checkMessageLimit(teamId);
    expect(result.remainingMessages).toBe(0);
    expect(result.withinLimit).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test -- tests/unit/tiers-limit.test.ts`
Expected: FAIL with
```
 FAIL  tests/unit/tiers-limit.test.ts > drizzle-orm / drizzle-kit version pin > drizzle-orm is at least 0.45.2
AssertionError: installed drizzle-orm 0.39.1 is older than 0.45.2: expected false to be true

 FAIL  tests/unit/tiers-limit.test.ts > drizzle-orm / drizzle-kit version pin > drizzle-kit is at least 0.31.10
AssertionError: installed drizzle-kit 0.30.4 is older than 0.31.10: expected false to be true

Test Files  1 failed (1)
     Tests  2 failed | 3 passed (5)
```

- [ ] **Step 3: Write minimal implementation**

```bash
pnpm add drizzle-orm@0.45.2 drizzle-kit@0.31.10
pnpm db:generate
```

Inspect the `db:generate` output/diff before applying anything. Specifically check for:
- No `ALTER`/`DROP` statements touching existing columns on `users`, `teams`, `team_members`, `activity_logs`, `invitations`, `messages`, or `workflow_history` (schema.ts hasn't changed, so ideally zero SQL is generated — expect `No schema changes, nothing to migrate 😴`).
- If drizzle-kit's improved introspection heuristics propose a column/table **rename** it can't disambiguate from a create+drop, do not accept it non-interactively — resolve the prompt manually and re-inspect.
- `lib/db/migrations/meta/_journal.json`'s `"version"` field stays `"7"` (a bumped snapshot version means a breaking snapshot-format change requiring a bigger migration review than this task scopes).
- `git diff --stat lib/db/migrations` shows nothing under the existing `0000`/`0001`/`0002` files.

```bash
pnpm db:migrate
pnpm db:seed
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm exec tsc --noEmit && pnpm test -- tests/unit/tiers-limit.test.ts`
Expected: PASS
```
Test Files  1 passed (1)
     Tests  5 passed (5)
```

- [ ] **Step 5: Commit**
```bash
git add package.json pnpm-lock.yaml tests/unit/tiers-limit.test.ts
git commit -m "Bump drizzle-orm to 0.45.2 and drizzle-kit to 0.31.10, verified end-to-end against local Postgres"
```

---

### Task 8: Zod v3→v4 Upgrade

**Goal:** Bump `zod` 3.24.1→4.4.3 and fix the one call site that breaks (`ZodError.errors`, removed in v4), confirming `app/(login)/actions.ts`'s schemas need no changes.

**Files:**
- Modify: `package.json:56`
- Modify: `lib/auth/middleware.ts:22-25`, `lib/auth/middleware.ts:47-50`
- Test: `tests/unit/validated-action.test.ts`

**Acceptance Criteria:**
- [ ] `zod` resolves to `4.4.3`
- [ ] `lib/auth/middleware.ts` no longer reads `result.error.errors` (removed entirely in v4 — not a deprecated alias, per Zod's own v4 changelog) and uses `result.error.issues` instead, in both `validatedAction` and `validatedActionWithUser`
- [ ] `app/(login)/actions.ts`'s seven schemas (`signInSchema`, `signUpSchema`, `updatePasswordSchema`, `deleteAccountSchema`, `updateAccountSchema`, `removeTeamMemberSchema`, `inviteTeamMemberSchema`) are confirmed to need **no** source changes — none use `.merge()` or `z.nativeEnum()`; the two `.email()` calls (lines 48, 104) remain deprecated-but-functional in v4
- [ ] `tests/unit/validated-action.test.ts` passes
- [ ] `pnpm exec tsc --noEmit` is clean
- [ ] `tests/e2e/auth-and-dashboard.spec.ts` (Task 1's sign-in/sign-up e2e coverage) passes against the upgraded validation layer

**Verify:** `pnpm exec tsc --noEmit && pnpm test -- tests/unit/validated-action.test.ts && pnpm test:e2e -- tests/e2e/auth-and-dashboard.spec.ts` → tsc clean; unit test 3/3 passed; e2e sign-in/sign-up specs passed.

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/validated-action.test.ts
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { z } from 'zod';
import { validatedAction } from '@/lib/auth/middleware';

const require = createRequire(import.meta.url);

function coreVersion(v: string): number[] {
  return v.split('-')[0].split('.').map(Number);
}

function atLeast(actual: string, min: string): boolean {
  const a = coreVersion(actual);
  const m = coreVersion(min);
  for (let i = 0; i < Math.max(a.length, m.length); i++) {
    const av = a[i] ?? 0;
    const mv = m[i] ?? 0;
    if (av !== mv) return av > mv;
  }
  return true;
}

describe('zod version pin', () => {
  it('zod is at least 4.4.3', () => {
    const { version } = require('zod/package.json');
    expect(
      atLeast(version, '4.4.3'),
      `installed zod ${version} is older than 4.4.3`
    ).toBe(true);
  });
});

describe('validatedAction error message extraction', () => {
  const testSchema = z.object({
    email: z.string().email().min(3).max(255),
    password: z.string().min(8).max(100),
  });

  const action = validatedAction(testSchema, async (data) => {
    return { success: `welcome ${data.email}` };
  });

  it('surfaces a Zod issue message string on invalid input', async () => {
    const formData = new FormData();
    formData.set('email', 'not-an-email');
    formData.set('password', 'short');

    const result = await action({}, formData);

    expect(result).toHaveProperty('error');
    expect(typeof (result as { error: string }).error).toBe('string');
    expect((result as { error: string }).error.length).toBeGreaterThan(0);
  });

  it('passes validated data through to the action on valid input', async () => {
    const formData = new FormData();
    formData.set('email', 'user@example.com');
    formData.set('password', 'a-long-enough-password');

    const result = await action({}, formData);

    expect(result).toEqual({ success: 'welcome user@example.com' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test -- tests/unit/validated-action.test.ts`
Expected: FAIL with
```
 FAIL  tests/unit/validated-action.test.ts > zod version pin > zod is at least 4.4.3
AssertionError: installed zod 3.24.1 is older than 4.4.3: expected false to be true

Test Files  1 failed (1)
     Tests  1 failed | 2 passed (3)
```
(the two functional subtests still pass here because `ZodError.errors` still exists on zod 3 — the version-pin assertion is what's red.)

- [ ] **Step 3: Write minimal implementation**

```bash
pnpm add zod@4.4.3
```

Fix both occurrences in `lib/auth/middleware.ts` (without this, once zod is on v4, `result.error.errors` is `undefined` and `[0].message` throws a `TypeError`, which would newly break the functional subtests above):

```ts
// lib/auth/middleware.ts — validatedAction (was line 24)
    const result = schema.safeParse(Object.fromEntries(formData));
    if (!result.success) {
      return { error: result.error.issues[0].message } as T;
    }
```

```ts
// lib/auth/middleware.ts — validatedActionWithUser (was line 49)
    const result = schema.safeParse(Object.fromEntries(formData));
    if (!result.success) {
      return { error: result.error.issues[0].message } as T;
    }
```

`app/(login)/actions.ts` needs no edits — confirmed via `grep -n "\.merge(\|z\.nativeEnum" app/\(login\)/actions.ts` returning nothing; its two `.email()` calls (lines 48, 104) remain valid, just deprecated in favor of the top-level `z.email()`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm exec tsc --noEmit && pnpm test -- tests/unit/validated-action.test.ts`
Expected: PASS
```
Test Files  1 passed (1)
     Tests  3 passed (3)
```

- [ ] **Step 5: Commit**
```bash
git add package.json pnpm-lock.yaml lib/auth/middleware.ts tests/unit/validated-action.test.ts
git commit -m "Bump zod to 4.4.3 and switch middleware.ts off the removed ZodError.errors alias"
```

---

### Task 9: Stripe SDK ^17.6.0→22.3.1 Upgrade

**Goal:** Bump `stripe` to 22.3.1, update the pinned `apiVersion` literal to what the new SDK actually ships, and verify everything that can be verified without Stripe test-mode access.

**Files:**
- Modify: `package.json:50`
- Modify: `lib/payments/stripe.ts:10-12`
- Test: `tests/unit/stripe-config.test.ts`

**Acceptance Criteria:**
- [ ] `stripe` resolves to `22.3.1`
- [ ] `lib/payments/stripe.ts`'s `apiVersion` literal matches the version the installed SDK actually pins (verified below to be `'2026-06-24.dahlia'` by extracting the `ApiVersion` constant directly from `stripe@22.3.1`'s shipped `cjs/apiVersion.js` — re-confirm this if a different `stripe` patch ends up installed, since `apiVersion` is typed as a loose `string`, not a literal union, in this SDK's `UserProvidedConfig` type, so **`tsc` will not catch a stale value by itself**)
- [ ] `pnpm exec tsc --noEmit` is clean (this does catch the *other* v22 breaking changes, none of which apply to this repo: constructor already uses `new Stripe(...)`; no callback-style SDK calls exist; no per-request `host` overrides; no `Stripe.StripeContext` usage anywhere in `lib/payments/stripe.ts`, `app/api/stripe/checkout/route.ts`, or `app/api/stripe/webhook/route.ts`)
- [ ] `pnpm build` succeeds
- [ ] `tests/unit/stripe-config.test.ts` passes
- [ ] The full existing unit + e2e suite from Task 1 stays green
- [ ] **Explicitly unchecked / out of scope for this task:** the real Checkout Session creation → `customer.subscription.updated`/`.deleted` webhook round trip has **not** been exercised against live or test-mode Stripe here (no Stripe CLI/test-mode access is available in this environment). Before this reaches production, run `stripe listen --forward-to localhost:3000/api/stripe/webhook` in Stripe test mode and manually walk through a checkout — that verification is the user's, not this task's.

**Verify:** `pnpm exec tsc --noEmit && pnpm build && pnpm test && pnpm test:e2e` → tsc clean; build succeeds; unit suite green (incl. `tests/unit/stripe-config.test.ts`); e2e suite green. (Checkout/webhook round trip intentionally excluded — see the unchecked criterion above.)

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/stripe-config.test.ts
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

function coreVersion(v: string): number[] {
  return v.split('-')[0].split('.').map(Number);
}

function atLeast(actual: string, min: string): boolean {
  const a = coreVersion(actual);
  const m = coreVersion(min);
  for (let i = 0; i < Math.max(a.length, m.length); i++) {
    const av = a[i] ?? 0;
    const mv = m[i] ?? 0;
    if (av !== mv) return av > mv;
  }
  return true;
}

describe('stripe version pin', () => {
  it('stripe is at least 22.3.1', () => {
    const { version } = require('stripe/package.json');
    expect(
      atLeast(version, '22.3.1'),
      `installed stripe ${version} is older than 22.3.1`
    ).toBe(true);
  });
});

describe('lib/payments/stripe.ts apiVersion literal', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'lib/payments/stripe.ts'),
    'utf8'
  );

  it('no longer pins the pre-upgrade 2025-01-27.acacia version', () => {
    expect(source).not.toMatch(/2025-01-27\.acacia/);
  });

  it('pins a validly-shaped dated Stripe API version', () => {
    const match = source.match(/apiVersion:\s*'([^']+)'/);
    expect(match, "expected an apiVersion: '...' literal in lib/payments/stripe.ts").not.toBeNull();
    expect(match![1]).toMatch(/^\d{4}-\d{2}-\d{2}\.[a-z]+$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test -- tests/unit/stripe-config.test.ts`
Expected: FAIL with
```
 FAIL  tests/unit/stripe-config.test.ts > stripe version pin > stripe is at least 22.3.1
AssertionError: installed stripe 17.6.0 is older than 22.3.1: expected false to be true

 FAIL  tests/unit/stripe-config.test.ts > lib/payments/stripe.ts apiVersion literal > no longer pins the pre-upgrade 2025-01-27.acacia version
AssertionError: expected "…apiVersion: '2025-01-27.acacia'…" not to match /2025-01-27\.acacia/

Test Files  1 failed (1)
     Tests  2 failed | 1 passed (3)
```

- [ ] **Step 3: Write minimal implementation**

```bash
pnpm add stripe@22.3.1
pnpm exec tsc --noEmit
```

`tsc` will not flag the stale `apiVersion` literal itself (it's typed `apiVersion?: string` in `stripe@22.3.1`'s `UserProvidedConfig`), so the actual required literal was confirmed directly by inspecting the installed package: `node_modules/stripe/cjs/apiVersion.js` exports `exports.ApiVersion = '2026-06-24.dahlia';`. Update accordingly:

```ts
// lib/payments/stripe.ts (was lines 10-12)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Pinned to match the version stripe@22.3.1 actually ships
  // (node_modules/stripe/cjs/apiVersion.js -> exports.ApiVersion).
  // Re-check that file if the installed stripe patch version ever changes.
  apiVersion: '2026-06-24.dahlia'
});
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm exec tsc --noEmit && pnpm build && pnpm test -- tests/unit/stripe-config.test.ts`
Expected: PASS
```
Test Files  1 passed (1)
     Tests  3 passed (3)
```

- [ ] **Step 5: Commit**
```bash
git add package.json pnpm-lock.yaml lib/payments/stripe.ts tests/unit/stripe-config.test.ts
git commit -m "Bump stripe to 22.3.1 and re-pin apiVersion to 2026-06-24.dahlia; checkout/webhook round trip still needs manual stripe-listen verification"
```

---

### Task 10: `ai` SDK v4→v7 Hop-by-Hop Upgrade (Chat Streaming)

**Goal:** Gate-check whether the external `aitutor-api.vercel.app` stream is compatible with `@ai-sdk/react` v7's wire protocol, then either complete the v4→v5→v6→v7 hop-by-hop upgrade of the chatbot, or freeze `ai` at its latest 4.x patch and document why.

**Files:**
- Modify: `components/ai-tutor-api/StreamingChat.tsx` (full file, rewritten per hop — compatible branch only)
- Modify: `app/api/chat/route.ts` (full file — compatible branch: request/response adaptation; incompatible branch: unchanged except a doc comment)
- Modify: `package.json:29` (`ai`, plus a new `@ai-sdk/react` entry)
- Create (incompatible branch only): `docs/superpowers/specs/2026-07-15-ai-sdk-v4-freeze.md`
- Test: `tests/e2e/chatbot.spec.ts` (already created in Task 1 — re-run after every hop, not rewritten by this task)

**Acceptance Criteria — Branch A (compatible, full v7 upgrade lands):**
- [ ] Gate check performed and its raw output recorded in the commit message/PR description, classified as compatible with `@ai-sdk/react` v7's UI Message Stream protocol
- [ ] `ai`/`@ai-sdk/react` bumped hop-by-hop, each hop its own commit: `ai@4.1.44` → `ai@5.0.213` + `@ai-sdk/react@2.0.215` → `ai@6.0.227` + `@ai-sdk/react@3.0.229` → `ai@7.0.28` + `@ai-sdk/react@4.0.31`
- [ ] `components/ai-tutor-api/StreamingChat.tsx` rewritten onto `@ai-sdk/react`'s `transport`/`parts`/`status`/`sendMessage` model
- [ ] `app/api/chat/route.ts` adapted to (a) translate the client's `UIMessage[]` request body down to the `{role, content}` shape the external API expects, and (b) emit the `x-vercel-ai-ui-message-stream: v1` header
- [ ] `tests/e2e/chatbot.spec.ts` (from Task 1) passes after **every** hop, not just the final one — note it only runs a real assertion when real AI Tutor API credentials are configured (see Task 1); without them, the manual gate check in Step 1 below is the *only* real signal for this task, and that must not be skipped just because the automated test self-skips
- [ ] `pnpm exec tsc --noEmit` clean at every hop

**Acceptance Criteria — Branch B (incompatible, frozen at v4):**
- [ ] Gate check performed and its raw output recorded, classified as incompatible with (or non-trivially unadaptable to) `@ai-sdk/react`'s protocol
- [ ] `ai` pinned at `4.3.19` (latest 4.x patch); `StreamingChat.tsx` and `app/api/chat/route.ts` left functionally unchanged
- [ ] The freeze reason is documented in the repo — a code comment in `app/api/chat/route.ts` **and** `docs/superpowers/specs/2026-07-15-ai-sdk-v4-freeze.md` — so the v5+ migration isn't silently re-attempted later
- [ ] `tests/e2e/chatbot.spec.ts` still passes (or still self-skips, unchanged)
- [ ] `pnpm exec tsc --noEmit` clean

**Verify (Branch A):** `pnpm exec tsc --noEmit && pnpm test:e2e -- tests/e2e/chatbot.spec.ts` → clean; smoke test passes against the real external API (requires real AI Tutor API credentials to be a meaningful pass rather than a skip).
**Verify (Branch B):** `pnpm add ai@4.3.19 && pnpm exec tsc --noEmit && pnpm test:e2e -- tests/e2e/chatbot.spec.ts` → clean; smoke test still passes or still skips, unchanged.

**Steps:**

- [ ] **Step 1: Gate check (mandatory before choosing a branch — this is the real verification, independent of whether the automated e2e test can run)**

Add temporary logging to the proxy's transform loop:

```ts
// app/api/chat/route.ts — TEMPORARY, remove before committing either branch below
const stream = new TransformStream({
  async transform(chunk, controller) {
    const text = decoder.decode(chunk);
    console.log('[gate-check] raw chunk:', JSON.stringify(text));
    controller.enqueue(encoder.encode(text));
  },
});
```

Run `pnpm dev`, open `/dashboard/chatbot`, send "hello", and read the server console for the first several chunks. Or bypass the proxy entirely and hit the external service directly, using the real values from `.env`:

```bash
curl -N -X POST "https://aitutor-api.vercel.app/api/v1/chat/${NEXT_PUBLIC_AITUTOR_TOKEN}/stream" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AITUTOR_API_KEY}" \
  -d '{"messages":[{"role":"user","content":"hello"}]}'
```

**COMPATIBLE** looks like SSE `data: ` lines carrying a `type`-discriminated JSON envelope matching the v7 UI Message Stream protocol, e.g.:
```
data: {"type":"start","messageId":"msg_1"}
data: {"type":"text-start","id":"t1"}
data: {"type":"text-delta","id":"t1","delta":"Hel"}
data: {"type":"text-delta","id":"t1","delta":"lo!"}
data: {"type":"text-end","id":"t1"}
data: {"type":"finish"}
data: [DONE]
```
(the missing `x-vercel-ai-ui-message-stream: v1` response header doesn't disqualify it — that header is on the Route Handler, which we own, and can simply be added.)

**INCOMPATIBLE** looks like plain text tokens with no JSON envelope, NDJSON with no `type` discriminator, or the older `0:"..."` / `d:{...}` prefixed data-stream-protocol lines that pre-v5 `ai/react` used — none of these can be parsed by `@ai-sdk/react`'s v5+ transport without a real translation layer in the proxy, which is out of scope for this task (see Branch B).

**If real AI Tutor API credentials are not available to run this check at all** (a fresh `.env` has none by default), do not guess — treat that as equivalent to "cannot confirm compatible" and take Branch B, documenting the reason as "gate check could not be performed (no credentials available)" rather than "confirmed incompatible".

Remove the temporary `console.log` again regardless of outcome — do not commit gate-check logging.

---

**Branch A — if compatible:**

- [ ] **Step 2a: Hop 4→5**
```bash
pnpm add ai@5.0.213 @ai-sdk/react@2.0.215
```
Breaking changes at this hop: `ai/react` → `@ai-sdk/react` (new dependency); `useChat` drops `input`/`handleInputChange`/`handleSubmit`/`isLoading`/`keepLastMessageOnError` — input state and loading become the caller's job; `message.content` (string) → `message.parts` (array of `{type, text}` parts); endpoint config moves from a flat `api` string to `transport: new DefaultChatTransport({ api })` (from `'ai'`).

```tsx
// components/ai-tutor-api/StreamingChat.tsx
'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function StreamingChat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  }

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-4 rounded-lg ${
              message.role === 'user' ? 'bg-purple-100 ml-8' : 'bg-white/50 mr-8'
            }`}
          >
            <div className="font-semibold mb-1">
              {message.role === 'user' ? 'You:' : 'AI:'}
            </div>
            <div className="text-gray-700">
              {message.parts.map((part, i) =>
                part.type === 'text' ? <span key={i}>{part.text}</span> : null
              )}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-white/30">
        <div className="flex gap-2">
          <input
            className="flex-1 p-4 rounded-lg bg-white/50 border border-purple-200 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent shadow-inner"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-4 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

The Route Handler must translate the request (client now sends `UIMessage[]` with `parts`, but the external API expects `{role, content}`) and add the response header the new client relies on:

```ts
// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { UIMessage } from 'ai';

function toLegacyMessages(messages: UIMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join(''),
  }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = toLegacyMessages(body.messages);

    const token = process.env.NEXT_PUBLIC_AITUTOR_TOKEN;

    const response = await fetch(
      `https://aitutor-api.vercel.app/api/v1/chat/${token}/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AITUTOR_API_KEY}`,
        },
        body: JSON.stringify({ messages }),
      }
    );

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new TransformStream({
      async transform(chunk, controller) {
        const text = decoder.decode(chunk);
        controller.enqueue(encoder.encode(text));
      },
    });

    response.body?.pipeTo(stream.writable);

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'x-vercel-ai-ui-message-stream': 'v1',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Streaming API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

Run: `pnpm exec tsc --noEmit && pnpm test:e2e -- tests/e2e/chatbot.spec.ts` → expected PASS (or skip, per Task 1's credential gate).

```bash
git add package.json pnpm-lock.yaml components/ai-tutor-api/StreamingChat.tsx app/api/chat/route.ts
git commit -m "Hop ai SDK 4->5: migrate StreamingChat.tsx to @ai-sdk/react and adapt /api/chat's proxy"
```

- [ ] **Step 2b: Hop 5→6**
```bash
pnpm add ai@6.0.227 @ai-sdk/react@3.0.229
```
Researched v6 breaking changes (`CallWarning` → unified `Warning` type; `unknown` finish reason → `other`) touch neither this component nor the route handler — no source changes expected at this hop. Re-run `pnpm exec tsc --noEmit && pnpm test:e2e -- tests/e2e/chatbot.spec.ts` → expected PASS unchanged.
```bash
git add package.json pnpm-lock.yaml
git commit -m "Hop ai SDK 5->6: bump ai/@ai-sdk/react, no call-site changes required"
```

- [ ] **Step 2c: Hop 6→7**
```bash
pnpm add ai@7.0.28 @ai-sdk/react@4.0.31
```
v7 requires Node.js 22+ and is ESM-only (confirm local Node with `node --version`, and bump `actions/setup-node`'s `node-version` in `.github/workflows/ci.yml` to `22` or higher if it's pinned lower — Task 1's CI already pins `22`, so this should already be satisfied). `onFinish` is renamed `onEnd` — not used by this component today, no change required, but note it for any future `useChat` callback additions. Re-run `pnpm exec tsc --noEmit && pnpm test:e2e -- tests/e2e/chatbot.spec.ts` → expected PASS.
```bash
git add package.json pnpm-lock.yaml
git commit -m "Hop ai SDK 6->7: bump ai/@ai-sdk/react to the v7 baseline, confirm Node 22+ in CI"
```

---

**Branch B — if incompatible or unverifiable:**

- [ ] **Step 2: Freeze at latest 4.x and document**
```bash
pnpm add ai@4.3.19
pnpm exec tsc --noEmit
```
Leave `components/ai-tutor-api/StreamingChat.tsx` and `app/api/chat/route.ts` unchanged (still `ai/react`'s legacy `useChat`).

```ts
// app/api/chat/route.ts — add near the top of the file
// NOTE: `ai` is intentionally frozen at 4.3.19 (not upgraded to v5-v7).
// The v5+ useChat/@ai-sdk/react data-stream protocol was gate-checked against
// this proxy's real upstream (https://aitutor-api.vercel.app/api/v1/chat/{token}/stream)
// on 2026-07-15 and found incompatible (or could not be confirmed compatible)
// without a translation layer we don't own.
// See docs/superpowers/specs/2026-07-15-ai-sdk-v4-freeze.md before re-attempting.
```

```md
<!-- docs/superpowers/specs/2026-07-15-ai-sdk-v4-freeze.md -->
# `ai` SDK frozen at v4.3.19 (2026-07-15)

Phase 1 step 11 of the modernization design attempted the `ai` v4→v7 hop-by-hop
upgrade. The gate check (raw inspection of the external
`https://aitutor-api.vercel.app/api/v1/chat/{token}/stream` response, or lack
of credentials to perform that inspection at all) showed the upstream does not
emit -- or could not be confirmed to emit -- `@ai-sdk/react` v5+'s UI Message
Stream protocol (`data: {"type": ...}` SSE envelope), and this repo does not
own that service, so no translation layer could be added upstream.

`ai` is pinned at the latest 4.x patch (4.3.19) instead. `StreamingChat.tsx`
continues to use `ai/react`'s legacy `useChat`. Re-attempt the v5+ migration
only once the external API's contract is confirmed compatible (with real
credentials to actually run the gate check in Task 10, Step 1), or a
translation layer is added to `app/api/chat/route.ts`'s proxy.
```

Run: `pnpm exec tsc --noEmit && pnpm test:e2e -- tests/e2e/chatbot.spec.ts` → expected PASS or skip, unchanged behavior.

```bash
git add package.json pnpm-lock.yaml app/api/chat/route.ts docs/superpowers/specs/2026-07-15-ai-sdk-v4-freeze.md
git commit -m "Freeze ai SDK at 4.3.19: external aitutor-api stream format incompatible with (or unverifiable against) @ai-sdk/react v5+"
```

---

### Task 11: Next.js Canary→16.2.10 Stable Upgrade

**Goal:** Move off `15.2.0-canary.33` onto Next.js `16.2.10` stable via the official codemod, then hand-resolve `next.config.ts`'s `experimental` block and the `middleware.ts`→`proxy.ts` rename.

**Files:**
- Modify: `package.json:44` (`next`; `react`/`react-dom` may also be re-touched by the codemod)
- Modify: `next.config.ts:1-11`
- Modify: `middleware.ts` → renamed `proxy.ts`
- Test: `tests/unit/next-version.test.ts`, plus the full Task-1 suite

**Acceptance Criteria:**
- [ ] `next` resolves to `16.2.10`
- [ ] `pnpm dlx @next/codemod@latest upgrade latest` has been run and its diff reviewed
- [ ] `next.config.ts`'s `experimental` block is gone entirely: `ppr` dropped per the confirmed design decision (full/boolean PPR was already canary-only and this app has zero `<Suspense>` usage); `newDevOverlay` dropped because Next.js removed that flag from its own config type before Next 16 shipped (confirmed via `vercel/next.js` PR #76356, "`[dev-overlay] remove the experiment config for overlay`" — the redesigned dev overlay is simply on by default now, no flag needed)
- [ ] `middleware.ts` is renamed to `proxy.ts`, exporting `async function proxy(request: NextRequest)` (body otherwise unchanged); nothing in the repo still references a file named `middleware.ts`
- [ ] `pnpm exec tsc --noEmit` is clean — this is what actually catches a stale `experimental.ppr`/`newDevOverlay` key, since `next.config.ts` assigns a typed `NextConfig` object literal and TypeScript's excess-property check rejects unknown keys once Next 16's shipped types no longer declare them
- [ ] Full Task-1 suite (unit + e2e) passes
- [ ] `pnpm build` succeeds
- [ ] Manual click-through checklist below completed at 1280px

**Verify:** `pnpm exec tsc --noEmit && pnpm test && pnpm test:e2e && pnpm build` → all green, plus the manual checklist:
- [ ] `/sign-in` — sign in with the seeded user (`test@test.com` / `admin123`)
- [ ] `/sign-up` — create a new account, redirects to `/dashboard`
- [ ] `/dashboard` — loads, sidebar renders
- [ ] `/dashboard/general` — profile settings load and save
- [ ] `/dashboard/security` — password update, delete-account flows render
- [ ] `/dashboard/activity` — activity log renders
- [ ] `/dashboard/team` — team member list and invite form render
- [ ] `/dashboard/chatbot` — streaming chat sends/receives a message
- [ ] `/dashboard/streaming` — same `StreamingChat` component renders correctly
- [ ] `/dashboard/workflow` — a workflow run completes and the history drawer opens
- [ ] `/dashboard/get-token` — page still renders (even though unreachable from nav)
- [ ] `/` — landing page renders
- [ ] `/pricing` — pricing page and checkout CTA render
(`/forgot-password` and `/reset-password` are skipped — Phase 3 hasn't landed yet.)

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/next-version.test.ts
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function coreVersion(v: string): number[] {
  return v.split('-')[0].split('.').map(Number);
}

function atLeast(actual: string, min: string): boolean {
  const a = coreVersion(actual);
  const m = coreVersion(min);
  for (let i = 0; i < Math.max(a.length, m.length); i++) {
    const av = a[i] ?? 0;
    const mv = m[i] ?? 0;
    if (av !== mv) return av > mv;
  }
  return true;
}

describe('next version pin', () => {
  it('next is at least 16.2.10', () => {
    const { version } = require('next/package.json');
    expect(
      atLeast(version, '16.2.10'),
      `installed next ${version} is older than 16.2.10`
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test -- tests/unit/next-version.test.ts`
Expected: FAIL with
```
 FAIL  tests/unit/next-version.test.ts > next version pin > next is at least 16.2.10
AssertionError: installed next 15.2.0-canary.33 is older than 16.2.10: expected false to be true

Test Files  1 failed (1)
     Tests  1 failed (1)
```

- [ ] **Step 3: Write minimal implementation**

```bash
pnpm dlx @next/codemod@latest upgrade latest
```
This mechanically: bumps `next`/`react`/`react-dom` to latest (confirm they land on/stay compatible with the 19.2.7 baseline from Task 3); updates any `experimental.turbopack` usage to top-level `turbopack` (none present here); migrates deprecated `middleware` convention to `proxy` (renames `middleware.ts` → `proxy.ts` and the exported function); removes `unstable_` prefixes from stabilized cache APIs (none present here); removes `experimental_ppr` route-segment config (none present here, since there's zero `<Suspense>` usage). Review its diff — do not accept blindly.

Hand-resolve what the codemod doesn't touch — the top-level `experimental` flags in `next.config.ts`:

```ts
// next.config.ts — before
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
    newDevOverlay: true
  }
};

export default nextConfig;
```

```ts
// next.config.ts — after
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

Confirm the codemod's rename landed correctly:

```ts
// proxy.ts (renamed from middleware.ts) — body unchanged, only the export name/filename changed
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { signToken, verifyToken } from '@/lib/auth/session';

const protectedRoutes = '/dashboard';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session');
  const isProtectedRoute = pathname.startsWith(protectedRoutes);

  if (isProtectedRoute && !sessionCookie) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  let res = NextResponse.next();

  if (sessionCookie) {
    try {
      const parsed = await verifyToken(sessionCookie.value);
      const expiresInOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000);

      res.cookies.set({
        name: 'session',
        value: await signToken({
          ...parsed,
          expires: expiresInOneDay.toISOString(),
        }),
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        expires: expiresInOneDay,
      });
    } catch (error) {
      console.error('Error updating session:', error);
      res.cookies.delete('session');
      if (isProtectedRoute) {
        return NextResponse.redirect(new URL('/sign-in', request.url));
      }
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm exec tsc --noEmit && pnpm test && pnpm test:e2e && pnpm build`
Expected: PASS — `tests/unit/next-version.test.ts` (1/1), full unit suite green, full e2e suite green, build succeeds.

- [ ] **Step 5: Commit**
```bash
git add package.json pnpm-lock.yaml next.config.ts proxy.ts tests/unit/next-version.test.ts
git rm middleware.ts
git commit -m "Upgrade Next.js from 15.2.0-canary.33 to 16.2.10 stable; drop experimental.ppr/newDevOverlay, rename middleware.ts to proxy.ts"
```
Then complete the manual click-through checklist listed under Verify above before considering this task done.
