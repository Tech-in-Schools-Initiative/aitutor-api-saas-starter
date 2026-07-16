# Phase 2: Monorepo Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the single-package Next.js app in `aitutor-api-saas-starter` into a pnpm + Turborepo monorepo with one app (`apps/web`) and four internal packages (`@repo/ui`, `@repo/config`, `@repo/db`, `@repo/email`), preserving every existing behavior and keeping the Phase-1 Vitest/Playwright suite green throughout the conversion.

**Architecture:** `apps/web` is `git mv`'d into place first so its history survives, then `packages/ui` (the 12 already-regenerated shadcn primitives, `cn()`, `use-mobile`) and `packages/config` (shared `tsconfig` splits, a minimal ESLint base, and the deduplicated Tailwind token block) are carved out. `packages/db` (schema/client/queries/utils/tiers/migrations/scripts) follows, split so it never imports `next/headers` — `getUser()` stays a thin Next-coupled wrapper in `apps/web/lib/auth/session.ts` calling a new framework-agnostic `getUserById(id)` from `@repo/db/queries`. `packages/email` is scaffolded empty-but-wired so Phase 3 doesn't need to touch workspace config again. Every internal package ships raw, unbuilt `.ts`/`.tsx` source that Next.js transpiles directly via `transpilePackages` — no `dist/` build step anywhere in the monorepo.

**Tech Stack:** pnpm workspaces, Turborepo, Next.js 16.2.10, React 19.2.7, TypeScript 5.9.3, Tailwind CSS v4.3.2, shadcn/ui (`new-york` style, unified `radix-ui` package), Drizzle ORM 0.45.2 / Drizzle Kit 0.31.10, Stripe 22.3.1, Vitest, Playwright, GitHub Actions.

**User decisions (already made):**
- `packages/ui`/`packages/db`/`packages/email` ship raw TypeScript via `transpilePackages`, not built to `dist/` via tsup — deferred as unnecessary friction for a starter template.
- Generic `@repo/*` package scope is used for all four internal packages (no real npm org exists today).
- `packages/db` stays framework-agnostic (zero `next/headers`/`next/navigation` imports). `getUser()` stays a thin Next-coupled wrapper in `apps/web/lib/auth/session.ts`, calling a new `getUserById(id)` exported from `@repo/db/queries` — this matters for Phase 5's query-layer work, which assumes `@repo/db` has no framework coupling.
- `lib/auth/*` and `lib/payments/*` **stay** in `apps/web/lib` (not extracted into a package): both are saturated with Next.js-only APIs and have exactly one consumer, so extracting them would add a Next.js peer-dependency to a "shared" package for no reuse benefit. This also matters for Phase 3: the new `reset-token.ts`/`password-reset.ts` files land in `apps/web/lib/auth/`, not in a package.

---

## Operational note for every task in this plan (read before dispatching any task)

Phase 1 (the dependency upgrade this plan builds on) is now fully merged into `aitutor-api-saas-starter`'s `main` branch — every path, version, and code snippet below was verified directly against that checkout, not against a worktree or an intermediate state. In particular:

- `app/globals.css` is **already** a single, deduplicated `:root`/`.dark`/`@theme inline` block (slate-hued palette, `--radius: 0.5rem`) — an earlier duplicate-block problem from before this phase was found and fixed as part of Phase 1's own review (commits `1320229`, `9c25439`, `c9d970a`), and `components.json`'s `baseColor` is `"slate"`, not `"zinc"`. Task 5 below extracts the real, current, already-clean block — it does **not** need to de-duplicate anything itself.
- This machine's shared pnpm store (per Phase 1's own operational note) has shown intermittent corruption. If `tsc --noEmit`, `pnpm test`, or `pnpm build` shows unexpected errors after any step in this plan, run `rm -rf node_modules apps/web/node_modules packages/*/node_modules && pnpm install` and recheck before concluding it's a real regression.

---

### Task 1: Root pnpm + Turborepo workspace scaffold

**Goal:** Create `pnpm-workspace.yaml` and `turbo.json` at the repo root as net-new, inert config files, before anything else moves.

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Test: N/A — mechanical structural change; verified via the Steps 2/4 commands below (Phase 2 adds no new automated tests per the design doc's Testing Strategy section)

**Acceptance Criteria:**
- [ ] `pnpm-workspace.yaml` declares `apps/*` and `packages/*` as workspace package globs
- [ ] `turbo.json` declares `build`/`dev`/`lint`/`test`/`test:e2e`/`db:generate`/`db:migrate` tasks
- [ ] `pnpm ls -r --depth -1` runs without a YAML-parse error
- [ ] Neither file touches the existing (still single-package) `package.json`

**Verify:** `node -e "JSON.parse(require('fs').readFileSync('turbo.json','utf8'))" && pnpm ls -r --depth -1` -> exits 0, no parse errors

**Steps:**

- [ ] **Step 1: Write the failing test**
```bash
test -f pnpm-workspace.yaml && test -f turbo.json
```

- [ ] **Step 2: Run test to verify it fails**
Run: `test -f pnpm-workspace.yaml && test -f turbo.json; echo "exit:$?"`
Expected: FAIL with `exit:1` (neither file exists yet)

- [ ] **Step 3: Write minimal implementation**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "test:e2e": {
      "dependsOn": ["build"]
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `test -f pnpm-workspace.yaml && test -f turbo.json; echo "exit:$?"`
Expected: PASS with `exit:0`

- [ ] **Step 5: Commit**
```bash
git add pnpm-workspace.yaml turbo.json
git commit -m "Add pnpm workspace and Turborepo root config"
```

---

### Task 2: Relocate the app into apps/web/ via git mv

**Goal:** Move every tracked app file into `apps/web/` preserving git history, stand up a fresh minimal root `package.json` (packageManager pin + turbo as its only devDependency), fix the now-mis-anchored `.gitignore` patterns, and regenerate the workspace-aware lockfile.

**Files:**
- Create: `package.json` (new root content, replacing the moved one)
- Modify: `.gitignore`
- Modify: `apps/web/package.json` (strip the now-ineffective `pnpm.overrides` block, add `"name": "web"`)
- Move (`git mv`): `.env.example`, `app/`, `components/`, `components.json`, `drizzle.config.ts`, `eslint.config.mjs`, `hooks/`, `lib/`, `next.config.ts`, `package.json`, `playwright.config.ts`, `postcss.config.mjs`, `proxy.ts`, `public/`, `tests/`, `tsconfig.json`, `vitest.config.ts` -> `apps/web/...`
- Test: N/A — mechanical move; verified via the existing Phase-1 Vitest/Playwright suite riding along, per Step 2/4 below

**Acceptance Criteria:**
- [ ] `apps/web/package.json` exists, has `"name": "web"`, and no longer has a `"pnpm"` key
- [ ] Root `package.json` has `"packageManager": "pnpm@10.23.0"`, `engines.node >= 20.9.0`, and `turbo` as its only devDependency
- [ ] `pnpm-lock.yaml` has separate `importers` entries for `.` and `apps/web`
- [ ] `.gitignore`'s `node_modules`/`.next`/`test-results`/`playwright-report`/`blob-report`/`out`/`build` patterns are un-anchored so they apply under `apps/web/` too
- [ ] `pnpm --filter web build` succeeds (the app is otherwise untouched — no `@repo/*` imports exist yet)
- [ ] `pnpm --filter web test` (the Phase-1 Vitest suite) still passes from its new location

**Verify:** `pnpm --filter web build && pnpm --filter web test` -> Next.js production build completes, all existing unit tests pass

**Steps:**

- [ ] **Step 1: Write the failing test**
```bash
test -f apps/web/package.json
```

- [ ] **Step 2: Run test to verify it fails**
Run: `test -f apps/web/package.json; echo "exit:$?"`
Expected: FAIL with `exit:1` (nothing has moved yet — `package.json` is still at the repo root)

- [ ] **Step 3: Write minimal implementation**

Move everything (from repo root):
```bash
mkdir -p apps/web

git mv .env.example apps/web/.env.example
git mv app apps/web/app
git mv components apps/web/components
git mv components.json apps/web/components.json
git mv drizzle.config.ts apps/web/drizzle.config.ts
git mv eslint.config.mjs apps/web/eslint.config.mjs
git mv hooks apps/web/hooks
git mv lib apps/web/lib
git mv next.config.ts apps/web/next.config.ts
git mv package.json apps/web/package.json
git mv playwright.config.ts apps/web/playwright.config.ts
git mv postcss.config.mjs apps/web/postcss.config.mjs
git mv proxy.ts apps/web/proxy.ts
git mv public apps/web/public
git mv tests apps/web/tests
git mv tsconfig.json apps/web/tsconfig.json
git mv vitest.config.ts apps/web/vitest.config.ts
```

Edit `apps/web/package.json` — remove the trailing `"pnpm"` override block and add a `name`:
```diff
   "private": true,
+  "name": "web",
   "scripts": {
@@
   "devDependencies": {
     "@playwright/test": "^1.61.1",
     "@testing-library/dom": "^10.4.1",
     "@testing-library/react": "^16.3.2",
     "@types/canvas-confetti": "^1.9.0",
     "@vitejs/plugin-react": "^6.0.3",
     "eslint": "^9.39.5",
     "eslint-config-next": "16.2.10",
     "jsdom": "^29.1.1",
     "vite-tsconfig-paths": "^6.1.1",
     "vitest": "^4.1.10"
-  },
-  "pnpm": {
-    "overrides": {
-      "@types/react": "19.2.17",
-      "@types/react-dom": "19.2.3"
-    }
   }
 }
```

Write the new root `package.json` (the `pnpm.overrides` block moves here — pnpm only honors `overrides` declared in the workspace root):
```json
{
  "name": "aitutor-api-saas-starter",
  "private": true,
  "packageManager": "pnpm@10.23.0",
  "engines": {
    "node": ">=20.9.0"
  },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "test:e2e": "turbo run test:e2e",
    "db:generate": "turbo run db:generate",
    "db:migrate": "turbo run db:migrate"
  },
  "pnpm": {
    "overrides": {
      "@types/react": "19.2.17",
      "@types/react-dom": "19.2.3"
    }
  }
}
```

Fix `.gitignore` (leading-slash patterns only match at the repo root; un-anchor them so they still apply inside `apps/web/`):
```diff
 # dependencies
-/node_modules
+node_modules
 /.pnp
 .pnp.js
 .yarn/install-state.gz

 # testing
 /coverage
-/test-results/
-/playwright-report/
-/blob-report/
+test-results/
+playwright-report/
+blob-report/

 # next.js
-/.next/
+.next/
 /out/

 # production
-/build
+build
```

Install `turbo` as the root's sole devDependency and regenerate the lockfile:
```bash
pnpm add -D -w turbo@latest
pnpm install
```

- [ ] **Step 4: Run test to verify it passes**
Run: `test -f apps/web/package.json; echo "exit:$?"`
Expected: PASS with `exit:0`

Then confirm the app still builds and tests from its new location:
```bash
pnpm --filter web build
pnpm --filter web test
```
Expected: PASS — build completes, all existing unit tests green.

- [ ] **Step 5: Commit**
```bash
git add package.json apps/web/package.json .gitignore pnpm-lock.yaml
git commit -m "Relocate app into apps/web/ and stand up the pnpm workspace root"
```

---

### Task 3: Extract packages/ui and rewrite every consumer import

**Goal:** Move the 12 shadcn primitives, `hooks/use-mobile.tsx`, and `lib/utils.ts`'s `cn()` into `packages/ui/src` verbatim, fix their now-broken internal cross-imports, and mechanically rewrite every `@/components/ui/*` / `@/lib/utils` / `@/hooks/use-mobile` import across `apps/web` to `@repo/ui/...`.

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`
- Move (`git mv`): `apps/web/components/ui/{avatar,button,card,dropdown-menu,input,label,radio-group,separator,sheet,sidebar,skeleton,tooltip}.tsx` -> `packages/ui/src/components/*.tsx`; `apps/web/hooks/use-mobile.tsx` -> `packages/ui/src/hooks/use-mobile.tsx`; `apps/web/lib/utils.ts` -> `packages/ui/src/lib/utils.ts`; `apps/web/components.json` -> `packages/ui/components.json`
- Modify: all 12 moved component files (internal import fix-up), `packages/ui/components.json`, `apps/web/package.json` (add `@repo/ui` dependency), and every external consumer listed below
- Test: `apps/web/tests/unit/button.test.tsx`, `apps/web/tests/unit/utils.test.ts` (pre-existing Phase-1 tests — no new test code needed; they double as the functional proof the rewrite didn't break anything)

**External consumers to rewrite** (all paths relative to `apps/web/`, confirmed by a full-repo grep against the real checkout — exactly 29 files):
```
components/logo.tsx
components/workflow/WorkflowHistoryDrawer.tsx
app/(front)/pricing/submit-button.tsx
components/app-sidebar.tsx
app/(front)/pricing/page.tsx
components/subscription-status.tsx
components/nav-user.tsx
app/(front)/page.tsx
components/nav-main.tsx
app/(front)/layout.tsx
components/landing-page/hero/hero.tsx
app/(dashboard)/dashboard/settings.tsx
components/landing-page/footer/footer.tsx
components/landing-page/timeline/components/particles.tsx
components/landing-page/timeline/components/glowing-effect.tsx
app/(dashboard)/dashboard/security/page.tsx
components/landing-page/hero/components/sparkles-text.tsx
app/(dashboard)/dashboard/layout.tsx
app/(dashboard)/dashboard/activity/page.tsx
app/(dashboard)/dashboard/general/page.tsx
app/(login)/login.tsx
components/landing-page/timeline/components/display-cards.tsx
components/landing-page/hero/components/confetti.tsx
app/(dashboard)/dashboard/invite-team.tsx
components/landing-page/hero/components/glow-effect.tsx
components/landing-page/hero/components/animated-gradient-text.tsx
components/landing-page/timeline/components/glowing-effect-demo.tsx
tests/unit/button.test.tsx
tests/unit/utils.test.ts
```

**Acceptance Criteria:**
- [ ] All 12 primitives + `use-mobile.tsx` + `utils.ts` live under `packages/ui/src`, moved with `git mv` (history preserved)
- [ ] `packages/ui/src` contains zero remaining `@/...` alias imports (`sidebar.tsx`'s 8 internal imports — the `use-mobile` hook, `cn()`, and 6 sibling components — are now relative)
- [ ] `apps/web/{app,components,tests}` contain zero remaining `@/components/ui/*`, `@/lib/utils`, or `@/hooks/use-mobile` imports
- [ ] `apps/web/package.json` depends on `"@repo/ui": "workspace:*"`
- [ ] `pnpm --filter web test` passes, including the rewritten `button.test.tsx` (imports `@repo/ui/components/button`) and `utils.test.ts` (imports `@repo/ui/lib/utils`)
- [ ] `pnpm --filter @repo/ui exec tsc --noEmit` passes standalone

**Verify:** `grep -rn "@/components/ui/\|@/lib/utils\|@/hooks/use-mobile" apps/web/app apps/web/components apps/web/tests; echo "exit:$?"` -> no output, `exit:1` (grep found nothing)

**Steps:**

- [ ] **Step 1: Write the failing test**
```bash
grep -rn "@/components/ui/\|@/lib/utils\|@/hooks/use-mobile" apps/web/app apps/web/components apps/web/tests
```

- [ ] **Step 2: Run test to verify it fails**
Run: `grep -rln "@/components/ui/\|@/lib/utils\|@/hooks/use-mobile" apps/web/app apps/web/components apps/web/tests | wc -l`
Expected: FAIL — prints `29` (all 29 consumer files still on the old alias)

- [ ] **Step 3: Write minimal implementation**

Scaffold and move (from repo root):
```bash
mkdir -p packages/ui/src/components packages/ui/src/hooks packages/ui/src/lib

git mv apps/web/components/ui/avatar.tsx packages/ui/src/components/avatar.tsx
git mv apps/web/components/ui/button.tsx packages/ui/src/components/button.tsx
git mv apps/web/components/ui/card.tsx packages/ui/src/components/card.tsx
git mv apps/web/components/ui/dropdown-menu.tsx packages/ui/src/components/dropdown-menu.tsx
git mv apps/web/components/ui/input.tsx packages/ui/src/components/input.tsx
git mv apps/web/components/ui/label.tsx packages/ui/src/components/label.tsx
git mv apps/web/components/ui/radio-group.tsx packages/ui/src/components/radio-group.tsx
git mv apps/web/components/ui/separator.tsx packages/ui/src/components/separator.tsx
git mv apps/web/components/ui/sheet.tsx packages/ui/src/components/sheet.tsx
git mv apps/web/components/ui/sidebar.tsx packages/ui/src/components/sidebar.tsx
git mv apps/web/components/ui/skeleton.tsx packages/ui/src/components/skeleton.tsx
git mv apps/web/components/ui/tooltip.tsx packages/ui/src/components/tooltip.tsx
git mv apps/web/hooks/use-mobile.tsx packages/ui/src/hooks/use-mobile.tsx
git mv apps/web/lib/utils.ts packages/ui/src/lib/utils.ts
git mv apps/web/components.json packages/ui/components.json

rmdir apps/web/components/ui
rmdir apps/web/hooks
```

Fix internal imports inside the 11 simple components (each imports only `cn` from `@/lib/utils` — confirmed by reading every file: `avatar`, `button`, `card`, `dropdown-menu`, `input`, `label`, `radio-group`, `separator`, `sheet`, `skeleton`, `tooltip`):
```bash
for f in avatar button card dropdown-menu input label radio-group separator sheet skeleton tooltip; do
  sed -i 's#"@/lib/utils"#"../lib/utils"#' "packages/ui/src/components/$f.tsx"
done
```

Fix `sidebar.tsx`'s 8 internal imports (hook + util + 6 sibling components — confirmed by reading the file's import block):
```bash
sed -i \
  -e 's#"@/hooks/use-mobile"#"../hooks/use-mobile"#' \
  -e 's#"@/lib/utils"#"../lib/utils"#' \
  -e 's#"@/components/ui/button"#"./button"#' \
  -e 's#"@/components/ui/input"#"./input"#' \
  -e 's#"@/components/ui/separator"#"./separator"#' \
  -e 's#"@/components/ui/sheet"#"./sheet"#' \
  -e 's#"@/components/ui/skeleton"#"./skeleton"#' \
  -e 's#"@/components/ui/tooltip"#"./tooltip"#' \
  packages/ui/src/components/sidebar.tsx
```

Create `packages/ui/package.json`:
```json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./components/*": "./src/components/*.tsx",
    "./hooks/*": "./src/hooks/*.tsx",
    "./lib/utils": "./src/lib/utils.ts"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.24.0",
    "radix-ui": "^1.6.2",
    "tailwind-merge": "^3.6.0"
  },
  "peerDependencies": {
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  },
  "devDependencies": {
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "typescript": "^5.9.3"
  }
}
```

Create `packages/ui/tsconfig.json` (standalone for now — `packages/config`'s shared base doesn't exist until Task 4):
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "react-jsx",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules"]
}
```

Rewrite `packages/ui/components.json` (aliases now point at the package's own source; the app no longer owns shadcn generation for these primitives — `baseColor` stays `"slate"`, matching the app's actual palette, confirmed against the real `components.json`/`app/globals.css`, not the `"zinc"` value a stale intermediate state once had):
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "../../apps/web/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@repo/ui/components",
    "utils": "@repo/ui/lib/utils",
    "ui": "@repo/ui/components",
    "lib": "@repo/ui/lib",
    "hooks": "@repo/ui/hooks"
  },
  "iconLibrary": "lucide"
}
```

Rewrite every external consumer (run from repo root):
```bash
files=(
  "components/logo.tsx"
  "components/workflow/WorkflowHistoryDrawer.tsx"
  "app/(front)/pricing/submit-button.tsx"
  "components/app-sidebar.tsx"
  "app/(front)/pricing/page.tsx"
  "components/subscription-status.tsx"
  "components/nav-user.tsx"
  "app/(front)/page.tsx"
  "components/nav-main.tsx"
  "app/(front)/layout.tsx"
  "components/landing-page/hero/hero.tsx"
  "app/(dashboard)/dashboard/settings.tsx"
  "components/landing-page/footer/footer.tsx"
  "components/landing-page/timeline/components/particles.tsx"
  "components/landing-page/timeline/components/glowing-effect.tsx"
  "app/(dashboard)/dashboard/security/page.tsx"
  "components/landing-page/hero/components/sparkles-text.tsx"
  "app/(dashboard)/dashboard/layout.tsx"
  "app/(dashboard)/dashboard/activity/page.tsx"
  "app/(dashboard)/dashboard/general/page.tsx"
  "app/(login)/login.tsx"
  "components/landing-page/timeline/components/display-cards.tsx"
  "components/landing-page/hero/components/confetti.tsx"
  "app/(dashboard)/dashboard/invite-team.tsx"
  "components/landing-page/hero/components/glow-effect.tsx"
  "components/landing-page/hero/components/animated-gradient-text.tsx"
  "components/landing-page/timeline/components/glowing-effect-demo.tsx"
  "tests/unit/button.test.tsx"
  "tests/unit/utils.test.ts"
)

for f in "${files[@]}"; do
  sed -i \
    -e "s#@/components/ui/\([a-z-]*\)#@repo/ui/components/\1#g" \
    -e "s#@/lib/utils#@repo/ui/lib/utils#g" \
    "apps/web/$f"
done
```

Add the workspace dependency to `apps/web/package.json`:
```diff
   "dependencies": {
+    "@repo/ui": "workspace:*",
     "@tailwindcss/postcss": "4.3.2",
```

Link everything:
```bash
pnpm install
```

- [ ] **Step 4: Run test to verify it passes**
Run:
```bash
grep -rln "@/components/ui/\|@/lib/utils\|@/hooks/use-mobile" apps/web/app apps/web/components apps/web/tests | wc -l
grep -rln "@/" packages/ui/src | wc -l
pnpm --filter web test
pnpm --filter @repo/ui exec tsc --noEmit
```
Expected: PASS — both `wc -l` counts print `0`; `pnpm --filter web test` is green including the rewritten `button.test.tsx`/`utils.test.ts`; `tsc --noEmit` for `@repo/ui` reports no errors. (A full `pnpm --filter web build` is **not** expected to pass yet — `next build` won't transpile `@repo/ui`'s raw `.tsx` until Task 6 adds `transpilePackages`.)

- [ ] **Step 5: Commit**
```bash
git add packages/ui apps/web/package.json apps/web/app apps/web/components apps/web/tests pnpm-lock.yaml
git commit -m "Extract packages/ui and rewrite every @/components/ui, @/lib/utils, @/hooks/use-mobile import to @repo/ui"
```

---

### Task 4: packages/config — tsconfig splits + minimal ESLint config

**Goal:** Create `packages/config` with `typescript/{base,nextjs,react-library}.json` and a net-new shared ESLint base config; retrofit `apps/web` and `packages/ui` to extend them instead of each declaring compiler/lint options from scratch.

**Files:**
- Create: `packages/config/package.json`, `packages/config/typescript/base.json`, `packages/config/typescript/nextjs.json`, `packages/config/typescript/react-library.json`, `packages/config/eslint/base.mjs`, `packages/ui/eslint.config.mjs`
- Modify: `apps/web/tsconfig.json`, `packages/ui/tsconfig.json`, `apps/web/eslint.config.mjs`, `apps/web/package.json` (add `@repo/config` devDependency + `lint` script), `packages/ui/package.json` (add `@repo/config` devDependency + `lint` script)
- Test: N/A — mechanical config refactor; verified via `tsc --noEmit` and `eslint` running clean per Step 2/4

**Acceptance Criteria:**
- [ ] `packages/config/typescript/base.json` holds the shareable compiler options (target/lib/module/moduleResolution/strict/etc.) with no path-mapping fields
- [ ] `apps/web/tsconfig.json` extends `@repo/config/typescript/nextjs.json`, keeping only its own `baseUrl`/`paths`/`plugins`/`include` locally (path-mapping fields must stay in the extending file — TS resolves relative `extends` paths against the file that declares them)
- [ ] `packages/ui/tsconfig.json` extends `@repo/config/typescript/react-library.json`
- [ ] `apps/web/eslint.config.mjs` and the new `packages/ui/eslint.config.mjs` both spread `@repo/config/eslint/base`
- [ ] `pnpm --filter web exec tsc --noEmit` and `pnpm --filter @repo/ui exec tsc --noEmit` both pass
- [ ] `pnpm --filter web lint` and `pnpm --filter @repo/ui lint` both run without a config-resolution error

**Verify:** `pnpm --filter web exec tsc --noEmit && pnpm --filter @repo/ui exec tsc --noEmit && pnpm --filter web lint && pnpm --filter @repo/ui lint` -> all four exit 0

**Steps:**

- [ ] **Step 1: Write the failing test**
```bash
test -f packages/config/typescript/base.json && grep -q "@repo/config" apps/web/tsconfig.json
```

- [ ] **Step 2: Run test to verify it fails**
Run: `test -f packages/config/typescript/base.json; echo "exit:$?"`
Expected: FAIL with `exit:1` (`packages/config` doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `packages/config/package.json`:
```json
{
  "name": "@repo/config",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./typescript/*": "./typescript/*.json",
    "./eslint/*": "./eslint/*.mjs",
    "./tailwind/*": "./tailwind/*.css"
  },
  "dependencies": {
    "@eslint/js": "^9.39.5"
  }
}
```

Create `packages/config/typescript/base.json`:
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "allowJs": true,
    "incremental": true
  },
  "exclude": ["node_modules"]
}
```

Create `packages/config/typescript/nextjs.json`:
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

Create `packages/config/typescript/react-library.json`:
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "declaration": false
  }
}
```

Create `packages/config/eslint/base.mjs`:
```javascript
import js from '@eslint/js';

const baseConfig = [
  js.configs.recommended,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
    ],
  },
];

export default baseConfig;
```

Rewrite `apps/web/tsconfig.json` to extend the shared Next.js config (path-mapping fields stay local — `extends` resolves relative paths against the file that declares them, so `baseUrl`/`paths` cannot live in the shared file):
```json
{
  "extends": "@repo/config/typescript/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    },
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

Rewrite `packages/ui/tsconfig.json` to extend the shared react-library config:
```json
{
  "extends": "@repo/config/typescript/react-library.json",
  "compilerOptions": {
    "baseUrl": "."
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules"]
}
```

Rewrite `apps/web/eslint.config.mjs`:
```javascript
import baseConfig from '@repo/config/eslint/base';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...baseConfig,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },
];

export default eslintConfig;
```

Create `packages/ui/eslint.config.mjs`:
```javascript
import baseConfig from '@repo/config/eslint/base';

export default [...baseConfig];
```

Add devDependencies + `lint` scripts:
```diff
--- apps/web/package.json
   "scripts": {
     "dev": "next dev --webpack",
     "build": "next build --webpack",
     "start": "next start",
+    "lint": "eslint .",
     "db:setup": "npx tsx lib/db/setup.ts",
@@
   "devDependencies": {
+    "@repo/config": "workspace:*",
     "@playwright/test": "^1.61.1",
```

```diff
--- packages/ui/package.json
   "devDependencies": {
+    "@repo/config": "workspace:*",
     "@types/react": "19.2.17",
```

Add a matching `lint` script to `packages/ui/package.json`:
```diff
   "name": "@repo/ui",
   "version": "0.0.0",
   "private": true,
+  "scripts": {
+    "lint": "eslint ."
+  },
   "exports": {
```

Link everything:
```bash
pnpm install
```

- [ ] **Step 4: Run test to verify it passes**
Run:
```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter @repo/ui exec tsc --noEmit
pnpm --filter web lint
pnpm --filter @repo/ui lint
```
Expected: PASS — all four commands exit 0.

- [ ] **Step 5: Commit**
```bash
git add packages/config packages/ui/tsconfig.json packages/ui/eslint.config.mjs packages/ui/package.json apps/web/tsconfig.json apps/web/eslint.config.mjs apps/web/package.json pnpm-lock.yaml
git commit -m "Add packages/config (shared tsconfig splits + minimal ESLint base) and wire apps/web and packages/ui to extend it"
```

---

### Task 5: packages/config — Tailwind CSS token extraction

**Goal:** Extract the current `app/globals.css`'s `@theme inline`/`:root`/`.dark` token block into `packages/config/tailwind/shared-theme.css` verbatim, so `apps/web` and `packages/ui` share one token source. **Corrected against the real repo:** an earlier pass (recorded in the source research for this task) assumed `app/globals.css` still had two competing token blocks (a stale, unwrapped-HSL, zinc-hued block plus a newer `hsl()`-wrapped one) needing de-duplication. That duplication genuinely existed at one point during Phase 1, but it was already found and fixed as part of Phase 1's own review before merging to `main` (commits `1320229`, `9c25439`, `c9d970a`) — `app/globals.css` today is already a single, clean, 164-line file with one token block on the app's actual slate-hued palette and `--radius: 0.5rem`. This task is a pure extraction of that already-correct block, not a de-duplication.

**Files:**
- Create: `packages/config/tailwind/shared-theme.css`
- Modify: `apps/web/app/globals.css`
- Test: N/A — CSS extraction; verified via the grep/line-count checks in Step 2/4 (full production-build proof lands in Task 6, once `transpilePackages` lets Next's bundler process `@repo/ui`'s JSX at all)

**Acceptance Criteria:**
- [ ] `apps/web/app/globals.css` shrinks to exactly 4 lines: the `tailwindcss` import, the `@repo/config/tailwind/shared-theme.css` import, the `tailwindcss-animate` plugin declaration, and the `@source` line pointing at `packages/ui/src`
- [ ] `packages/config/tailwind/shared-theme.css` contains the full token set moved verbatim from the current `app/globals.css`: the `@custom-variant`/`@variant dark` declarations, the border-color compatibility layer, the Manrope `@layer utilities` font rule, the `:root`/`.dark` blocks (slate palette, `--radius: 0.5rem`), and the closing `@theme inline` block plus the final `@layer base` rule
- [ ] No token value changes anywhere — `--radius` stays `0.5rem`, `--foreground`/`--primary`/etc. stay on their current slate-derived hues (`222.2`/`210`/`214.3`-based), not shifted to any other palette
- [ ] The border-color compatibility layer and the Manrope `@layer utilities` font rule are preserved (not dropped in the move)

**Verify:** `wc -l < apps/web/app/globals.css` -> `4`; `grep -c "radius: 0.5rem" packages/config/tailwind/shared-theme.css` -> `1`; `grep -c "radius: 0.5rem" apps/web/app/globals.css` -> `0`

**Steps:**

- [ ] **Step 1: Write the failing test**
```bash
test -f packages/config/tailwind/shared-theme.css
```

- [ ] **Step 2: Run test to verify it fails**
Run: `test -f packages/config/tailwind/shared-theme.css; echo "exit:$?"`
Expected: FAIL with `exit:1` (doesn't exist yet — the token block still lives only in `apps/web/app/globals.css`)

- [ ] **Step 3: Write minimal implementation**

Create `packages/config/tailwind/shared-theme.css` (the exact current token block, moved verbatim from `apps/web/app/globals.css`):
```css
@custom-variant dark (&:is(.dark *));

@variant dark (&:is(.dark *));

/*
  The default border color has changed to `currentColor` in Tailwind CSS v4,
  so we've added these compatibility styles to make sure everything still
  looks the same as it did with Tailwind CSS v3.

  If we ever want to remove these styles, we need to add an explicit border
  color utility to any element that depends on these defaults.
*/
@layer base {
  *,
  ::after,
  ::before,
  ::backdrop,
  ::file-selector-button {
    border-color: var(--color-gray-200, currentColor);
  }
}

@layer utilities {
  body {
    font-family: 'Manrope', Arial, Helvetica, sans-serif;
  }
}

:root {
  --background: hsl(0 0% 100%);
  --foreground: hsl(222.2 84% 4.9%);
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(222.2 84% 4.9%);
  --popover: hsl(0 0% 100%);
  --popover-foreground: hsl(222.2 84% 4.9%);
  --primary: hsl(222.2 47.4% 11.2%);
  --primary-foreground: hsl(210 40% 98%);
  --secondary: hsl(210 40% 96.1%);
  --secondary-foreground: hsl(222.2 47.4% 11.2%);
  --muted: hsl(210 40% 96.1%);
  --muted-foreground: hsl(215.4 16.3% 46.9%);
  --accent: hsl(210 40% 96.1%);
  --accent-foreground: hsl(222.2 47.4% 11.2%);
  --destructive: hsl(0 84.2% 60.2%);
  --destructive-foreground: hsl(210 40% 98%);
  --border: hsl(214.3 31.8% 91.4%);
  --input: hsl(214.3 31.8% 91.4%);
  --ring: hsl(222.2 84% 4.9%);
  --chart-1: hsl(12 76% 61%);
  --chart-2: hsl(173 58% 39%);
  --chart-3: hsl(197 37% 24%);
  --chart-4: hsl(43 74% 66%);
  --chart-5: hsl(27 87% 67%);
  --radius: 0.5rem;
  --sidebar: hsl(0 0% 98%);
  --sidebar-foreground: hsl(240 5.3% 26.1%);
  --sidebar-primary: hsl(240 5.9% 10%);
  --sidebar-primary-foreground: hsl(0 0% 98%);
  --sidebar-accent: hsl(240 4.8% 95.9%);
  --sidebar-accent-foreground: hsl(240 5.9% 10%);
  --sidebar-border: hsl(220 13% 91%);
  --sidebar-ring: hsl(217.2 91.2% 59.8%);
}

.dark {
  --background: hsl(222.2 84% 4.9%);
  --foreground: hsl(210 40% 98%);
  --card: hsl(222.2 84% 4.9%);
  --card-foreground: hsl(210 40% 98%);
  --popover: hsl(222.2 84% 4.9%);
  --popover-foreground: hsl(210 40% 98%);
  --primary: hsl(210 40% 98%);
  --primary-foreground: hsl(222.2 47.4% 11.2%);
  --secondary: hsl(217.2 32.6% 17.5%);
  --secondary-foreground: hsl(210 40% 98%);
  --muted: hsl(217.2 32.6% 17.5%);
  --muted-foreground: hsl(215 20.2% 65.1%);
  --accent: hsl(217.2 32.6% 17.5%);
  --accent-foreground: hsl(210 40% 98%);
  --destructive: hsl(0 62.8% 30.6%);
  --destructive-foreground: hsl(210 40% 98%);
  --border: hsl(217.2 32.6% 17.5%);
  --input: hsl(217.2 32.6% 17.5%);
  --ring: hsl(212.7 26.8% 83.9%);
  --chart-1: hsl(220 70% 50%);
  --chart-2: hsl(160 60% 45%);
  --chart-3: hsl(30 80% 55%);
  --chart-4: hsl(280 65% 60%);
  --chart-5: hsl(340 75% 55%);
  --sidebar: hsl(240 5.9% 10%);
  --sidebar-foreground: hsl(240 4.8% 95.9%);
  --sidebar-primary: hsl(224.3 76.3% 48%);
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent: hsl(240 3.7% 15.9%);
  --sidebar-accent-foreground: hsl(240 4.8% 95.9%);
  --sidebar-border: hsl(240 3.7% 15.9%);
  --sidebar-ring: hsl(217.2 91.2% 59.8%);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

Replace `apps/web/app/globals.css` in full:
```css
@import 'tailwindcss';
@import '@repo/config/tailwind/shared-theme.css';
@plugin 'tailwindcss-animate';
@source '../../packages/ui/src';
```

- [ ] **Step 4: Run test to verify it passes**
Run:
```bash
wc -l < apps/web/app/globals.css
grep -c "radius: 0.5rem" packages/config/tailwind/shared-theme.css
grep -c "radius: 0.5rem" apps/web/app/globals.css
grep -c "^@theme" apps/web/app/globals.css
grep -c "^@theme" packages/config/tailwind/shared-theme.css
```
Expected: PASS — prints `4`, `1`, `0`, `0`, `1` respectively.

- [ ] **Step 5: Commit**
```bash
git add packages/config/tailwind apps/web/app/globals.css
git commit -m "Extract the Tailwind theme token block into packages/config/tailwind/shared-theme.css"
```

---

### Task 6: next.config.ts transpilePackages + Vercel Root Directory

**Goal:** Make Next's bundler actually able to consume `@repo/ui`'s raw, unbuilt `.tsx` source via `transpilePackages`, run the first true end-to-end production build of the whole packages/ui + packages/config chain, and document the Vercel Root Directory / monorepo-detection change as the user's own manual deploy-verification step (no Vercel/Stripe access available here).

**Files:**
- Modify: `apps/web/next.config.ts`
- Test: N/A — config change; verified via a real `next build`, since `transpilePackages` is purely a bundler concern that `tsc`/ESLint can't catch

**Acceptance Criteria:**
- [ ] `apps/web/next.config.ts` adds `transpilePackages: ['@repo/ui']` alongside the existing `turbopack.root` setting
- [ ] `pnpm --filter web build` succeeds — this is the first point in the sequence where a full production build of the whole `packages/ui` + `packages/config` + `apps/web` chain is expected to pass
- [ ] The Vercel Root Directory change is documented as a manual step, not claimed as verified here

**Verify:** `pnpm install && pnpm --filter web build` -> Next.js production build completes with no "Module parse failed" / unresolved-JSX errors from `@repo/ui`

**Steps:**

- [ ] **Step 1: Write the failing test**
```bash
grep -q "transpilePackages" apps/web/next.config.ts
```

- [ ] **Step 2: Run test to verify it fails**
Run: `grep -q "transpilePackages" apps/web/next.config.ts; echo "exit:$?"`
Expected: FAIL with `exit:1` (not present yet)

- [ ] **Step 3: Write minimal implementation**

Rewrite `apps/web/next.config.ts`:
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/ui'],
  turbopack: {
    root: __dirname
  }
};

export default nextConfig;
```

(`@repo/db` and `@repo/email` are intentionally not added yet — they aren't extracted yet at this point in the plan; Task 7 appends `@repo/db` and Task 12 appends `@repo/email` once those packages exist.)

- [ ] **Step 4: Run test to verify it passes**
Run:
```bash
grep -q "transpilePackages" apps/web/next.config.ts; echo "exit:$?"
pnpm install
pnpm --filter web build
```
Expected: PASS — `exit:0`, and the production build completes cleanly, resolving `@repo/ui/components/*`, `@repo/ui/lib/utils`, and rendering the shared theme tokens with nothing purged.

- [ ] **Step 5: Commit**
```bash
git add apps/web/next.config.ts pnpm-lock.yaml
git commit -m "Add transpilePackages for @repo/ui so Next can bundle the unbuilt workspace package"
```

**Manual verification — the user's own step (no Vercel/deploy access available in this environment):**
1. In the Vercel dashboard, go to the project's Settings → General → Root Directory and set it to `apps/web`; enable "Include source files outside of the Root Directory in the Build Step" so the sibling `packages/*`, root `pnpm-workspace.yaml`, `turbo.json`, and `pnpm-lock.yaml` are included in the build context.
2. Leave the Install Command on its default — Vercel detects `packageManager` in the new root `package.json` and runs `pnpm install` at the workspace root automatically.
3. Leave the Build Command on its default (`next build`, run from Root Directory); if a custom Build Command was previously configured, update it to a pnpm/workspace-aware command (e.g. `cd ../.. && pnpm turbo run build --filter=web`) instead of a hardcoded `npm run build`.
4. Push this branch and trigger an actual preview deploy; confirm it succeeds before merging to `main`/`develop`. This step cannot be executed or confirmed from here — it is flagged explicitly as the user's own manual verification.

---

### Task 7: Extract packages/db — schema, client, tiers, utils

**Goal:** Stand up the `@repo/db` package and move the four data-layer files that have no `next/headers` dependency (`schema.ts`, `drizzle.ts`→`client.ts`, `tiers.ts`, `utils.ts`) into it verbatim (module-path fixes only), leaving `queries.ts` and the scripts behind for Tasks 9–10.

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Modify: `packages/db/src/schema.ts` (moved from `lib/db/schema.ts`, no content change)
- Modify: `packages/db/src/client.ts` (moved from `lib/db/drizzle.ts`, `.env` resolution fixed)
- Modify: `packages/db/src/tiers.ts` (moved from `lib/tiers.ts`, no content change)
- Modify: `packages/db/src/utils.ts` (moved from `lib/db/utils.ts`, sibling-import fix)
- Modify: `apps/web/package.json` (+`@repo/db`, −`postgres`, −`dotenv`)
- Modify: `apps/web/next.config.ts` (`transpilePackages` +`'@repo/db'`)
- Test: `apps/web/tests/unit/tiers-limit.test.ts`

**Acceptance Criteria:**
- [ ] `packages/db` resolves as a pnpm workspace member and exports `./schema`, `./client`, `./tiers`, `./utils`
- [ ] `lib/db/schema.ts`, `lib/db/drizzle.ts`, `lib/tiers.ts`, `lib/db/utils.ts` no longer exist under `apps/web`
- [ ] `tests/unit/tiers-limit.test.ts` passes against the relocated files with no changes to its assertions, only its imports

**Verify:** `pnpm --filter web exec vitest run tests/unit/tiers-limit.test.ts` -> `4 passed` (requires `POSTGRES_URL` pointed at a reachable scratch Postgres — same precondition Phase 1 used for drizzle bumps)

**Steps:**

- [ ] **Step 1: Point the existing test at the not-yet-created package (red)**

```ts
// apps/web/tests/unit/tiers-limit.test.ts — change only these three import lines,
// leave every describe/it block in the file exactly as-is
import { db } from '@repo/db/client';
import { teams } from '@repo/db/schema';
import { checkMessageLimit, incrementMessageCount } from '@repo/db/utils';
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web exec vitest run tests/unit/tiers-limit.test.ts`
Expected: FAIL with `Failed to resolve import "@repo/db/client"` (or `Cannot find package '@repo/db'`)

- [ ] **Step 3: Create the package and move the files**

```bash
mkdir -p packages/db/src
git mv apps/web/lib/db/schema.ts packages/db/src/schema.ts
git mv apps/web/lib/db/drizzle.ts packages/db/src/client.ts
git mv apps/web/lib/tiers.ts packages/db/src/tiers.ts
git mv apps/web/lib/db/utils.ts packages/db/src/utils.ts
```

```json
// packages/db/package.json
{
  "name": "@repo/db",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./schema": "./src/schema.ts",
    "./client": "./src/client.ts",
    "./tiers": "./src/tiers.ts",
    "./utils": "./src/utils.ts"
  },
  "dependencies": {
    "dotenv": "^16.6.1",
    "drizzle-orm": "^0.45.2",
    "postgres": "^3.4.9"
  },
  "devDependencies": {
    "@repo/config": "workspace:*",
    "@types/node": "^22.13.1",
    "typescript": "^5.9.3"
  }
}
```

```json
// packages/db/tsconfig.json
{
  "extends": "@repo/config/typescript/base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

```ts
// packages/db/src/client.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'node:path';
import * as schema from './schema';

// Loads apps/web/.env for direct/CLI usage (drizzle-kit, scripts/*.ts run via
// tsx from this package). When this module is imported through Next.js
// (apps/web), Next has already populated process.env from apps/web/.env(.local)
// before any app code runs, so this call is a no-op there — dotenv never
// overwrites a variable that's already set.
dotenv.config({ path: path.resolve(__dirname, '../../../apps/web/.env'), quiet: true });

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

export const client = postgres(process.env.POSTGRES_URL);
export const db = drizzle(client, { schema });
```

```ts
// packages/db/src/utils.ts — only these two import lines change
import { db } from './client';
import { teams, Team } from './schema';
import { eq, sql, desc } from 'drizzle-orm';
import { tiers, Tier } from './tiers';
import { workflowHistory, NewWorkflowHistory } from './schema';
// ...(checkMessageLimit / incrementMessageCount / saveWorkflowHistory / getWorkflowHistory bodies unchanged)
```

```ts
// apps/web/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/ui', '@repo/db'],
  turbopack: {
    root: __dirname
  }
};

export default nextConfig;
```

```json
// apps/web/package.json — remove "postgres" and "dotenv" from "dependencies",
// add "@repo/db": "workspace:*" (postgres/dotenv are now used only inside
// packages/db/src/client.ts; nothing in apps/web imports them directly)
"@repo/db": "workspace:*",
```

```bash
pnpm install
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web exec vitest run tests/unit/tiers-limit.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**
```bash
git add packages/db apps/web/package.json apps/web/next.config.ts apps/web/tests/unit/tiers-limit.test.ts pnpm-lock.yaml
git commit -m "Extract packages/db: schema, client, tiers, utils"
```

---

### Task 8: Extract packages/db — migrations and drizzle.config.ts

**Goal:** Relocate the Drizzle migration history and CLI config so `drizzle-kit generate`/`migrate`/`studio` run from `packages/db` against the same 3 existing migrations, with the schema/out paths and `.env` re-pointed to the new layout.

**Files:**
- Modify: `packages/db/migrations/0000_soft_the_anarchist.sql` (moved verbatim)
- Modify: `packages/db/migrations/0001_amused_umar.sql` (moved verbatim)
- Modify: `packages/db/migrations/0002_short_roxanne_simpson.sql` (moved verbatim)
- Modify: `packages/db/migrations/meta/0000_snapshot.json`, `0001_snapshot.json`, `0002_snapshot.json`, `_journal.json` (moved verbatim)
- Create: `packages/db/drizzle.config.ts`
- Modify: `packages/db/tsconfig.json` (widen `include` to also cover `drizzle.config.ts`)
- Modify: `packages/db/package.json` (+`drizzle-kit` devDep, +`db:generate`/`db:migrate`/`db:studio` scripts)
- Modify: `apps/web/package.json` (−`drizzle-kit`)
- Modify: root `package.json` (+`db:studio` script — `db:generate`/`db:migrate` pass-throughs already exist from Task 2)
- Test: (none — this task is CLI-config-only; verified via drizzle-kit itself against a scratch Postgres, per the Verify step)

**Acceptance Criteria:**
- [ ] `packages/db/drizzle.config.ts` resolves `schema`/`out` relative to `packages/db`, not the old repo root
- [ ] `pnpm --filter @repo/db run db:migrate` applies all 3 existing migrations cleanly to a fresh scratch database
- [ ] `pnpm --filter @repo/db run db:generate` reports no pending schema diff afterward
- [ ] `turbo.json`'s existing `db:generate`/`db:migrate` tasks (created in Task 1) are **not** re-declared here — only the net-new `db:studio` script is added, and only to `packages/db/package.json` and root `package.json` (drizzle studio is an interactive, single-package command, deliberately run via a direct `pnpm --filter` call rather than through turbo)

**Verify:** `pnpm --filter @repo/db run db:migrate` -> `3` migrations applied with no errors, then `pnpm --filter @repo/db run db:generate` -> `No schema changes, nothing to migrate 😴`

**Steps:**

- [ ] **Step 1: Run the current (root-anchored) config against a fresh scratch DB to establish the baseline (red for the new location)**
Run: `pnpm --filter @repo/db run db:migrate` (script not yet defined)
Expected: FAIL with `ERR_PNPM_NO_SCRIPT` (or `Missing script: "db:migrate"`) — the command doesn't exist yet at this location

- [ ] **Step 2: Confirm failure**
Run: `pnpm --filter @repo/db run db:migrate`
Expected: FAIL, `Missing script: "db:migrate"`

- [ ] **Step 3: Move migrations, add config**

```bash
git mv apps/web/lib/db/migrations packages/db/migrations
```

```ts
// packages/db/drizzle.config.ts
import type { Config } from 'drizzle-kit';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../../apps/web/.env'), quiet: true });

export default {
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
} satisfies Config;
```

```json
// packages/db/tsconfig.json — widen "include" now that drizzle.config.ts exists
{
  "extends": "@repo/config/typescript/base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "drizzle.config.ts"]
}
```

```json
// packages/db/package.json — add to "scripts" and "devDependencies"
"scripts": {
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio"
},
"devDependencies": {
  "@repo/config": "workspace:*",
  "@types/node": "^22.13.1",
  "drizzle-kit": "^0.31.10",
  "typescript": "^5.9.3"
}
```

```json
// apps/web/package.json — remove "drizzle-kit" from "devDependencies"
// (its only use was the root-level db:generate/db:migrate/db:studio scripts,
// which now live in packages/db)
```

```json
// root package.json — add "db:studio" to the existing "scripts" object
// (db:generate/db:migrate already exist from Task 2 as "turbo run db:generate"/
// "turbo run db:migrate" — turbo's task graph will now find packages/db's
// matching scripts and run them; nothing to change there)
"db:studio": "pnpm --filter @repo/db run db:studio"
```

```bash
pnpm install
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter @repo/db run db:migrate`
Expected: PASS — all 3 migrations applied to the scratch database
Run: `pnpm --filter @repo/db run db:generate`
Expected: PASS — `No schema changes, nothing to migrate 😴`

- [ ] **Step 5: Commit**
```bash
git add packages/db/migrations packages/db/drizzle.config.ts packages/db/tsconfig.json packages/db/package.json apps/web/package.json package.json pnpm-lock.yaml
git commit -m "Extract packages/db: migrations and drizzle.config.ts"
```

---

### Task 9: Extract packages/db — seed/setup scripts, decoupled from apps/web

**Goal:** Move `seed.ts`, `seed-test.ts`, and `setup.ts` into `packages/db/scripts/`, replacing their imports of `apps/web/lib/payments/stripe` and `apps/web/lib/auth/session` with self-contained equivalents so the package has zero dependency on the app that consumes it, and fixing `setup.ts`'s output paths (`.env`, `docker-compose.yml`) to land at the repo root / `apps/web` instead of wherever the script happens to run from.

**Files:**
- Modify: `packages/db/scripts/seed.ts` (moved from `apps/web/lib/db/seed.ts`)
- Modify: `packages/db/scripts/seed-test.ts` (moved from `apps/web/lib/db/seed-test.ts`)
- Modify: `packages/db/scripts/setup.ts` (moved from `apps/web/lib/db/setup.ts`)
- Modify: `packages/db/tsconfig.json` (widen `include` to also cover `scripts/**/*.ts`)
- Modify: `packages/db/package.json` (+`bcryptjs`/`stripe` deps, +`@types/bcryptjs`/`tsx` devDeps, +`db:seed`/`db:seed:test`/`db:setup` scripts)
- Modify: root `package.json` (+`db:seed`/`db:seed:test`/`db:setup` pass-throughs)
- Test: (none — imperative scripts against a real DB/Stripe; verified via direct CLI run, per the Verify step)

**Acceptance Criteria:**
- [ ] `packages/db/scripts/seed.ts` constructs its own `Stripe` client inline instead of importing `apps/web/lib/payments/stripe`
- [ ] `packages/db/scripts/seed.ts` and `seed-test.ts` hash passwords with a local `bcryptjs` call instead of importing `apps/web/lib/auth/session`
- [ ] `packages/db/scripts/setup.ts` writes `.env` and `docker-compose.yml` to the repo root / `apps/web`, not to `packages/db`
- [ ] `grep -rn "apps/web" packages/db/scripts` returns nothing (no app import survives)

**Verify:** `pnpm --filter @repo/db run db:seed:test` -> `Test seed complete (no Stripe calls).` (requires `POSTGRES_URL` against a scratch DB with a clean `users`/`teams`/`team_members` table)

**Steps:**

- [ ] **Step 1: Attempt the script from its new location before moving it (red)**
Run: `pnpm --filter @repo/db run db:seed:test` (script not yet defined)
Expected: FAIL with `Missing script: "db:seed:test"`

- [ ] **Step 2: Confirm failure**
Run: `pnpm --filter @repo/db run db:seed:test`
Expected: FAIL, `ERR_PNPM_NO_SCRIPT`

- [ ] **Step 3: Move scripts and decouple them**

```bash
mkdir -p packages/db/scripts
git mv apps/web/lib/db/seed.ts packages/db/scripts/seed.ts
git mv apps/web/lib/db/seed-test.ts packages/db/scripts/seed-test.ts
git mv apps/web/lib/db/setup.ts packages/db/scripts/setup.ts
```

```ts
// packages/db/scripts/seed.ts
import { hash } from 'bcryptjs';
import Stripe from 'stripe';
import { db } from '../src/client';
import { users, teams, teamMembers } from '../src/schema';
import { tiers } from '../src/tiers';

const SALT_ROUNDS = 10;

async function hashPassword(password: string) {
  return hash(password, SALT_ROUNDS);
}

// A standalone Stripe client — deliberately NOT imported from
// apps/web/lib/payments/stripe.ts. packages/db must not depend on the app
// that consumes it.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
});

async function createStripeProductsAndPrices() {
  console.log('Creating Stripe products and prices...');

  for (const tier of tiers) {
    if (tier.priceMonthly !== null) {
      let product;

      const existingProducts = await stripe.products.list({ active: true });
      const existingProduct = existingProducts.data.find((p) => p.name === tier.name);

      if (existingProduct) {
        product = existingProduct;
        console.log(`Product ${tier.name} already exists`);
      } else {
        product = await stripe.products.create({
          name: tier.name,
          description: tier.description,
        });
        console.log(`Product ${tier.name} created`);
      }

      const existingPrices = await stripe.prices.list({ product: product.id, active: true });
      const existingPrice = existingPrices.data.find(
        (p) => p.unit_amount === tier.priceMonthly! * 100
      );

      if (existingPrice) {
        console.log(`Price for ${tier.name} already exists`);
        tier.priceId = existingPrice.id;
      } else {
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: tier.priceMonthly! * 100,
          currency: 'usd',
          recurring: {
            interval: 'month',
            trial_period_days: tier.priceMonthly === null ? 0 : 14,
          },
        });
        console.log(`Price for ${tier.name} created`);
        tier.priceId = price.id;
      }
    }
  }

  console.log('Stripe products and prices created successfully.');
}

async function seed() {
  const email = 'test@test.com';
  const password = 'admin123';
  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values([{ email, passwordHash, role: 'owner' }])
    .returning();

  console.log('Initial user created.');

  const freeTier = tiers.find((t) => t.id === 'free');
  if (!freeTier) {
    throw new Error('Free tier not found in tiers.ts');
  }

  const [team] = await db
    .insert(teams)
    .values({
      name: 'Test Team',
      messageLimit: freeTier.messageLimit,
      currentMessages: 0,
    })
    .returning();

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: user.id,
    role: 'owner',
  });

  await createStripeProductsAndPrices();
}

seed()
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed process finished. Exiting...');
    process.exit(0);
  });
```

```ts
// packages/db/scripts/seed-test.ts
import { hash } from 'bcryptjs';
import { db } from '../src/client';
import { users, teams, teamMembers } from '../src/schema';

const SALT_ROUNDS = 10;

async function hashPassword(password: string) {
  return hash(password, SALT_ROUNDS);
}

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

```ts
// packages/db/scripts/setup.ts — unchanged except writeEnvFile's and
// setupLocalPostgres's output paths, which now resolve to the repo root /
// apps/web instead of process.cwd() (packages/db when run via `pnpm --filter`)
async function writeEnvFile(envVars: Record<string, string>) {
  console.log('Step 6: Writing environment variables to apps/web/.env');
  const envContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const envPath = path.resolve(__dirname, '../../../apps/web/.env');
  await fs.writeFile(envPath, envContent);
  console.log(`${envPath} created with the necessary variables.`);
}
// ...and inside setupLocalPostgres(), change the docker-compose.yml write target:
  await fs.writeFile(
    path.resolve(__dirname, '../../..', 'docker-compose.yml'),
    dockerComposeContent
  );
// (rest of the file — checkStripeCLI, getPostgresURL, getStripeSecretKey,
// createStripeWebhook, generateAuthSecret, main — unchanged)
```

```json
// packages/db/tsconfig.json — widen "include" now that scripts/ exists
{
  "extends": "@repo/config/typescript/base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "scripts/**/*.ts", "drizzle.config.ts"]
}
```

```json
// packages/db/package.json — add to "dependencies"/"devDependencies"/"scripts"
"dependencies": {
  "bcryptjs": "^2.4.3",
  "dotenv": "^16.6.1",
  "drizzle-orm": "^0.45.2",
  "postgres": "^3.4.9",
  "stripe": "^22.3.1"
},
"devDependencies": {
  "@repo/config": "workspace:*",
  "@types/bcryptjs": "^2.4.6",
  "@types/node": "^22.13.1",
  "drizzle-kit": "^0.31.10",
  "tsx": "^4.23.1",
  "typescript": "^5.9.3"
},
"scripts": {
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio",
  "db:seed": "tsx scripts/seed.ts",
  "db:seed:test": "tsx scripts/seed-test.ts",
  "db:setup": "tsx scripts/setup.ts"
}
```

```json
// root package.json — add to "scripts"
"db:seed": "pnpm --filter @repo/db run db:seed",
"db:seed:test": "pnpm --filter @repo/db run db:seed:test",
"db:setup": "pnpm --filter @repo/db run db:setup"
```

```bash
pnpm install
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter @repo/db run db:seed:test`
Expected: PASS, prints `Test seed complete (no Stripe calls).` and exits 0

- [ ] **Step 5: Commit**
```bash
git add packages/db/scripts packages/db/tsconfig.json packages/db/package.json package.json pnpm-lock.yaml
git commit -m "Extract packages/db scripts: decouple seed.ts's Stripe client and password hashing from apps/web"
```

---

### Task 10: Split queries.ts — getUserById() in @repo/db, getUser() wrapper in apps/web

**Goal:** Move the framework-agnostic query functions into `packages/db/src/queries.ts` behind a new `getUserById(id)`, and add a thin `getUser()` wrapper to `apps/web/lib/auth/session.ts` that resolves the session cookie via `next/headers` + `verifyToken` and then calls `getUserById` — so `@repo/db` never imports `next/headers`. `getActivityLogs` also changes shape (`getActivityLogs(userId)` instead of calling `getUser()` internally), since that internal call was the one other `next/headers` leak in the original `queries.ts`.

**Files:**
- Modify: `packages/db/src/queries.ts` (moved from `apps/web/lib/db/queries.ts`, rewritten)
- Modify: `packages/db/package.json` (+`"./queries"` export)
- Modify: `apps/web/lib/auth/session.ts` (+`getUser()`, schema import re-pointed)
- Create: `apps/web/tests/unit/get-user-by-id.test.ts`
- Create: `apps/web/tests/unit/get-user-wrapper.test.ts`

**Acceptance Criteria:**
- [ ] `grep -rn "next/headers" packages/db/src` returns nothing
- [ ] `getUserById(id)` returns `null` for a nonexistent or soft-deleted user, and the row otherwise
- [ ] `getUser()` returns `null` with no session cookie or an expired one, and otherwise delegates to `getUserById` with the session's user id
- [ ] `getActivityLogs` takes `userId: number` directly and no longer calls `getUser()` internally

**Verify:** `pnpm --filter web exec vitest run tests/unit/get-user-by-id.test.ts tests/unit/get-user-wrapper.test.ts` -> `6 passed` (the first file needs `POSTGRES_URL` against a scratch DB; the second is fully mocked)

**Steps:**

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/tests/unit/get-user-by-id.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import { users } from '@repo/db/schema';
import { getUserById } from '@repo/db/queries';

let userId: number;

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      email: `vitest-get-user-by-id-${Date.now()}@example.com`,
      passwordHash: 'not-a-real-hash',
      role: 'member',
    })
    .returning();
  userId = user.id;
});

afterAll(async () => {
  if (userId) {
    await db.delete(users).where(eq(users.id, userId));
  }
});

describe('getUserById', () => {
  it('returns the user row for an existing, non-deleted user', async () => {
    const user = await getUserById(userId);
    expect(user).not.toBeNull();
    expect(user!.id).toBe(userId);
  });

  it('returns null for a user id that does not exist', async () => {
    const user = await getUserById(-1);
    expect(user).toBeNull();
  });

  it('returns null for a soft-deleted user', async () => {
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));
    const user = await getUserById(userId);
    expect(user).toBeNull();
    await db.update(users).set({ deletedAt: null }).where(eq(users.id, userId));
  });
});
```

```ts
// apps/web/tests/unit/get-user-wrapper.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const cookiesGetMock = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () => ({ get: cookiesGetMock }),
}));

const getUserByIdMock = vi.fn();
vi.mock('@repo/db/queries', () => ({
  getUserById: getUserByIdMock,
}));

import { signToken, getUser } from '@/lib/auth/session';

beforeEach(() => {
  cookiesGetMock.mockReset();
  getUserByIdMock.mockReset();
});

describe('getUser() session wrapper', () => {
  it('returns null when there is no session cookie', async () => {
    cookiesGetMock.mockReturnValue(undefined);
    const user = await getUser();
    expect(user).toBeNull();
    expect(getUserByIdMock).not.toHaveBeenCalled();
  });

  it('returns null for an expired session', async () => {
    const token = await signToken({
      user: { id: 7 },
      expires: new Date(Date.now() - 60_000).toISOString(),
    });
    cookiesGetMock.mockReturnValue({ value: token });
    const user = await getUser();
    expect(user).toBeNull();
    expect(getUserByIdMock).not.toHaveBeenCalled();
  });

  it('delegates to getUserById with the session user id for a valid session', async () => {
    const token = await signToken({
      user: { id: 7 },
      expires: new Date(Date.now() + 60_000).toISOString(),
    });
    cookiesGetMock.mockReturnValue({ value: token });
    getUserByIdMock.mockResolvedValue({ id: 7, email: 'test@test.com' });

    const user = await getUser();
    expect(getUserByIdMock).toHaveBeenCalledWith(7);
    expect(user).toEqual({ id: 7, email: 'test@test.com' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web exec vitest run tests/unit/get-user-by-id.test.ts tests/unit/get-user-wrapper.test.ts`
Expected: FAIL — `get-user-by-id.test.ts`: `Failed to resolve import "@repo/db/queries"`; `get-user-wrapper.test.ts`: `@/lib/auth/session` has no exported member `getUser`

- [ ] **Step 3: Move and rewrite queries.ts, add the session.ts wrapper**

```bash
git mv apps/web/lib/db/queries.ts packages/db/src/queries.ts
```

```ts
// packages/db/src/queries.ts
import { desc, and, eq, isNull } from 'drizzle-orm';
import { db } from './client';
import { activityLogs, teamMembers, teams, users } from './schema';

export async function getUserById(id: number) {
  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getTeamByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db
    .update(teams)
    .set({
      ...subscriptionData,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));
}

export async function getUserWithTeam(userId: number) {
  const result = await db
    .select({
      user: users,
      teamId: teamMembers.teamId,
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}

export async function getActivityLogs(userId: number) {
  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, userId))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

export async function getTeamForUser(userId: number) {
  const result = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      teamMembers: {
        with: {
          team: {
            with: {
              teamMembers: {
                with: {
                  user: {
                    columns: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return result?.teamMembers[0]?.team || null;
}
```

```json
// packages/db/package.json — add to "exports"
"./queries": "./src/queries.ts",
```

```ts
// apps/web/lib/auth/session.ts — add the import and the new function at the
// end of the file; also re-point the NewUser import (was '@/lib/db/schema')
import { compare, hash } from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NewUser } from '@repo/db/schema';
import { getUserById } from '@repo/db/queries';

// ...(hashPassword / comparePasswords / signToken / verifyToken / getSession /
// setSession bodies unchanged)...

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  const sessionData = await verifyToken(sessionCookie.value);
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== 'number'
  ) {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  return getUserById(sessionData.user.id);
}
```

```bash
pnpm install
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web exec vitest run tests/unit/get-user-by-id.test.ts tests/unit/get-user-wrapper.test.ts`
Expected: PASS (6 tests). Note: `apps/web` will not fully typecheck/build again until Task 11 rewires every other consumer of the old `@/lib/db/queries` path — that is expected and out of scope for this task's Verify.

- [ ] **Step 5: Commit**
```bash
git add packages/db/src/queries.ts packages/db/package.json apps/web/lib/auth/session.ts apps/web/tests/unit/get-user-by-id.test.ts apps/web/tests/unit/get-user-wrapper.test.ts pnpm-lock.yaml
git commit -m "Split queries.ts: getUserById() in @repo/db, getUser() wrapper in apps/web/lib/auth/session.ts"
```

---

### Task 11: Rewire every apps/web consumer to @repo/db and the new getUser() location

**Goal:** Update every remaining `@/lib/db/*` / `@/lib/tiers` / `@/lib/db/queries`-for-`getUser` import across `apps/web` (14 files) to the new package/module locations established in Tasks 7–10, restoring a fully green build.

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/page.tsx`
- Modify: `apps/web/app/(dashboard)/dashboard/activity/page.tsx`
- Modify: `apps/web/app/(dashboard)/dashboard/settings.tsx`
- Modify: `apps/web/app/(front)/pricing/page.tsx`
- Modify: `apps/web/app/(login)/actions.ts`
- Modify: `apps/web/app/api/run/route.ts`
- Modify: `apps/web/app/api/stripe/checkout/route.ts`
- Modify: `apps/web/app/api/stripe/webhook/route.ts`
- Modify: `apps/web/app/api/team/limit/route.ts`
- Modify: `apps/web/app/api/workflow/history/route.ts`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/lib/auth/index.tsx`
- Modify: `apps/web/lib/auth/middleware.ts`
- Modify: `apps/web/lib/payments/stripe.ts`
- Test: full existing suite (`apps/web/tests/unit/**`, `apps/web/tests/e2e/**`)

**Acceptance Criteria:**
- [ ] `grep -rln "@/lib/db\|@/lib/tiers" apps/web/app apps/web/lib` returns nothing
- [ ] `pnpm --filter web exec tsc --noEmit` passes with zero errors
- [ ] The full Vitest suite passes (all files, not just the ones touched in Tasks 7–10)
- [ ] The Playwright e2e suite passes (sign-up→dashboard, sign-in, dashboard load, chatbot smoke test)

**Verify:** `pnpm --filter web exec tsc --noEmit` -> no output/exit 0, then `pnpm --filter web test` -> all suites pass

**Steps:**

- [ ] **Step 1: Confirm the current broken state (red)**
Run: `pnpm --filter web exec tsc --noEmit`
Expected: FAIL with `TS2307: Cannot find module '@/lib/db/queries'` (and similarly for `@/lib/db/schema`, `@/lib/db/drizzle`, `@/lib/db/utils`, `@/lib/tiers`) across the 14 files listed above

- [ ] **Step 2: Run full suite to verify it fails**
Run: `pnpm --filter web test`
Expected: FAIL — `tests/unit/validated-action.test.ts` and others error out importing `@/lib/auth/middleware`, which still imports the now-deleted `@/lib/db/queries`

- [ ] **Step 3: Rewrite every import block**

```tsx
// apps/web/app/(dashboard)/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { Settings } from './settings';
import { getTeamForUser } from '@repo/db/queries';
import { getUser } from '@/lib/auth/session';
```

```tsx
// apps/web/app/(dashboard)/dashboard/activity/page.tsx — imports and body
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Settings, LogOut, UserPlus, Lock, UserCog, CircleAlert, UserMinus, Mail,
  CircleCheckBig, type LucideIcon,
} from 'lucide-react';
import { ActivityType } from '@repo/db/schema';
import { getActivityLogs } from '@repo/db/queries';
import { getUser } from '@/lib/auth/session';

// ...(iconMap / getRelativeTime / formatAction unchanged)...

export default async function ActivityPage() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }
  const logs = await getActivityLogs(user.id);
  // ...(rest of the JSX unchanged)...
}
```

```tsx
// apps/web/app/(dashboard)/dashboard/settings.tsx — only this import line changes
import { TeamDataWithMembers, User } from '@repo/db/schema';
```

```tsx
// apps/web/app/(front)/pricing/page.tsx — only this import line changes
import { tiers, Tier } from '@repo/db/tiers';
```

```ts
// apps/web/app/(login)/actions.ts — import block
'use server';

import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@repo/db/client';
import {
  User, users, teams, teamMembers, activityLogs,
  type NewUser, type NewTeam, type NewTeamMember, type NewActivityLog,
  ActivityType, invitations,
} from '@repo/db/schema';
import { comparePasswords, hashPassword, setSession, getUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createCheckoutSession } from '@/lib/payments/stripe';
import { getUserWithTeam } from '@repo/db/queries';
import {
  validatedAction,
  validatedActionWithUser,
} from '@/lib/auth/middleware';
```

```ts
// apps/web/app/api/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTeamForUser } from '@repo/db/queries';
import { getUser } from '@/lib/auth/session';
import { checkMessageLimit, incrementMessageCount, saveWorkflowHistory } from '@repo/db/utils';
```

```ts
// apps/web/app/api/stripe/checkout/route.ts
import { eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import { users, teams, teamMembers } from '@repo/db/schema';
import { setSession } from '@/lib/auth/session';
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/payments/stripe';
import Stripe from 'stripe';
```

```ts
// apps/web/app/api/stripe/webhook/route.ts
import Stripe from 'stripe';
import { handleSubscriptionChange, stripe } from '@/lib/payments/stripe';
import { NextRequest, NextResponse } from 'next/server';
import { tiers } from '@repo/db/tiers';
import { db } from '@repo/db/client';
import { teams } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
```

```ts
// apps/web/app/api/team/limit/route.ts
import { getTeamForUser } from '@repo/db/queries';
import { getUser } from '@/lib/auth/session';
import { checkMessageLimit } from '@repo/db/utils';
import { NextResponse } from 'next/server';
import { tiers } from '@repo/db/tiers';
```

```ts
// apps/web/app/api/workflow/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTeamForUser } from '@repo/db/queries';
import { getUser } from '@/lib/auth/session';
import { getWorkflowHistory } from '@repo/db/utils';
```

```tsx
// apps/web/app/layout.tsx
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { UserProvider } from '@/lib/auth';
import { getUser } from '@/lib/auth/session';
```

```tsx
// apps/web/lib/auth/index.tsx — only this import line changes
import { User } from '@repo/db/schema';
```

```ts
// apps/web/lib/auth/middleware.ts
import { z } from 'zod';
import { TeamDataWithMembers, User } from '@repo/db/schema';
import { getTeamForUser } from '@repo/db/queries';
import { getUser } from './session';
import { redirect } from 'next/navigation';
```

```ts
// apps/web/lib/payments/stripe.ts — import block
import Stripe from 'stripe';
import { redirect } from 'next/navigation';
import { Team } from '@repo/db/schema';
import {
  getTeamByStripeCustomerId,
  updateTeamSubscription
} from '@repo/db/queries';
import { getUser } from '@/lib/auth/session';
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web exec tsc --noEmit`
Expected: PASS, no output
Run: `pnpm --filter web test`
Expected: PASS, all unit suites green
Run: `pnpm --filter web test:e2e`
Expected: PASS, all 4 Playwright specs green

- [ ] **Step 5: Commit**
```bash
git add apps/web/app apps/web/lib
git commit -m "Rewire apps/web consumers to @repo/db and the relocated getUser() wrapper"
```

---

### Task 12: Scaffold packages/email (empty-but-wired)

**Goal:** Create `@repo/email` with a package.json and one placeholder export so it's a real, resolvable workspace package before Phase 3 fills in Resend + React Email templates — avoiding any further `pnpm-workspace.yaml`/`turbo.json`/`next.config.ts` touches in that phase.

**Files:**
- Create: `packages/email/package.json`
- Create: `packages/email/tsconfig.json`
- Create: `packages/email/src/index.ts`
- Modify: `apps/web/package.json` (+`@repo/email`)
- Modify: `apps/web/next.config.ts` (`transpilePackages` +`'@repo/email'`)
- Test: `apps/web/tests/unit/email-package-placeholder.test.ts`

**Acceptance Criteria:**
- [ ] `@repo/email` resolves as a pnpm workspace member and exports `.` -> `./src/index.ts`
- [ ] `apps/web` can import `PACKAGE_NAME` from `@repo/email` without a build error
- [ ] `next.config.ts`'s `transpilePackages` includes `'@repo/ui'`, `'@repo/db'`, and `'@repo/email'`

**Verify:** `pnpm --filter web exec vitest run tests/unit/email-package-placeholder.test.ts` -> `1 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/unit/email-package-placeholder.test.ts
import { describe, it, expect } from 'vitest';
import { PACKAGE_NAME } from '@repo/email';

describe('@repo/email scaffold', () => {
  it('resolves and exports its placeholder', () => {
    expect(PACKAGE_NAME).toBe('@repo/email');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web exec vitest run tests/unit/email-package-placeholder.test.ts`
Expected: FAIL with `Cannot find package '@repo/email'`

- [ ] **Step 3: Scaffold the package**

```bash
mkdir -p packages/email/src
```

```json
// packages/email/package.json
{
  "name": "@repo/email",
  "version": "0.0.0",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {},
  "devDependencies": {
    "@repo/config": "workspace:*",
    "@types/node": "^22.13.1",
    "typescript": "^5.9.3"
  }
}
```

```json
// packages/email/tsconfig.json
{
  "extends": "@repo/config/typescript/base.json",
  "include": ["src/**/*.ts"]
}
```

```ts
// packages/email/src/index.ts
// Placeholder export so this package has something concrete to type-check
// and for apps/web to wire up to before Phase 3 replaces this with real
// Resend-backed send functions (sendPasswordResetEmail, sendTeamInvitationEmail)
// and @react-email/components templates.
export const PACKAGE_NAME = '@repo/email';
```

```json
// apps/web/package.json — add to "dependencies"
"@repo/email": "workspace:*",
```

```ts
// apps/web/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/ui', '@repo/db', '@repo/email'],
  turbopack: {
    root: __dirname
  }
};

export default nextConfig;
```

```bash
pnpm install
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web exec vitest run tests/unit/email-package-placeholder.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**
```bash
git add packages/email apps/web/package.json apps/web/next.config.ts apps/web/tests/unit/email-package-placeholder.test.ts pnpm-lock.yaml
git commit -m "Scaffold packages/email so Phase 3 doesn't need to touch workspace config again"
```

---

### Task 13: apps/web package.json final cleanup

**Goal:** Lock in the final dependency boundary for `apps/web`: `workspace:*` on `@repo/ui`, `@repo/db`, `@repo/email`; every dependency that moved fully into `packages/db` (`drizzle-kit`, `postgres`, `dotenv`) or fully into `packages/ui` (`radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge` — confirmed by grep against the real repo to have zero remaining call sites outside `components/ui/*`/`lib/utils.ts`, both already moved in Task 3) removed; every app-only dependency (`ai`, `stripe`, `motion`, `canvas-confetti`, `marked`, `bcryptjs`, `jose`, `drizzle-orm`, `zod`, `lucide-react` — used directly by 19+ files outside `components/ui`, e.g. `app/(front)/pricing/page.tsx` — plus the Tailwind build-tool stack: `tailwindcss`, `@tailwindcss/postcss`, `tailwindcss-animate`, `tailwindcss-react-aria-components`, `autoprefixer`, `postcss`, and `next`/`react`) retained, since apps/web still constructs its own Drizzle queries directly with `eq`/`and`/`sql` and still owns Next-coupled auth/payments code and its own Tailwind build pipeline.

**Files:**
- Modify: `apps/web/package.json`
- Test: `apps/web/tests/unit/package-json-boundaries.test.ts`

**Acceptance Criteria:**
- [ ] `apps/web/package.json.dependencies` contains `@repo/ui`, `@repo/db`, `@repo/email`, each set to `"workspace:*"`
- [ ] `apps/web/package.json` contains none of `drizzle-kit`, `postgres`, `dotenv`, `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge` (all fully relocated into `packages/db`/`packages/ui`)
- [ ] `apps/web/package.json` retains `drizzle-orm`, `stripe`, `ai`, `bcryptjs`, `jose`, `canvas-confetti`, `marked`, `motion`, `zod`, `lucide-react`

**Verify:** `pnpm --filter web exec vitest run tests/unit/package-json-boundaries.test.ts` -> `3 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/unit/package-json-boundaries.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(
  readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')
);
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

describe('apps/web package.json workspace boundaries', () => {
  it('depends on @repo/ui, @repo/db, and @repo/email via workspace:*', () => {
    expect(deps['@repo/ui']).toBe('workspace:*');
    expect(deps['@repo/db']).toBe('workspace:*');
    expect(deps['@repo/email']).toBe('workspace:*');
  });

  it('no longer lists dependencies that moved fully into packages/db or packages/ui', () => {
    expect(deps).not.toHaveProperty('drizzle-kit');
    expect(deps).not.toHaveProperty('postgres');
    expect(deps).not.toHaveProperty('dotenv');
    expect(deps).not.toHaveProperty('radix-ui');
    expect(deps).not.toHaveProperty('class-variance-authority');
    expect(deps).not.toHaveProperty('clsx');
    expect(deps).not.toHaveProperty('tailwind-merge');
  });

  it('retains app-only dependencies still used directly by apps/web code', () => {
    for (const name of [
      'drizzle-orm', 'stripe', 'ai', 'bcryptjs', 'jose',
      'canvas-confetti', 'marked', 'motion', 'zod', 'lucide-react',
    ]) {
      expect(deps).toHaveProperty(name);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web exec vitest run tests/unit/package-json-boundaries.test.ts`
Expected: FAIL — the second assertion fails because `radix-ui`, `class-variance-authority`, `clsx`, and `tailwind-merge` are all still present in `apps/web/package.json` at this point (they haven't been pruned yet, even though everything that consumed them moved to `packages/ui` back in Task 3)

- [ ] **Step 3: Finalize apps/web/package.json**

```json
// apps/web/package.json — final "dependencies" block
{
  "dependencies": {
    "@repo/db": "workspace:*",
    "@repo/email": "workspace:*",
    "@repo/ui": "workspace:*",
    "@tailwindcss/postcss": "4.3.2",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^22.13.1",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "ai": "^4.3.19",
    "autoprefixer": "^10.5.3",
    "bcryptjs": "^2.4.3",
    "canvas-confetti": "^1.9.4",
    "date-fns": "^4.4.0",
    "drizzle-orm": "^0.45.2",
    "jose": "^5.9.6",
    "lucide-react": "^1.24.0",
    "marked": "^18.0.6",
    "motion": "^12.42.2",
    "next": "16.2.10",
    "postcss": "^8.5.1",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "server-only": "^0.0.1",
    "stripe": "^22.3.1",
    "tailwindcss": "4.3.2",
    "tailwindcss-animate": "^1.0.7",
    "tailwindcss-react-aria-components": "1.2.0",
    "typescript": "^5.9.3",
    "zod": "^4.4.3"
  }
}
```
(`radix-ui`, `class-variance-authority`, `clsx`, and `tailwind-merge` are removed here — confirmed via `grep -rn "radix-ui\|class-variance-authority\|clsx\|tailwind-merge" apps/web/app apps/web/lib apps/web/components` returning nothing, since every consumer of those four packages lived in `components/ui/*`/`lib/utils.ts`, both already moved to `packages/ui` in Task 3. `lucide-react` stays — unlike those four, it's still imported directly by 19+ files outside `components/ui`, e.g. `app/(front)/pricing/page.tsx`.)

```bash
pnpm install
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web exec vitest run tests/unit/package-json-boundaries.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**
```bash
git add apps/web/package.json apps/web/tests/unit/package-json-boundaries.test.ts pnpm-lock.yaml
git commit -m "Finalize apps/web package.json: workspace:* on @repo/ui/@repo/db/@repo/email, prune moved-out deps"
```

---

### Task 14: Final full-repo verification

**Goal:** Confirm the entire monorepo installs and builds cleanly from a fresh workspace-root `pnpm install`, that `apps/web` builds standalone via Turborepo/pnpm filtering, that CI can actually resolve every command it runs against the new workspace layout, and that a real click-through of the running app still works end-to-end after the whole Phase 2 conversion.

**Files:**
- Modify: `.github/workflows/ci.yml` (two steps need workspace-scoped commands — see Step 3)
- Test: (none new — this task exercises the whole repo, not a single module)

**Acceptance Criteria:**
- [ ] A clean `pnpm install` at the workspace root succeeds with no unresolved workspace dependencies
- [ ] `pnpm --filter web build` succeeds and produces a production build
- [ ] The full automated suite (`pnpm --filter web test`, `pnpm --filter web test:e2e`) passes
- [ ] `.github/workflows/ci.yml`'s `Type check` and `Install Playwright browsers` steps are updated to resolve correctly from the workspace root (see Step 3 — `typescript` and `@playwright/test` are now devDependencies of `apps/web` only, not of the root package, so the pre-Phase-2 `pnpm exec tsc --noEmit` / `pnpm exec playwright install --with-deps chromium` invocations would no longer find those binaries when run from the repo root)
- [ ] A manual click-through of every route succeeds with no console errors: landing → pricing → sign-up → dashboard → activity → team settings → chatbot → workflow → get-token → sign-out → sign-in

**Verify:** `pnpm install && pnpm --filter web build` -> exit 0, `Compiled successfully`

**Steps:**

- [ ] **Step 1: Establish the pre-verification baseline**
Run: `rm -rf node_modules apps/web/node_modules packages/*/node_modules apps/web/.next`
Expected: clean slate, no cached state carried over from Tasks 1–13

- [ ] **Step 2: Run the fresh install and confirm it would fail on any leftover misconfiguration**
Run: `pnpm install`
Expected: PASS — if this FAILS with `ERR_PNPM_NO_MATCHING_VERSION` or an unresolved `workspace:*` specifier, that's the red signal that a package.json/pnpm-workspace.yaml edit from an earlier task is wrong; fix before continuing

- [ ] **Step 3: Fix the two CI steps that break under the new workspace layout, then build and run the full verification suite**

`pnpm install --frozen-lockfile`, `pnpm db:migrate`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, and `pnpm db:seed:test` in `.github/workflows/ci.yml` all continue to work unmodified — root `package.json`'s scripts (added across Tasks 2, 8, and 9) pass those names straight through to `turbo run <task>` or `pnpm --filter @repo/db run <task>`. But `pnpm exec tsc --noEmit` and `pnpm exec playwright install --with-deps chromium` resolve binaries from the nearest `node_modules/.bin` relative to the invocation's cwd — since `typescript` and `@playwright/test` are declared only in `apps/web/package.json` (never hoisted to the root, which has only `turbo` as a devDependency per Task 2), running those two commands unmodified at the repo root in CI would fail to find the binaries. Fix both:

```diff
--- a/.github/workflows/ci.yml
       - name: Type check
-        run: pnpm exec tsc --noEmit
+        run: pnpm --filter web exec tsc --noEmit && pnpm --filter @repo/ui exec tsc --noEmit && pnpm --filter @repo/db exec tsc --noEmit && pnpm --filter @repo/email exec tsc --noEmit
```

```diff
--- a/.github/workflows/ci.yml
       - name: Install Playwright browsers
-        run: pnpm exec playwright install --with-deps chromium
+        run: pnpm --filter web exec playwright install --with-deps chromium
```

Then, locally (standing in for what CI would run):

```bash
pnpm install
pnpm --filter web exec tsc --noEmit
pnpm --filter @repo/ui exec tsc --noEmit
pnpm --filter @repo/db exec tsc --noEmit
pnpm --filter @repo/email exec tsc --noEmit
pnpm --filter web build
pnpm --filter web test
pnpm --filter web test:e2e
```

Then manually: `pnpm --filter web dev` (or `pnpm --filter web exec next start` against the build output) and click through, in order: `/` (landing) → `/pricing` → `/sign-up` (create an account) → confirm redirect to `/dashboard` → `/dashboard/activity` → `/dashboard/team` (settings) → `/dashboard/chatbot` (send one message, confirm streaming response) → `/dashboard/workflow` (run one workflow) → `/dashboard/get-token` → sign out → `/sign-in` (log back in with the same account) — watching the browser console and terminal for errors at every step.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm install && pnpm --filter web exec tsc --noEmit && pnpm --filter @repo/ui exec tsc --noEmit && pnpm --filter @repo/db exec tsc --noEmit && pnpm --filter @repo/email exec tsc --noEmit && pnpm --filter web build && pnpm --filter web test && pnpm --filter web test:e2e`
Expected: PASS at every stage, `Compiled successfully`, all unit and e2e specs green, and the manual click-through in Step 3 produces no console/server errors

- [ ] **Step 5: Commit**
```bash
git add .github/workflows/ci.yml
git add -A
git status
# The .github/workflows/ci.yml fix from Step 3 is a real code change and should
# be committed. If Step 3's manual pass or Step 4's commands surfaced any further
# changes, commit those on their own with a message describing what verification
# step caught them.
git commit -m "Fix CI type-check and Playwright-install steps to resolve from the new workspace layout"
```

---
