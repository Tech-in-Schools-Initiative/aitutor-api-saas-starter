# Phase 4: Design Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the app's two divergent visual languages (the shared `@repo/ui` kit used by `activity`/`general`/`security`/`team`/`settings` vs. the mismatched hand-rolled `chatbot`/`get-token`/`streaming`/`workflow` pages), fix every dead-code/no-op-class/contradictory-class/broken-routing issue on the landing page and dashboard, and restore the handful of shadcn component defaults that Phase 1's registry regeneration silently changed from what this repo's design relied on — leaving `glass-morphism` (a class defined nowhere) gone from the codebase entirely and every dashboard page sharing one consistent header/`Card` pattern.

**Architecture:** This plan assumes Phase 2 (monorepo conversion) and Phase 3 (email feature) have both already landed, so every file path below is the post-Phase-2 location: app code under `apps/web/`, the 12 shadcn primitives + `cn()` under `packages/ui/src/`, and `tiers.ts` under `packages/db/src/`. The exact subpath convention below was cross-checked against `docs/superpowers/plans/2026-07-15-phase-2-monorepo-conversion.md` (written in parallel and available by the time this plan was finalized): `packages/ui` flattens `components/ui/*.tsx` into `packages/ui/src/components/*.tsx` (the `ui/` folder segment is dropped, not preserved) and exposes it via an `exports` map as `@repo/ui/components/*` — e.g. `packages/ui/src/components/button.tsx` is imported as `@repo/ui/components/button`, `packages/ui/src/lib/utils.ts` as `@repo/ui/lib/utils` — and every consumer's `@/components/ui/*`/`@/lib/utils` import is mechanically rewritten to that `@repo/ui/...` form via Phase 2's own sed-based rewrite step, matching the design doc's description of Phase 2's "single largest diff." Internal imports *within* `packages/ui` itself (e.g. `card.tsx` importing `cn` for its own use) keep the shadcn-standard `@/lib/utils` form, relying on that package's own local `tsconfig` path alias. If Phase 2's plan changes this convention before execution, every `@repo/ui/...` and `@repo/db/...` import path in this document needs a mechanical find/replace to match — the *content* of each fix does not change.

Sequencing follows the design doc's own guidance: dead code, no-op classes, contradictory classes, and functional/routing fixes ship first (Tasks 1-14), then the shadcn registry default-styling drift restorations (Tasks 15-22, still cheap single-file/single-primitive fixes, but grouped after the dashboard's own functional fixes since two of them patch the same file a functional fix just rewrote), then the dashboard visual-language reconciliation itself — the biggest diff — as its own contiguous block (Tasks 23-28), and finally the two mobile-only fixes, which are optional polish (Tasks 29-30).

**Tech Stack:** Next.js (App Router) in `apps/web`, React 19, TypeScript, Tailwind CSS v4, shadcn/ui (`packages/ui`), Drizzle ORM + Postgres (`packages/db`), pnpm workspaces + Turborepo, Vitest, Playwright.

**User decisions (already made, per the design doc):**
- Dashboard reconciliation (Tasks 23-28) ships as its own contiguous block precisely because it is the largest diff and needs a manual browser walk-through at 375/768/1280px per the Testing Strategy — do not interleave unrelated changes into that block.
- Mobile fixes (Tasks 29-30) are optional polish, not launch-blocking.
- No Stripe test-mode/CLI access was available in any prior phase; Task 12 only stops the checkout CTA from silently POSTing an empty `priceId` — it does not invent real Stripe IDs (flagged again in that task's Acceptance Criteria).
- `ai` stays frozen at `4.3.19` (Phase 1's decision) — `StreamingChat.tsx` (Task 26) keeps using `ai/react`'s legacy `useChat`, not `@ai-sdk/react`.
- The Phase-1 shadcn regen's globals.css duplicate-theme-token regression (two `:root`/`.dark` blocks silently overriding the app's palette) **is already fixed** — confirmed by reading the live `app/globals.css`, which has exactly one `:root` block and one `.dark` block today. No task in this plan touches `globals.css`; it is not part of this cleanup.

**Decisions this plan makes with a safe mechanical default, flagged per-task for user confirmation (per the design doc's open questions):**
- `terminal.tsx` (Task 1): deleted, since it is confirmed dead (zero import sites) — the design doc's alternative (revive with this repo's own setup commands) is a product decision, not a mechanical fix.
- `TimelineContent.tsx` vs. `TImelineSecion.tsx` (Task 2): the dead duplicate is deleted and the typo'd filename is renamed; its real scroll-linked animation is not ported into the live component.
- Footer newsletter form (Task 7): the commented-out dead markup is removed, not shipped (no subscribe backend exists in this repo).
- `tiers.ts` `priceId` (Task 12): changed from an empty string (a silent landmine) to an explicit `null` with a disabled "Coming Soon" CTA — real Stripe price IDs are still needed before checkout can work.
- `get-token/page.tsx` reachability (Task 13): a sidebar nav entry is added rather than deleting the page.
- `dashboard/team` vs. root `/dashboard` (Task 14): the duplicate route is collapsed into a redirect rather than kept as a distinct page.
- Testimonial handles/authors (Task 6): only clear copy-editing typos are fixed; every name, handle, and substantive claim is left untouched (inventing or verifying real identities is not a mechanical fix).
- `Button` shadow depth (Task 22): restored to match the pre-regen look; this is a visual-depth preference, not a functional bug.

**Verify command convention:** every `Verify` line below runs from the monorepo root via `pnpm --filter web <script> -- <args>` (Turborepo/pnpm-workspace convention, `apps/web`'s `package.json` name is `web`), e.g. `pnpm --filter web test -- tests/unit/foo.test.ts` for Vitest and `pnpm --filter web test:e2e -- tests/e2e/foo.spec.ts` for Playwright.

---

## Operational note for every task in this plan (read before dispatching any task)

This plan was assembled by combining two parallel research passes (landing-page + shadcn-drift; dashboard + functional/mobile) and cross-checking every file/line claim against the live `aitutor-api-saas-starter` repo (pre-Phase-2, single-package layout) before translating paths to their post-Phase-2 `apps/web`/`packages/*` locations. Every code snippet below was verified against the real current file content at assembly time — line numbers cited in prose match the live pre-Phase-2 repo; the actual patches are written against the post-Phase-2 path so they can be applied once Phase 2 lands.

**Three tasks touch `apps/web/app/(dashboard)/dashboard/settings.tsx` in sequence and must run in this order (already encoded via `blockedBy` in the companion `.tasks.json`):** Task 10 (remove-member gate) does a full-file rewrite; Task 11 (avatar-initials centralization) patches only that file's `AvatarFallback` body; Task 15 (Avatar 40px restore) patches only that file's `<Avatar>` tag. Running them out of order will produce a merge conflict, not a silent bug — each step's "Write minimal implementation" is written as a precise patch against the file state the *previous* task in this chain leaves behind.

**Two tasks touch `apps/web/app/(front)/pricing/page.tsx`:** Task 5 (dynamic Tailwind color class) and Task 12 (empty `priceId` + CTA guard) edit different regions of the same file (the icon-color `div` vs. the `PricingTier` interface + CTA block) and are written as independent patches, but Task 12 is sequenced after Task 5 (`blockedBy: [5]`) for a clean diff history.

---

### Task 1: Delete dead `terminal.tsx`

**Goal:** Remove the never-imported `apps/web/app/(front)/terminal.tsx`, which still shows the original Vercel starter's clone URL.

**Files:**
- Delete: `apps/web/app/(front)/terminal.tsx`
- Test: `apps/web/tests/unit/terminal-removed.test.ts`

**Acceptance Criteria:**
- [ ] `apps/web/app/(front)/terminal.tsx` no longer exists.
- [ ] `grep -r "terminal" apps/web/app apps/web/components` (excluding `node_modules`) has zero remaining references outside this deletion's own commit message.
- [ ] **Open question flagged for the user:** the design doc offers reviving `terminal.tsx` with this repo's own setup commands as an alternative to deletion. This task takes the mechanical default (delete, since it is dead code with zero import sites) — confirm before/during execution whether a revived, repo-accurate terminal animation is wanted instead.

**Verify:** `pnpm --filter web test -- tests/unit/terminal-removed.test.ts` -> `Test Files 1 passed`, `Tests 1 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```ts
// apps/web/tests/unit/terminal-removed.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';

describe('dead terminal.tsx', () => {
  it('has been removed from app/(front) (confirmed unimported by any route)', () => {
    const terminalPath = path.join(process.cwd(), 'app', '(front)', 'terminal.tsx');
    expect(existsSync(terminalPath)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/terminal-removed.test.ts`
Expected: FAIL with "expected true to be false" (the file still exists).

- [ ] **Step 3: Write minimal implementation**
```bash
git rm "apps/web/app/(front)/terminal.tsx"
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/terminal-removed.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add -A "apps/web/app/(front)/terminal.tsx" apps/web/tests/unit/terminal-removed.test.ts
git commit -m "Delete dead terminal.tsx (never imported, shows original starter's clone URL)"
```

---

### Task 2: Dedupe `TimelineContent.tsx` vs. typo'd `TImelineSecion.tsx`

**Goal:** Delete the unused `TimelineContent.tsx` duplicate and rename the typo'd, live `TImelineSecion.tsx` to `TimelineSection.tsx`, updating its one import site.

**Files:**
- Delete: `apps/web/components/landing-page/timeline/TimelineContent.tsx`
- Rename: `apps/web/components/landing-page/timeline/TImelineSecion.tsx` -> `apps/web/components/landing-page/timeline/TimelineSection.tsx`
- Modify: `apps/web/app/(front)/page.tsx`
- Test: `apps/web/tests/unit/timeline-dedupe.test.ts`

**Acceptance Criteria:**
- [ ] `apps/web/components/landing-page/timeline/TimelineContent.tsx` no longer exists.
- [ ] `apps/web/components/landing-page/timeline/TImelineSecion.tsx` no longer exists; `TimelineSection.tsx` exists in its place and exports a `TimelineSection` function.
- [ ] `apps/web/app/(front)/page.tsx` imports from the renamed path.
- [ ] **Open question flagged for the user:** the design doc's alternative to deletion is porting the dead file's real scroll-linked line animation (`useScroll`/`useTransform` over `Particles`) into the live `TimelineSection.tsx` before removing it. This task takes the mechanical default (delete the unused duplicate, keep the live component's current stripped-down animation) — confirm before/during execution whether the scroll-linked animation should be ported in instead of discarded.

**Verify:** `pnpm --filter web test -- tests/unit/timeline-dedupe.test.ts` -> `Test Files 1 passed`, `Tests 3 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```ts
// apps/web/tests/unit/timeline-dedupe.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';

describe('timeline component dedupe', () => {
  it('removes the unused duplicate TimelineContent.tsx', () => {
    const dupPath = path.join(
      process.cwd(),
      'components/landing-page/timeline/TimelineContent.tsx'
    );
    expect(existsSync(dupPath)).toBe(false);
  });

  it("renames the typo'd TImelineSecion.tsx to TimelineSection.tsx", () => {
    const oldPath = path.join(
      process.cwd(),
      'components/landing-page/timeline/TImelineSecion.tsx'
    );
    const newPath = path.join(
      process.cwd(),
      'components/landing-page/timeline/TimelineSection.tsx'
    );
    expect(existsSync(oldPath)).toBe(false);
    expect(existsSync(newPath)).toBe(true);
  });

  it('exports TimelineSection from the renamed file', async () => {
    const mod = await import('@/components/landing-page/timeline/TimelineSection');
    expect(typeof mod.TimelineSection).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/timeline-dedupe.test.ts`
Expected: FAIL — `TimelineContent.tsx` still exists, `TImelineSecion.tsx` still exists under the old name, and the dynamic import of `TimelineSection` 404s.

- [ ] **Step 3: Write minimal implementation**
```bash
git rm apps/web/components/landing-page/timeline/TimelineContent.tsx
git mv apps/web/components/landing-page/timeline/TImelineSecion.tsx apps/web/components/landing-page/timeline/TimelineSection.tsx
```

In `apps/web/app/(front)/page.tsx`:
```tsx
import { TimelineSection } from '@/components/landing-page/timeline/TimelineSection';
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/timeline-dedupe.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add -A apps/web/components/landing-page/timeline/TimelineContent.tsx apps/web/components/landing-page/timeline/TImelineSecion.tsx apps/web/components/landing-page/timeline/TimelineSection.tsx "apps/web/app/(front)/page.tsx" apps/web/tests/unit/timeline-dedupe.test.ts
git commit -m "Delete unused TimelineContent.tsx duplicate; rename typo'd TImelineSecion.tsx to TimelineSection.tsx"
```

---

### Task 3: Fix invalid `text-spektr-cyan-50` class and hero grammar

**Goal:** Replace the undefined `text-spektr-cyan-50` class in `hero.tsx` with a real design-token class, and fix the grammatically broken hero subcopy.

**Files:**
- Modify: `apps/web/components/landing-page/hero/hero.tsx`
- Test: `apps/web/tests/unit/hero.test.tsx`

**Acceptance Criteria:**
- [ ] No element in the rendered hero has the `text-spektr-cyan-50` class.
- [ ] The "SaaS Wrapper for Your" span uses a real theme token (`text-foreground`).
- [ ] The subcopy reads "Get started quickly with an online subscription product that uses AI Tutor API for agentic capabilities, Postgres for database management, and Stripe for payment processing."

**Verify:** `pnpm --filter web test -- tests/unit/hero.test.tsx` -> `Test Files 1 passed`, `Tests 3 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/hero.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('canvas-confetti', () => {
  const confettiMock = vi.fn() as unknown as { create: () => () => void };
  (confettiMock as any).create = vi.fn(() => vi.fn());
  return { default: confettiMock };
});

import { Hero } from '@/components/landing-page/hero/hero';

describe('Hero', () => {
  it('does not use the invalid text-spektr-cyan-50 class', () => {
    const { container } = render(<Hero />);
    expect(container.querySelector('.text-spektr-cyan-50')).toBeNull();
  });

  it('renders the "SaaS Wrapper for Your" heading with a real text-color token', () => {
    render(<Hero />);
    const heading = screen.getByText('SaaS Wrapper for Your');
    expect(heading.className).toContain('text-foreground');
  });

  it('renders grammatically corrected hero copy', () => {
    render(<Hero />);
    expect(
      screen.getByText(
        'Get started quickly with an online subscription product that uses AI Tutor API for agentic capabilities, Postgres for database management, and Stripe for payment processing.'
      )
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/hero.test.tsx`
Expected: FAIL — `container.querySelector('.text-spektr-cyan-50')` finds an element (the class is present), and the corrected copy string doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

In `apps/web/components/landing-page/hero/hero.tsx`, change line 65 from:
```tsx
              <span className="text-spektr-cyan-50">SaaS Wrapper for Your</span>
```
to:
```tsx
              <span className="text-foreground">SaaS Wrapper for Your</span>
```

And update the subcopy paragraph to:
```tsx
            <p className="text-lg md:text-xl leading-relaxed tracking-tight text-muted-foreground max-w-2xl text-center">
                Get started quickly with an online subscription product that uses AI Tutor API for agentic capabilities, Postgres for database management, and Stripe for payment processing.
            </p>
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/hero.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/web/components/landing-page/hero/hero.tsx apps/web/tests/unit/hero.test.tsx
git commit -m "Fix invalid text-spektr-cyan-50 class and hero subcopy grammar"
```

---

### Task 4: Fix the invalid `font-medium bold` class on `security/page.tsx`'s heading

**Goal:** Replace the meaningless two-class combo `font-medium bold` (the latter isn't a real Tailwind utility) with `font-bold`.

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/security/page.tsx`
- Test: `apps/web/tests/unit/security-page-heading.test.ts`

**Acceptance Criteria:**
- [ ] `security/page.tsx`'s source no longer contains the literal string `font-medium bold`.
- [ ] The page heading uses `font-bold`.

**Verify:** `pnpm --filter web test -- tests/unit/security-page-heading.test.ts` -> `Test Files 1 passed`, `Tests 2 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```ts
// apps/web/tests/unit/security-page-heading.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function readSource(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');
}

describe('SecurityPage heading class', () => {
  it('does not use the invalid "font-medium bold" class combination', () => {
    const source = readSource('app/(dashboard)/dashboard/security/page.tsx');
    expect(source).not.toMatch(/font-medium bold/);
  });

  it('uses font-bold on the page heading', () => {
    const source = readSource('app/(dashboard)/dashboard/security/page.tsx');
    expect(source).toMatch(/text-lg lg:text-2xl font-bold text-gray-900 mb-6/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/security-page-heading.test.ts`
Expected: FAIL — first assertion fails (source still contains `font-medium bold`); second assertion fails too (pattern not found).

- [ ] **Step 3: Write minimal implementation**
Change line 54 of `apps/web/app/(dashboard)/dashboard/security/page.tsx` from:
```tsx
      <h1 className="text-lg lg:text-2xl font-medium bold text-gray-900 mb-6">
```
to:
```tsx
      <h1 className="text-lg lg:text-2xl font-bold text-gray-900 mb-6">
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/security-page-heading.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**
```bash
git add "apps/web/app/(dashboard)/dashboard/security/page.tsx" apps/web/tests/unit/security-page-heading.test.ts
git commit -m "Fix invalid font-medium bold class on Security Settings heading"
```

---

### Task 5: Fix dynamic Tailwind class in `pricing/page.tsx`

**Goal:** Replace the dynamic `` `text-${color}-500` `` template (invisible to Tailwind's static class scanner) with a static lookup object, and stub `STRIPE_SECRET_KEY` in the Vitest env so tests can import this route module at all.

**Files:**
- Modify: `apps/web/app/(front)/pricing/page.tsx`, `apps/web/vitest.config.ts`
- Test: `apps/web/tests/unit/pricing-tier-color.test.ts`

**Acceptance Criteria:**
- [ ] No template-literal Tailwind class (`` `text-${color}-500` ``) remains in `pricing/page.tsx`.
- [ ] `blue` and `amber` (the only two colors ever assigned to a tier today) resolve to real, statically-scannable classes.
- [ ] An unrecognized color key falls back to `text-blue-500` instead of producing an invalid/empty class.

**Verify:** `pnpm --filter web test -- tests/unit/pricing-tier-color.test.ts` -> `Test Files 1 passed`, `Tests 3 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```ts
// apps/web/tests/unit/pricing-tier-color.test.ts
import { describe, it, expect } from 'vitest';
import { getTierIconColorClass } from '@/app/(front)/pricing/page';

describe('getTierIconColorClass', () => {
  it('maps "blue" to a static, Tailwind-scanner-visible class', () => {
    expect(getTierIconColorClass('blue')).toBe('text-blue-500');
  });

  it('maps "amber" to a static class', () => {
    expect(getTierIconColorClass('amber')).toBe('text-amber-500');
  });

  it('falls back to text-blue-500 for an unrecognized color key', () => {
    expect(getTierIconColorClass('mystery')).toBe('text-blue-500');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/pricing-tier-color.test.ts`
Expected: FAIL — `getTierIconColorClass` is not exported from `pricing/page.tsx` yet (import error). (Without the `vitest.config.ts` env change below, this would instead fail even earlier with a Stripe SDK construction error when the module chain — `pricing/page.tsx` -> `lib/payments/actions.ts` -> `lib/payments/stripe.ts` — is imported; add that env stub as part of this same step so the failure you see is the intended "not exported yet" one.)

- [ ] **Step 3: Write minimal implementation**

In `apps/web/vitest.config.ts`, add the Stripe env stub (this repo's `lib/payments/stripe.ts` constructs a `Stripe` client at module load time from `process.env.STRIPE_SECRET_KEY!`, which throws if unset — mirroring the existing `AUTH_SECRET` stub added during Phase 1):
```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    env: {
      AUTH_SECRET: 'vitest-unit-test-secret-do-not-use-in-production',
      STRIPE_SECRET_KEY: 'sk_test_vitest_dummy_key_do_not_use',
    },
  },
});
```

In `apps/web/app/(front)/pricing/page.tsx`, add near the top (after the existing imports, before `PricingTier`):
```ts
const TIER_ICON_COLOR_CLASS: Record<string, string> = {
  blue: 'text-blue-500',
  amber: 'text-amber-500',
};

export function getTierIconColorClass(color: string): string {
  return TIER_ICON_COLOR_CLASS[color] ?? 'text-blue-500';
}
```

Update the icon wrapper's className inside `PricingCard` (line 127's `` `text-${color}-500` `` becomes):
```tsx
                <div
                    className={cn(
                        "w-12 h-12 rounded-full mb-4",
                        "flex items-center justify-center",
                        "border-2 border-zinc-900 dark:border-white",
                        getTierIconColorClass(color)
                    )}
                >
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/pricing-tier-color.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add "apps/web/app/(front)/pricing/page.tsx" apps/web/vitest.config.ts apps/web/tests/unit/pricing-tier-color.test.ts
git commit -m "Replace dynamic Tailwind color class in pricing page with a static lookup"
```

---

### Task 6: Fix testimonial typos

**Goal:** Fix the run-on/mangled testimonial copy in `testimonial-cards.tsx` without altering the substantive claims or handles.

**Files:**
- Modify: `apps/web/components/landing-page/timeline/components/testimonial-cards.tsx`
- Test: `apps/web/tests/unit/testimonial-cards.test.tsx`

**Acceptance Criteria:**
- [ ] The mangled "next flix" phrasing is gone, replaced with "Netflix-style".
- [ ] The first testimonial no longer starts a new sentence with "And" after a period.
- [ ] The third testimonial's stray trailing space before the closing ellipsis is removed.
- [ ] **Open question flagged for the user:** the design doc explicitly calls the testimonial handles (`@ohheymasha`, `@AiJohnAllen`, `@sarahndipitous`) and author names fabricated-looking. This task takes the mechanical default (fix only clear copy-editing typos, leave every name/handle/claim untouched since inventing or verifying real identities is not a mechanical fix) — confirm with the user before/during execution whether these are real quotes needing sourcing/verification or intentional placeholder content that should be swapped for something else entirely.

**Verify:** `pnpm --filter web test -- tests/unit/testimonial-cards.test.tsx` -> `Test Files 1 passed`, `Tests 2 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/testimonial-cards.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShuffleCards } from '@/components/landing-page/timeline/components/testimonial-cards';

describe('ShuffleCards testimonials', () => {
  it('does not contain the mangled "next flix" phrasing', () => {
    render(<ShuffleCards />);
    expect(screen.queryByText(/next flix/i)).toBeNull();
  });

  it('joins the first testimonial into one grammatical sentence instead of starting a sentence with "And"', () => {
    render(<ShuffleCards />);
    expect(
      screen.getByText(
        "It started as a quick pilot yesterday to test @myaitutor's beta API and turned into my own little fridge wiz"
      )
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/testimonial-cards.test.tsx`
Expected: FAIL — the current copy contains "next flix" and the first testimonial is still split across two sentences ("...beta API. And turned into...").

- [ ] **Step 3: Write minimal implementation**

In `apps/web/components/landing-page/timeline/components/testimonial-cards.tsx`, update the `testimonials` array:
```tsx
const testimonials = [
  {
    id: 1,
    testimonial:
      "It started as a quick pilot yesterday to test @myaitutor's beta API and turned into my own little fridge wiz",
    author: "Masha - @ohheymasha",
    imageSrc: "/masha.jpg", // Add image source
  },
  {
    id: 2,
    testimonial:
      "Thanks to them, I built a paid subscription Netflix-style platform using their AI tool @myaitutor",
    author: "John - @AiJohnAllen",
    imageSrc: "/john.jpg", // Add image source
  },
  {
    id: 3,
    testimonial:
      "… thankfully @tsi_org solves this by putting everything under one umbrella…",
    author: "Sarah - @sarahndipitous",
    imageSrc: "/sarah.jpeg", // Add image source
  },
];
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/testimonial-cards.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/web/components/landing-page/timeline/components/testimonial-cards.tsx apps/web/tests/unit/testimonial-cards.test.tsx
git commit -m "Fix mangled testimonial copy (run-on sentence, 'next flix' typo)"
```

---

### Task 7: Footer — remove commented-out newsletter form and fix dead Home link

**Goal:** Remove the dead, commented-out newsletter subscribe form and point the footer's "Home" link at the actual homepage instead of `href="#"`.

**Files:**
- Modify: `apps/web/components/landing-page/footer/footer.tsx`
- Test: `apps/web/tests/unit/footer.test.tsx`

**Acceptance Criteria:**
- [ ] No commented-out newsletter form markup remains in `footer.tsx`.
- [ ] The now-unused `Input`/`Label` imports are removed.
- [ ] The "Home" nav link points to `/`, not `#`.
- [ ] **Open question flagged for the user:** the design doc's alternative to removal is actually shipping the newsletter form (requires a real subscribe backend/email-list integration, which does not exist in this repo). This task takes the mechanical default (remove the dead commented markup) — confirm before/during execution whether a working newsletter signup should be built instead.

**Verify:** `pnpm --filter web test -- tests/unit/footer.test.tsx` -> `Test Files 1 passed`, `Tests 2 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/footer.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} alt={props.alt ?? ''} />,
}));

import { StackedCircularFooter } from '@/components/landing-page/footer/footer';

describe('StackedCircularFooter', () => {
  it('does not render the commented-out newsletter subscribe form', () => {
    render(<StackedCircularFooter />);
    expect(screen.queryByPlaceholderText('Enter your email')).toBeNull();
    expect(screen.queryByText('Subscribe')).toBeNull();
  });

  it('links Home to the actual homepage instead of a dead "#" href', () => {
    render(<StackedCircularFooter />);
    const homeLink = screen.getByRole('link', { name: 'Home' });
    expect(homeLink.getAttribute('href')).toBe('/');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/footer.test.tsx`
Expected: FAIL — the second assertion fails because `Home`'s href is currently `#`. (The first assertion already passes today since the form is commented out, but it stays as a regression guard.)

- [ ] **Step 3: Write minimal implementation**

In `apps/web/components/landing-page/footer/footer.tsx`, update imports:
```tsx
"use client";
import React from "react";
import Image from 'next/image';
import Link from 'next/link';
import AnimatedGradientBackground from "./animated-gradient-background";
import { Icons } from "./icons"
import { Button } from "@repo/ui/components/button"
```

Update the Home link:
```tsx
          <nav className="mb-8 flex flex-wrap justify-center gap-6">
            <Link href="/" className="hover:text-primary">Home</Link>
            <a href="https://aitutor-api.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:text-primary">AI Tutor API</a>
            <a href="https://account.myapps.ai/" target="_blank" rel="noopener noreferrer" className="hover:text-primary">AI Tutor</a>
            <a href="https://pixio.myapps.ai/" target="_blank" rel="noopener noreferrer" className="hover:text-primary">Pixio</a>
            <a href="https://getmytsi.org/" target="_blank" rel="noopener noreferrer" className="hover:text-primary">Mytsi</a>
          </nav>
```

Remove the commented-out block entirely (the `{/* <div className="mb-8 w-full max-w-md"> ... </div> */}` between the social-icon buttons and the copyright paragraph, along with the now-dead `Input`/`Label` imports it was the only consumer of).

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/footer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/web/components/landing-page/footer/footer.tsx apps/web/tests/unit/footer.test.tsx
git commit -m "Remove dead newsletter form comment and fix footer Home link"
```

---

### Task 8: Fix contradictory Sign In button classes

**Goal:** Replace the Sign In button's self-contradicting Tailwind classes (`bg-black` + `bg-transparent` + `text-black`) with the shared `Button`'s `variant="outline"`.

**Files:**
- Modify: `apps/web/app/(front)/layout.tsx`
- Test: `apps/web/tests/unit/front-layout-sign-in.test.tsx`

**Acceptance Criteria:**
- [ ] The logged-out header's Sign In control has `data-variant="outline"` and no `bg-black`/`bg-transparent`/`text-black` classes.
- [ ] Sign Up button is untouched (still solid black CTA).
- [ ] `pnpm --filter web build` still compiles the `(front)` route group.

**Verify:** `pnpm --filter web test -- tests/unit/front-layout-sign-in.test.tsx` -> `Test Files 1 passed`, `Tests 2 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/front-layout-sign-in.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} alt={props.alt ?? ''} />,
}));

import Layout from '@/app/(front)/layout';
import { UserProvider } from '@/lib/auth';

describe('(front) layout Header — Sign In button', () => {
  it('uses the outline Button variant with no contradictory background/text classes', async () => {
    render(
      <UserProvider userPromise={Promise.resolve(null)}>
        <Suspense fallback={null}>
          <Layout>
            <div />
          </Layout>
        </Suspense>
      </UserProvider>
    );

    const signInLink = await screen.findByRole('link', { name: 'Sign In' });

    expect(signInLink.getAttribute('data-slot')).toBe('button');
    expect(signInLink.getAttribute('data-variant')).toBe('outline');
    expect(signInLink.className).not.toContain('bg-black');
    expect(signInLink.className).not.toContain('bg-transparent');
    expect(signInLink.className).not.toContain('text-black');
  });

  it('leaves the Sign Up button as the solid black CTA', async () => {
    render(
      <UserProvider userPromise={Promise.resolve(null)}>
        <Suspense fallback={null}>
          <Layout>
            <div />
          </Layout>
        </Suspense>
      </UserProvider>
    );

    const signUpLink = await screen.findByRole('link', { name: 'Sign Up' });
    expect(signUpLink.className).toContain('bg-black');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/front-layout-sign-in.test.tsx`
Expected: FAIL — first assertion fails because the Sign In link's `data-variant` is `"default"` (no `variant` prop passed today) and its className still contains `bg-black`/`bg-transparent`/`text-black`.

- [ ] **Step 3: Write minimal implementation**

In `apps/web/app/(front)/layout.tsx`, replace the two-button block (currently lines 76-89) with:
```tsx
            <>
              <Button
                asChild
                className="bg-black hover:bg-gray-800 text-white text-sm px-4 py-2 rounded-full"
              >
                <Link href="/sign-up">Sign Up</Link>
              </Button>
              <Button asChild variant="outline" className="text-sm px-4 py-2 rounded-full">
                <Link href="/sign-in">Sign In</Link>
              </Button>
            </>
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/front-layout-sign-in.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add "apps/web/app/(front)/layout.tsx" apps/web/tests/unit/front-layout-sign-in.test.tsx
git commit -m "Fix contradictory Sign In button classes to use the outline Button variant"
```

---

### Task 9: Add the missing `public/placeholder.svg`

**Goal:** Stop every team-member avatar image request from 404ing by adding the placeholder asset `settings.tsx` already references.

**Files:**
- Create: `apps/web/public/placeholder.svg`
- Test: `apps/web/tests/unit/placeholder-asset.test.ts`

**Acceptance Criteria:**
- [ ] `apps/web/public/placeholder.svg` exists and is a valid `<svg>` document.
- [ ] Requesting `/placeholder.svg` from the running app no longer 404s (manual check).

**Verify:** `pnpm --filter web test -- tests/unit/placeholder-asset.test.ts` -> `Test Files 1 passed`, `Tests 1 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```ts
// apps/web/tests/unit/placeholder-asset.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('public/placeholder.svg', () => {
  it('exists and is a valid SVG document', () => {
    const filePath = path.resolve(process.cwd(), 'public', 'placeholder.svg');
    expect(existsSync(filePath)).toBe(true);
    const contents = readFileSync(filePath, 'utf-8');
    expect(contents.trim().startsWith('<svg')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/placeholder-asset.test.ts`
Expected: FAIL with `expected false to be true` (file does not exist).

- [ ] **Step 3: Write minimal implementation**
```svg
<!-- apps/web/public/placeholder.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" role="img" aria-label="Placeholder avatar">
  <rect width="40" height="40" rx="20" fill="#E5E7EB"/>
  <path d="M20 20c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6Zm0 3c-4.418 0-13 2.239-13 6.667V32h26v-2.333C33 25.239 24.418 23 20 23Z" fill="#9CA3AF"/>
</svg>
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/placeholder-asset.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/web/public/placeholder.svg apps/web/tests/unit/placeholder-asset.test.ts
git commit -m "Add missing public/placeholder.svg to stop team-member avatar 404s"
```

---

### Task 10: Settings remove-member gate — replace hardcoded `index > 1` with a real isOwner/self-protection rule

**Goal:** Replace the meaningless `index > 1` gate in `settings.tsx` with a real permission rule: only team owners can remove members, owners can never be removed this way, and nobody can remove themselves.

**Files:**
- Create: `apps/web/lib/auth/permissions.ts`
- Modify: `apps/web/app/(dashboard)/dashboard/settings.tsx`
- Test: `apps/web/tests/unit/permissions.test.ts`

**Acceptance Criteria:**
- [ ] `canRemoveTeamMember` returns `true` only when the caller is an owner, the target is not an owner, and the target is not the caller.
- [ ] `settings.tsx` no longer contains the string `index > 1`.
- [ ] The "Remove" button in the team-members list is gated by `canRemoveTeamMember`, not array position.

**Verify:** `pnpm --filter web test -- tests/unit/permissions.test.ts` -> `Test Files 1 passed`, `Tests 5 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```ts
// apps/web/tests/unit/permissions.test.ts
import { describe, it, expect } from 'vitest';
import { canRemoveTeamMember } from '@/lib/auth/permissions';
import type { TeamMember, User } from '@repo/db/schema';

type Member = TeamMember & { user: Pick<User, 'id' | 'name' | 'email'> };

function makeMember(overrides: Partial<Member>): Member {
  return {
    id: 1,
    userId: 1,
    teamId: 1,
    role: 'member',
    joinedAt: new Date(),
    user: { id: 1, name: 'Test User', email: 'test@example.com' },
    ...overrides,
  };
}

describe('canRemoveTeamMember', () => {
  it('allows an owner to remove a regular member', () => {
    const owner = makeMember({
      id: 1,
      userId: 10,
      role: 'owner',
      user: { id: 10, name: 'Owner', email: 'owner@example.com' },
    });
    const member = makeMember({
      id: 2,
      userId: 20,
      role: 'member',
      user: { id: 20, name: 'Member', email: 'member@example.com' },
    });
    expect(canRemoveTeamMember(10, member, [owner, member])).toBe(true);
  });

  it('does not allow removing another owner', () => {
    const owner = makeMember({
      id: 1,
      userId: 10,
      role: 'owner',
      user: { id: 10, name: 'Owner', email: 'owner@example.com' },
    });
    const otherOwner = makeMember({
      id: 2,
      userId: 20,
      role: 'owner',
      user: { id: 20, name: 'Other Owner', email: 'other@example.com' },
    });
    expect(canRemoveTeamMember(10, otherOwner, [owner, otherOwner])).toBe(false);
  });

  it('does not allow removing yourself', () => {
    const owner = makeMember({
      id: 1,
      userId: 10,
      role: 'owner',
      user: { id: 10, name: 'Owner', email: 'owner@example.com' },
    });
    expect(canRemoveTeamMember(10, owner, [owner])).toBe(false);
  });

  it('does not allow a regular member to remove anyone', () => {
    const owner = makeMember({
      id: 1,
      userId: 10,
      role: 'owner',
      user: { id: 10, name: 'Owner', email: 'owner@example.com' },
    });
    const member = makeMember({
      id: 2,
      userId: 20,
      role: 'member',
      user: { id: 20, name: 'Member', email: 'member@example.com' },
    });
    expect(canRemoveTeamMember(20, owner, [owner, member])).toBe(false);
  });

  it('returns false when there is no current user id', () => {
    const member = makeMember({});
    expect(canRemoveTeamMember(undefined, member, [member])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/permissions.test.ts`
Expected: FAIL with `Cannot find module '@/lib/auth/permissions'` (or `Failed to resolve import`).

- [ ] **Step 3: Write minimal implementation**
```ts
// apps/web/lib/auth/permissions.ts
import type { TeamMember, User } from '@repo/db/schema';

export type TeamMemberWithUser = TeamMember & {
  user: Pick<User, 'id' | 'name' | 'email'>;
};

/**
 * Determines whether `currentUserId` may remove `member` from the team,
 * given the full `teamMembers` roster. Replaces the old hardcoded
 * `index > 1` gate: only team owners may remove members, owners can never
 * be removed via this control, and nobody can remove themselves this way.
 */
export function canRemoveTeamMember(
  currentUserId: number | undefined,
  member: TeamMemberWithUser,
  teamMembers: TeamMemberWithUser[]
): boolean {
  if (!currentUserId) return false;

  const viewer = teamMembers.find((m) => m.user.id === currentUserId);
  const viewerIsOwner = viewer?.role === 'owner';
  const targetIsOwner = member.role === 'owner';
  const targetIsSelf = member.user.id === currentUserId;

  return viewerIsOwner && !targetIsOwner && !targetIsSelf;
}
```

Then wire it into `apps/web/app/(dashboard)/dashboard/settings.tsx` (full replacement file — this is the first of three tasks in this plan that touch this file; Tasks 11 and 15 patch it further on top of this):
```tsx
'use client';

import { Button } from '@repo/ui/components/button';
import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { customerPortalAction } from '@/lib/payments/actions';
import { use, useActionState } from 'react';
import { TeamDataWithMembers, User } from '@repo/db/schema';
import { removeTeamMember } from '@/app/(login)/actions';
import { InviteTeamMember } from './invite-team';
import { useUser } from '@/lib/auth';
import { canRemoveTeamMember } from '@/lib/auth/permissions';

type ActionState = {
  error?: string;
  success?: string;
};

export function Settings({ teamData }: { teamData: TeamDataWithMembers }) {
  const { userPromise } = useUser();
  const currentUser = use(userPromise);

  const [removeState, removeAction, isRemovePending] = useActionState<
    ActionState,
    FormData
  >(removeTeamMember, { error: '', success: '' });

  const getUserDisplayName = (user: Pick<User, 'id' | 'name' | 'email'>) => {
    return user.name || user.email || 'Unknown User';
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Team Settings</h1>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Team Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div className="mb-4 sm:mb-0">
                <p className="font-medium">
                  Current Plan: {teamData.planName || 'Free'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {teamData.subscriptionStatus === 'active'
                    ? 'Billed monthly'
                    : teamData.subscriptionStatus === 'trialing'
                      ? 'Trial period'
                      : 'No active subscription'}
                </p>
              </div>
              <form action={customerPortalAction}>
                <Button type="submit" variant="outline">
                  Manage Subscription
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {teamData.teamMembers.map((member) => (
              <li key={member.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Avatar>
                    <AvatarImage
                      src={`/placeholder.svg?height=32&width=32`}
                      alt={getUserDisplayName(member.user)}
                    />
                    <AvatarFallback>
                      {getUserDisplayName(member.user)
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {getUserDisplayName(member.user)}
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {member.role}
                    </p>
                  </div>
                </div>
                {canRemoveTeamMember(currentUser?.id, member, teamData.teamMembers) ? (
                  <form action={removeAction}>
                    <input type="hidden" name="memberId" value={member.id} />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={isRemovePending}
                    >
                      {isRemovePending ? 'Removing...' : 'Remove'}
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {removeState?.error && (
            <p className="text-red-500 mt-4">{removeState.error}</p>
          )}
        </CardContent>
      </Card>
      <InviteTeamMember />
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/permissions.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**
```bash
git add apps/web/lib/auth/permissions.ts "apps/web/app/(dashboard)/dashboard/settings.tsx" apps/web/tests/unit/permissions.test.ts
git commit -m "Replace hardcoded index>1 remove-member gate with a real isOwner/self-protection rule"
```

---

### Task 11: Centralize avatar-initials logic into one helper

**Goal:** Add a shared `getInitials(name, email)` helper to `packages/ui/src/lib/utils.ts` (splits on `name` first, falls back to the email's local-part) and use it everywhere an avatar currently derives initials from `email.split(' ')`.

**Files:**
- Modify: `packages/ui/src/lib/utils.ts`, `apps/web/app/(front)/layout.tsx`, `apps/web/app/(dashboard)/dashboard/settings.tsx`, `apps/web/components/nav-user.tsx`
- Test: `apps/web/tests/unit/utils.test.ts`, `apps/web/tests/unit/front-layout-avatar-initials.test.tsx`

**Acceptance Criteria:**
- [ ] `getInitials` never calls `.split(' ')` on an email address.
- [ ] `(front)/layout.tsx`'s header avatar and `dashboard/settings.tsx`'s team-member avatars both use the shared helper.
- [ ] `components/nav-user.tsx`'s existing local `getInitials()` closure is replaced by the shared helper (bonus consistency fix — not explicitly named in the design doc's two call sites, but it duplicates the exact same logic the doc asks to centralize).
- [ ] `pnpm --filter web exec tsc --noEmit` passes (no leftover unused imports/functions).
- [ ] This task runs after Task 10 — it patches only the `AvatarFallback` body of the `settings.tsx` that Task 10 rewrote, not the whole file.

**Verify:** `pnpm --filter web test -- tests/unit/utils.test.ts tests/unit/front-layout-avatar-initials.test.tsx` -> `Test Files 2 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/unit/utils.test.ts (extend the existing file)
import { describe, it, expect } from 'vitest';
import { cn, getInitials } from '@repo/ui/lib/utils';

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

describe('getInitials', () => {
  it('uses the first letter of up to two words in the name', () => {
    expect(getInitials('Jane Doe', 'jane@example.com')).toBe('JD');
  });

  it('uses a single initial for a one-word name', () => {
    expect(getInitials('Cher', 'cher@example.com')).toBe('C');
  });

  it('caps name-derived initials at two letters for a three-word name', () => {
    expect(getInitials('Jane Middle Doe', 'jane@example.com')).toBe('JM');
  });

  it('falls back to the email local-part when no name is present, splitting on separators', () => {
    expect(getInitials(null, 'john.doe@example.com')).toBe('JD');
  });

  it('falls back to the first two characters of the email local-part when it has no separators', () => {
    expect(getInitials(undefined, 'johndoe@example.com')).toBe('JO');
  });

  it('never splits on spaces in the email (the original bug)', () => {
    expect(getInitials(null, 'johndoe@example.com')).not.toBe('J');
  });

  it('returns a placeholder when neither name nor email is usable', () => {
    expect(getInitials(null, null)).toBe('?');
    expect(getInitials('', '')).toBe('?');
  });
});
```

```tsx
// apps/web/tests/unit/front-layout-avatar-initials.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import type { User } from '@repo/db/schema';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} alt={props.alt ?? ''} />,
}));

import Layout from '@/app/(front)/layout';
import { UserProvider } from '@/lib/auth';

describe('(front) layout Header — avatar initials', () => {
  it("shows initials from the user's name, not a single character sliced off the email", async () => {
    const testUser = {
      id: 1,
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
    } as unknown as User;

    render(
      <UserProvider userPromise={Promise.resolve(testUser)}>
        <Suspense fallback={null}>
          <Layout>
            <div />
          </Layout>
        </Suspense>
      </UserProvider>
    );

    expect(await screen.findByText('JD')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/utils.test.ts tests/unit/front-layout-avatar-initials.test.tsx`
Expected: FAIL — `getInitials` is not exported from `packages/ui/src/lib/utils.ts` yet (import error), and the Header test can't find "JD" (current code renders "J", the first character of the email).

- [ ] **Step 3: Write minimal implementation**

Add to `packages/ui/src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Derives up to two display initials for an avatar fallback. Prefers a real
 * name (first letter of up to its first two words); falls back to the
 * email's local-part (first letter of up to two dot/underscore/hyphen/plus
 * -separated segments, or its first two characters if there are no
 * separators). Returns '?' if neither is usable.
 */
export function getInitials(
  name?: string | null,
  email?: string | null
): string {
  const trimmedName = name?.trim()
  if (trimmedName) {
    return trimmedName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("")
  }

  const localPart = email?.trim().split("@")[0] ?? ""
  if (!localPart) return "?"

  const segments = localPart.split(/[._\-+]+/).filter(Boolean)
  if (segments.length > 1) {
    return segments
      .slice(0, 2)
      .map((segment) => segment[0]!.toUpperCase())
      .join("")
  }
  return localPart.slice(0, 2).toUpperCase()
}
```

In `apps/web/app/(front)/layout.tsx`, add the import and replace the fallback body:
```tsx
import { getInitials } from '@repo/ui/lib/utils';
```
```tsx
                <AvatarFallback>
                  {getInitials(user.name, user.email)}
                </AvatarFallback>
```

In `apps/web/app/(dashboard)/dashboard/settings.tsx` (patching the file Task 10 produced), add the import and replace only the `AvatarFallback` body:
```tsx
import { getInitials } from '@repo/ui/lib/utils';
```
```tsx
                    <AvatarFallback>
                      {getInitials(member.user.name, member.user.email)}
                    </AvatarFallback>
```

In `apps/web/components/nav-user.tsx`, remove the local `getInitials` closure and use the shared helper:
```tsx
import { getInitials } from '@repo/ui/lib/utils';
```
```tsx
  const UserAvatar = () => (
    <Avatar className="h-8 w-8 rounded-lg bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500">
      <AvatarFallback className="rounded-lg text-white font-medium">
        {getInitials(user.name, user.email)}
      </AvatarFallback>
    </Avatar>
  );
```
(delete the old inline `const getInitials = () => { ... }` block that preceded `UserAvatar`.)

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/utils.test.ts tests/unit/front-layout-avatar-initials.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add packages/ui/src/lib/utils.ts "apps/web/app/(front)/layout.tsx" "apps/web/app/(dashboard)/dashboard/settings.tsx" apps/web/components/nav-user.tsx apps/web/tests/unit/utils.test.ts apps/web/tests/unit/front-layout-avatar-initials.test.tsx
git commit -m "Centralize avatar-initials logic into a shared getInitials helper"
```

---

### Task 12: Fix empty `priceId` in `tiers.ts` and guard the broken checkout CTA

**Goal:** Replace `priceId: ''` with an explicit `priceId: null` in `tiers.ts`, and make `pricing/page.tsx`'s CTA disable itself instead of silently POSTing an empty `priceId` to Stripe checkout.

**Files:**
- Modify: `packages/db/src/tiers.ts`, `apps/web/app/(front)/pricing/page.tsx`
- Test: `apps/web/tests/unit/tiers.test.ts`, `apps/web/tests/unit/pricing-card-checkout.test.tsx`

**Acceptance Criteria:**
- [ ] No tier has `priceId: ''`; unset tiers use `priceId: null`.
- [ ] When `priceId` is `null`, `PricingCard` renders a disabled "Coming Soon" button and no `<form action={checkoutAction}>` / hidden `priceId` input.
- [ ] When `priceId` is a real string, the existing working checkout form (hidden input + enabled "Get Started" button) still renders.
- [ ] **Open question flagged for the user:** real Stripe `priceId`/`productId` values are still required before checkout can actually work in production — this task only stops the CTA from silently breaking with an empty string; it does not invent or source real Stripe IDs. Confirm the real IDs (or an explicit decision to keep tiers in "Coming Soon" state) before launch.

**Verify:** `pnpm --filter web test -- tests/unit/tiers.test.ts tests/unit/pricing-card-checkout.test.tsx` -> `Test Files 2 passed`, `Tests 5 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/unit/tiers.test.ts
import { describe, it, expect } from 'vitest';
import { tiers } from '@repo/db/tiers';

describe('tiers priceId placeholder', () => {
  it('uses null (not an empty string) for unset Stripe price IDs', () => {
    for (const tier of tiers) {
      expect(tier.priceId).not.toBe('');
      if (tier.priceId !== null) {
        expect(typeof tier.priceId).toBe('string');
      }
    }
  });

  it('has no configured priceId yet for any paid tier (documented placeholder, pending real Stripe IDs)', () => {
    const paidTiers = tiers.filter((t) => t.priceMonthly !== null);
    expect(paidTiers.every((t) => t.priceId === null)).toBe(true);
  });
});
```

```tsx
// apps/web/tests/unit/pricing-card-checkout.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PricingCard } from '@/app/(front)/pricing/page';

const baseTier = {
  name: 'Starter',
  icon: <span />,
  price: 10,
  description: 'For small teams',
  features: ['100 messages per month'],
  color: 'amber',
  messageLimit: 100,
};

describe('PricingCard checkout CTA', () => {
  it('disables the CTA instead of submitting an empty priceId when none is configured', () => {
    render(<PricingCard tier={{ ...baseTier, priceId: null }} />);
    const button = screen.getByRole('button', { name: 'Coming Soon' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(document.querySelector('input[name="priceId"]')).toBeNull();
  });

  it('renders a working checkout form with the hidden priceId input when one is configured', () => {
    render(<PricingCard tier={{ ...baseTier, priceId: 'price_123' }} />);
    const hiddenInput = document.querySelector('input[name="priceId"]') as HTMLInputElement;
    expect(hiddenInput).toBeTruthy();
    expect(hiddenInput.value).toBe('price_123');
    const button = screen.getByRole('button', { name: 'Get Started' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/tiers.test.ts tests/unit/pricing-card-checkout.test.tsx`
Expected: FAIL — `tiers.test.ts` fails because `priceId` is currently `''`, not `null`; `pricing-card-checkout.test.tsx` fails because `PricingCard` is not exported yet and there is no disabled/"Coming Soon" branch.

- [ ] **Step 3: Write minimal implementation**

In `packages/db/src/tiers.ts`:
```ts
// packages/db/src/tiers.ts

export interface Tier {
    id: string;
    name: string;
    href: string;
    priceMonthly: number | null;
    description: string;
    features: string[];
    messageLimit: number;
    productId: string; // Stripe Price ID
    priceId: string | null;
}

export const tiers: Tier[] = [
    {
      id: 'free',
      name: 'Free',
      href: '#',
      priceMonthly: null,
      description: 'For individuals who need to track their work.',
      features: [
        '5 messages per month',
        'Basic features',
      ],
      messageLimit: 5,
      productId: '', // No Price ID for the free tier
      priceId: null
    },
    {
      id: 'starter',
      name: 'Starter',
      href: '#',
      priceMonthly: 10,
      description: 'For small teams who need to collaborate.',
      features: [
        '100 messages per month',
        'All Free tier features',
        'Priority support',
      ],
      messageLimit: 100,
      productId: 'product_...', // Replace with your Starter tier Price ID
      priceId: null
    },
    {
      id: 'pro',
      name: 'Pro',
      href: '#',
      priceMonthly: 30,
      description: 'For large teams who need advanced features.',
      features: [
        'Unlimited messages',
        'All Starter tier features',
        'Dedicated account manager',
      ],
      messageLimit: -1, // -1 represents unlimited
      productId: 'product_...', // Replace with your Pro tier Price ID
      priceId: null
    },
];
```

In `apps/web/app/(front)/pricing/page.tsx`, update the `PricingTier` interface's `priceId` field (leave the rest of the interface, including the pre-existing unused `isFreeTier?: boolean`, untouched):
```tsx
interface PricingTier {
    name: string;
    icon: React.ReactNode;
    price: number | null;
    description: string;
    features: string[];
    popular?: boolean;
    color: string;
    priceId: string | null;
    messageLimit: number;
    isFreeTier?: boolean;
}
```

Export `PricingCard` (add the `export` keyword to its existing declaration):
```tsx
export function PricingCard({
  tier,
  isFreeTier = false,
  index = 0
}: {
  tier: PricingTier;
    isFreeTier?: boolean;
    index?: number;
}) {
```

Replace the paid-tier CTA block:
```tsx
            {!isFreeTier && (
                priceId ? (
                    <form action={checkoutAction}>
                        <input type="hidden" name="priceId" value={priceId} />
                        <Button
                            className={cn(
                                "w-full h-12 font-handwritten text-lg relative",
                                "border-2 border-zinc-900 dark:border-white",
                                "transition-all duration-300",
                                "shadow-[4px_4px_0px_0px] shadow-zinc-900 dark:shadow-white",
                                "hover:shadow-[6px_6px_0px_0px]",
                                "hover:translate-x-[-2px] hover:translate-y-[-2px]",
                                "bg-gradient-to-r from-pink-500 to-purple-500 text-white",
                                "hover:from-pink-400 hover:to-purple-400",
                                "active:from-pink-600 active:to-purple-600",
                            )}
                        >
                            Get Started
                        </Button>
                    </form>
                ) : (
                    <Button
                        disabled
                        className={cn(
                            "w-full h-12 font-handwritten text-lg relative",
                            "border-2 border-zinc-900 dark:border-white",
                            "opacity-50 cursor-not-allowed",
                            "bg-gradient-to-r from-pink-500 to-purple-500 text-white",
                        )}
                    >
                        Coming Soon
                    </Button>
                )
            )}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/tiers.test.ts tests/unit/pricing-card-checkout.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add packages/db/src/tiers.ts "apps/web/app/(front)/pricing/page.tsx" apps/web/tests/unit/tiers.test.ts apps/web/tests/unit/pricing-card-checkout.test.tsx
git commit -m "Replace empty priceId placeholder with null and disable checkout CTA until real Stripe IDs exist"
```

---

### Task 13: Make `get-token` reachable from the dashboard nav

**Goal:** Extract the sidebar's nav-item list into a testable pure function and add a "Get Token" entry so `/dashboard/get-token` is reachable without typing the URL by hand.

**Files:**
- Create: `apps/web/lib/navigation/dashboard-nav-items.ts`
- Modify: `apps/web/components/app-sidebar.tsx`
- Test: `apps/web/tests/unit/dashboard-nav-items.test.ts`

**Acceptance Criteria:**
- [ ] `getDashboardNavItems` returns an entry with `url: '/dashboard/get-token'` and `title: 'Get Token'`.
- [ ] That entry's `isActive` is `true` when the current pathname is `/dashboard/get-token`.
- [ ] `components/app-sidebar.tsx` renders its nav items from `getDashboardNavItems` instead of an inline array.
- [ ] **Open question flagged for the user:** the design doc leaves `get-token/page.tsx`'s reachability as an open product decision ("add nav entry or delete"). This task takes the mechanical default (add a nav entry, since the page's `/api/token` flow is functional and worth keeping reachable) — confirm before/during execution whether the page should be deleted instead.

**Verify:** `pnpm --filter web test -- tests/unit/dashboard-nav-items.test.ts` -> `Test Files 1 passed`, `Tests 3 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```ts
// apps/web/tests/unit/dashboard-nav-items.test.ts
import { describe, it, expect } from 'vitest';
import { getDashboardNavItems } from '@/lib/navigation/dashboard-nav-items';

describe('getDashboardNavItems', () => {
  it('includes a reachable Get Token nav entry', () => {
    const items = getDashboardNavItems('/dashboard/workflow');
    const getTokenItem = items.find((item) => item.url === '/dashboard/get-token');
    expect(getTokenItem).toBeDefined();
    expect(getTokenItem?.title).toBe('Get Token');
  });

  it('marks the Get Token entry active when the pathname matches', () => {
    const items = getDashboardNavItems('/dashboard/get-token');
    const getTokenItem = items.find((item) => item.url === '/dashboard/get-token');
    expect(getTokenItem?.isActive).toBe(true);
  });

  it('still includes all seven previously existing nav entries', () => {
    const items = getDashboardNavItems('/dashboard');
    expect(items.map((i) => i.url)).toEqual(
      expect.arrayContaining([
        '/dashboard/workflow',
        '/dashboard/chatbot',
        '/dashboard/streaming',
        '/dashboard/team',
        '/dashboard/general',
        '/dashboard/activity',
        '/dashboard/security',
      ])
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/dashboard-nav-items.test.ts`
Expected: FAIL with `Cannot find module '@/lib/navigation/dashboard-nav-items'`.

- [ ] **Step 3: Write minimal implementation**
```ts
// apps/web/lib/navigation/dashboard-nav-items.ts
import {
  Activity,
  BotIcon,
  GemIcon,
  KeyRound,
  MessageCircle,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface DashboardNavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive: boolean;
}

export function getDashboardNavItems(pathname: string): DashboardNavItem[] {
  return [
    {
      title: 'Workflow',
      url: '/dashboard/workflow',
      icon: GemIcon,
      isActive: pathname.startsWith('/dashboard/workflow'),
    },
    {
      title: 'Chatbot',
      url: '/dashboard/chatbot',
      icon: BotIcon,
      isActive: pathname.startsWith('/dashboard/chatbot'),
    },
    {
      title: 'Streaming',
      url: '/dashboard/streaming',
      icon: MessageCircle,
      isActive: pathname.startsWith('/dashboard/streaming'),
    },
    {
      title: 'Get Token',
      url: '/dashboard/get-token',
      icon: KeyRound,
      isActive: pathname.startsWith('/dashboard/get-token'),
    },
    {
      title: 'Team',
      url: '/dashboard/team',
      icon: Users,
      isActive: pathname.startsWith('/dashboard/team'),
    },
    {
      title: 'General',
      url: '/dashboard/general',
      icon: Settings,
      isActive: pathname.startsWith('/dashboard/general'),
    },
    {
      title: 'Activity',
      url: '/dashboard/activity',
      icon: Activity,
      isActive: pathname.startsWith('/dashboard/activity'),
    },
    {
      title: 'Security',
      url: '/dashboard/security',
      icon: Shield,
      isActive: pathname.startsWith('/dashboard/security'),
    },
  ];
}
```

```tsx
// apps/web/components/app-sidebar.tsx
'use client';
import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@repo/ui/components/sidebar';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/logo';
import { SubscriptionStatus } from '@/components/subscription-status';
import { getDashboardNavItems } from '@/lib/navigation/dashboard-nav-items';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const navItems = getDashboardNavItems(pathname);

  return (
    <Sidebar 
      className="hidden lg:block transition-all duration-300 ease-in-out"
      {...props}
    >
      <SidebarHeader className="py-4 flex flex-col items-center">
        <Logo /> 
      </SidebarHeader>
      <SidebarContent className="flex flex-col flex-1">
        <div className="flex-1">
          <NavMain items={navItems} />
        </div>
        <div className="mt-2">
          <SubscriptionStatus />
        </div>
        <SidebarFooter className="mt-auto">
          <NavUser />
        </SidebarFooter>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/dashboard-nav-items.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**
```bash
git add apps/web/lib/navigation/dashboard-nav-items.ts apps/web/components/app-sidebar.tsx apps/web/tests/unit/dashboard-nav-items.test.ts
git commit -m "Add a Get Token sidebar nav entry so the page is reachable without typing the URL"
```

---

### Task 14: Collapse the `dashboard/team` duplicate of root `/dashboard`

**Goal:** Stop `/dashboard/team` from re-rendering the exact same `Settings` component tree as root `/dashboard`; redirect to the canonical route instead.

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/team/page.tsx`
- Test: `apps/web/tests/e2e/dashboard-routes.spec.ts`

**Acceptance Criteria:**
- [ ] Navigating to `/dashboard/team` lands the browser on `/dashboard` (no duplicate render).
- [ ] The sidebar's "Team" nav link still works end-to-end (sign in -> click Team -> arrives at the team/settings content).
- [ ] **Open question flagged for the user:** the design doc leaves this duplicate route as an open product decision ("distinct page, or collapse the duplicate route"). This task takes the mechanical default (collapse into a redirect, since the two routes render byte-identical content today) — confirm before/during execution whether `/dashboard/team` should instead become its own distinct page.

**Verify:** `pnpm --filter web test:e2e -- tests/e2e/dashboard-routes.spec.ts` -> `1 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```ts
// apps/web/tests/e2e/dashboard-routes.spec.ts
import { test, expect } from '@playwright/test';

test.describe('dashboard/team route', () => {
  test('redirects to the canonical /dashboard route instead of duplicating it', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill('test@test.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    await page.goto('/dashboard/team');
    await expect(page).toHaveURL(/\/dashboard\/?$/, { timeout: 15000 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test:e2e -- tests/e2e/dashboard-routes.spec.ts`
Expected: FAIL — URL stays `**/dashboard/team`, assertion on `/\/dashboard\/?$/` times out.

- [ ] **Step 3: Write minimal implementation**
```tsx
// apps/web/app/(dashboard)/dashboard/team/page.tsx
import { redirect } from 'next/navigation';

export default function TeamSettingsRedirect() {
  redirect('/dashboard');
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test:e2e -- tests/e2e/dashboard-routes.spec.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**
```bash
git add "apps/web/app/(dashboard)/dashboard/team/page.tsx" apps/web/tests/e2e/dashboard-routes.spec.ts
git commit -m "Collapse dashboard/team into a redirect instead of duplicating root /dashboard"
```

---

### Task 15: Restore `Avatar`'s original 40px footprint in `dashboard/settings.tsx`

**Goal:** The Phase-1 shadcn regen shrank `Avatar`'s default size from `h-10 w-10` (40px) to `size-8` (32px), though it kept a `size` prop (`"default" | "sm" | "lg"`) that can restore it. Override it at the one bare call site that relied on the old default.

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/settings.tsx`
- Test: `apps/web/tests/unit/settings-avatar-size.test.tsx`

**Acceptance Criteria:**
- [ ] The team-member list's `<Avatar>` renders with `data-size="lg"` (the `size-10` / 40px variant), matching the pre-regen default.
- [ ] No other `Avatar` call sites are touched.
- [ ] This task runs after Tasks 10 and 11 — it patches only the `<Avatar>` tag of the `settings.tsx` those two tasks left behind.

**Verify:** `pnpm --filter web test -- tests/unit/settings-avatar-size.test.tsx` -> `Test Files 1 passed`, `Tests 1 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/settings-avatar-size.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Settings } from '@/app/(dashboard)/dashboard/settings';
import type { TeamDataWithMembers } from '@repo/db/schema';

const teamData = {
  id: 1,
  name: 'Acme',
  planName: 'Free',
  subscriptionStatus: null,
  teamMembers: [
    { id: 1, role: 'owner', user: { id: 1, name: 'Jane Doe', email: 'jane@example.com' } },
  ],
} as unknown as TeamDataWithMembers;

describe('Settings team-member avatar size', () => {
  it('overrides the shrunk shadcn default so it still renders at the original 40px (size-10) footprint', () => {
    const { container } = render(<Settings teamData={teamData} />);
    const avatar = container.querySelector('[data-slot="avatar"]') as HTMLElement;
    expect(avatar).toBeTruthy();
    expect(avatar.getAttribute('data-size')).toBe('lg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/settings-avatar-size.test.tsx`
Expected: FAIL — `data-size` is currently `"default"` (32px), not `"lg"`.

- [ ] **Step 3: Write minimal implementation**

In `apps/web/app/(dashboard)/dashboard/settings.tsx`, add `size="lg"` to the one `<Avatar>` tag:
```tsx
                <div className="flex items-center space-x-4">
                  <Avatar size="lg">
                    <AvatarImage
                      src={`/placeholder.svg?height=32&width=32`}
                      alt={getUserDisplayName(member.user)}
                    />
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/settings-avatar-size.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add "apps/web/app/(dashboard)/dashboard/settings.tsx" apps/web/tests/unit/settings-avatar-size.test.tsx
git commit -m "Restore original 40px Avatar footprint in team-member list via size=lg override"
```

---

### Task 16: Restore `CardTitle`/`CardDescription` semantic tags

**Goal:** The Phase-1 shadcn regen changed `CardTitle`/`CardDescription` from `h3`/`p` to `div`, breaking the heading hierarchy on every dashboard page that pairs a page `<h1>` with `CardTitle`s underneath (confirmed live in `activity`, `security`, `general`, `settings`, and `invite-team.tsx` — five call sites, cross-checked against the live repo). Restore the semantic tags.

**Files:**
- Modify: `packages/ui/src/components/card.tsx`
- Test: `apps/web/tests/unit/card-semantics.test.tsx`

**Acceptance Criteria:**
- [ ] `CardTitle` renders as an `<h3>`.
- [ ] `CardDescription` renders as a `<p>`.
- [ ] All existing `CardTitle`/`CardDescription` call sites (`activity/page.tsx`, `security/page.tsx`, `general/page.tsx`, `settings.tsx`, `invite-team.tsx`) still compile with no prop changes needed.

**Verify:** `pnpm --filter web test -- tests/unit/card-semantics.test.tsx` -> `Test Files 1 passed`, `Tests 2 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/card-semantics.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription } from '@repo/ui/components/card';

describe('Card heading semantics', () => {
  it('renders CardTitle as an <h3> so dashboard cards keep a real heading in the accessibility tree', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Team Settings</CardTitle>
        </CardHeader>
      </Card>
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Team Settings' })).toBeTruthy();
  });

  it('renders CardDescription as a <p>', () => {
    render(<CardDescription>Some description</CardDescription>);
    const el = screen.getByText('Some description');
    expect(el.tagName).toBe('P');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/card-semantics.test.tsx`
Expected: FAIL — both currently render as `<div>`, so no `heading` role exists and `tagName` is `DIV`.

- [ ] **Step 3: Write minimal implementation**

In `packages/ui/src/components/card.tsx`:
```tsx
function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/card-semantics.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add packages/ui/src/components/card.tsx apps/web/tests/unit/card-semantics.test.tsx
git commit -m "Restore CardTitle/CardDescription semantic h3/p tags lost in the shadcn regen"
```

---

### Task 17: Restore `SheetTitle`'s `text-lg` class

**Goal:** The Phase-1 shadcn regen dropped `text-lg` from `SheetTitle`, visibly shrinking `WorkflowHistoryDrawer.tsx`'s "Workflow History" title (the sidebar's own `SheetTitle` usage is `sr-only`, so unaffected visually, but the primitive fix covers both).

**Files:**
- Modify: `packages/ui/src/components/sheet.tsx`
- Test: `apps/web/tests/unit/sheet-title-size.test.tsx`

**Acceptance Criteria:**
- [ ] `SheetTitle` renders with a `text-lg` class.
- [ ] `WorkflowHistoryDrawer.tsx` and `sidebar.tsx`'s existing `SheetTitle` usages need no code changes (primitive-level fix only).

**Verify:** `pnpm --filter web test -- tests/unit/sheet-title-size.test.tsx` -> `Test Files 1 passed`, `Tests 1 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/sheet-title-size.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@repo/ui/components/sheet';

describe('SheetTitle default size', () => {
  it('keeps the text-lg class the current shadcn registry default dropped', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Workflow History</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
    const title = screen.getByText('Workflow History');
    expect(title.className).toContain('text-lg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/sheet-title-size.test.tsx`
Expected: FAIL — current `SheetTitle` className is only `"font-semibold text-foreground"`, no `text-lg`.

- [ ] **Step 3: Write minimal implementation**

In `packages/ui/src/components/sheet.tsx`:
```tsx
function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/sheet-title-size.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add packages/ui/src/components/sheet.tsx apps/web/tests/unit/sheet-title-size.test.tsx
git commit -m "Restore SheetTitle's text-lg class lost in the shadcn regen"
```

---

### Task 18: Restore `TooltipContent`'s brand colors

**Goal:** The Phase-1 shadcn regen flipped `TooltipContent` from brand-colored (`bg-primary`/`text-primary-foreground`) to neutral (`bg-foreground`/`text-background`). Restore the brand colors before the sidebar's first real `tooltip=` call site is added.

**Files:**
- Modify: `packages/ui/src/components/tooltip.tsx`
- Test: `apps/web/tests/unit/tooltip-colors.test.tsx`

**Acceptance Criteria:**
- [ ] `TooltipContent` renders with `bg-primary` and `text-primary-foreground`.
- [ ] Confirmed via a fresh sweep of the live repo (not just trusted from the design doc): no `SidebarMenuButton` currently passes a `tooltip` prop, so this is genuinely a currently-inert code path today — this fix is preventative, not a visible regression fix.

**Verify:** `pnpm --filter web test -- tests/unit/tooltip-colors.test.tsx` -> `Test Files 1 passed`, `Tests 1 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/tooltip-colors.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@repo/ui/components/tooltip';

describe('TooltipContent brand colors', () => {
  it('restores the brand-colored background instead of the neutral shadcn-registry default', () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    const content = screen.getByText('Hint');
    expect(content.className).toContain('bg-primary');
    expect(content.className).toContain('text-primary-foreground');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/tooltip-colors.test.tsx`
Expected: FAIL — current classes are `bg-foreground`/`text-background`, not `bg-primary`/`text-primary-foreground`.

- [ ] **Step 3: Write minimal implementation**

In `packages/ui/src/components/tooltip.tsx`:
```tsx
        className={cn(
          "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-primary px-3 py-1.5 text-xs text-balance text-primary-foreground fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-primary fill-primary" />
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/tooltip-colors.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add packages/ui/src/components/tooltip.tsx apps/web/tests/unit/tooltip-colors.test.tsx
git commit -m "Restore TooltipContent's brand colors lost in the shadcn regen"
```

---

### Task 19: Restore `Skeleton`'s brand-tinted background

**Goal:** The Phase-1 shadcn regen changed `Skeleton`'s background from `bg-primary/10` to neutral `bg-accent`. Restore it before `SidebarMenuSkeleton` gets a real call site.

**Files:**
- Modify: `packages/ui/src/components/skeleton.tsx`
- Test: `apps/web/tests/unit/skeleton-color.test.tsx`

**Acceptance Criteria:**
- [ ] `Skeleton` renders with `bg-primary/10`.
- [ ] Confirmed via a fresh sweep: `SidebarMenuSkeleton` (the only consumer of `Skeleton` today) is never invoked anywhere in `app-sidebar.tsx` or elsewhere, so this is genuinely inert today, matching the design doc's characterization.

**Verify:** `pnpm --filter web test -- tests/unit/skeleton-color.test.tsx` -> `Test Files 1 passed`, `Tests 1 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/skeleton-color.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from '@repo/ui/components/skeleton';

describe('Skeleton background color', () => {
  it('restores the brand-tinted bg-primary/10 instead of the neutral bg-accent default', () => {
    const { container } = render(<Skeleton />);
    const el = container.querySelector('[data-slot="skeleton"]') as HTMLElement;
    expect(el.className).toContain('bg-primary/10');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/skeleton-color.test.tsx`
Expected: FAIL — current class is `bg-accent`, not `bg-primary/10`.

- [ ] **Step 3: Write minimal implementation**

In `packages/ui/src/components/skeleton.tsx`:
```tsx
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  )
}

export { Skeleton }
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/skeleton-color.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add packages/ui/src/components/skeleton.tsx apps/web/tests/unit/skeleton-color.test.tsx
git commit -m "Restore Skeleton's brand-tinted bg-primary/10 background lost in the shadcn regen"
```

---

### Task 20: Restore `RadioGroupItem`'s unchecked border color

**Goal:** The Phase-1 shadcn regen changed `RadioGroupItem`'s unchecked border from `border-primary` to `border-input`. This is confirmed **live today** in `invite-team.tsx`'s role picker — correcting the design doc's blanket "not yet exercised anywhere" characterization, which a fresh sweep shows does not hold for this component.

**Files:**
- Modify: `packages/ui/src/components/radio-group.tsx`
- Test: `apps/web/tests/unit/radio-group-colors.test.tsx`

**Acceptance Criteria:**
- [ ] `RadioGroupItem` renders with `border-primary` on its root element.
- [ ] `invite-team.tsx`'s member/owner role radios (the one real, live call site) need no code changes.

**Verify:** `pnpm --filter web test -- tests/unit/radio-group-colors.test.tsx` -> `Test Files 1 passed`, `Tests 1 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/radio-group-colors.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RadioGroup, RadioGroupItem } from '@repo/ui/components/radio-group';

describe('RadioGroupItem unchecked border color', () => {
  it('restores border-primary so the invite-team role picker keeps its original look (live call site, not dead code)', () => {
    const { container } = render(
      <RadioGroup defaultValue="member">
        <RadioGroupItem value="member" />
      </RadioGroup>
    );
    const item = container.querySelector('[data-slot="radio-group-item"]') as HTMLElement;
    expect(item.className).toContain('border-primary');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/radio-group-colors.test.tsx`
Expected: FAIL — current class is `border-input`, not `border-primary`.

- [ ] **Step 3: Write minimal implementation**

In `packages/ui/src/components/radio-group.tsx`:
```tsx
      className={cn(
        "aspect-square size-4 shrink-0 rounded-full border border-primary text-primary shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
        className
      )}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/radio-group-colors.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add packages/ui/src/components/radio-group.tsx apps/web/tests/unit/radio-group-colors.test.tsx
git commit -m "Restore RadioGroupItem's border-primary (live in invite-team.tsx's role picker, not dead code)"
```

---

### Task 21: Restore `DropdownMenuSeparator`'s color

**Goal:** The Phase-1 shadcn regen changed `DropdownMenuSeparator` from `bg-muted` to `bg-border`. This is confirmed **live today** in `nav-user.tsx`'s user menu (used twice) — correcting the design doc's blanket "not yet exercised anywhere" characterization for this component too.

**Files:**
- Modify: `packages/ui/src/components/dropdown-menu.tsx`
- Test: `apps/web/tests/unit/dropdown-menu-separator-color.test.tsx`

**Acceptance Criteria:**
- [ ] `DropdownMenuSeparator` renders with `bg-muted`.
- [ ] `nav-user.tsx`'s two separators (the real, live call site) need no code changes.

**Verify:** `pnpm --filter web test -- tests/unit/dropdown-menu-separator-color.test.tsx` -> `Test Files 1 passed`, `Tests 1 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/dropdown-menu-separator-color.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';

describe('DropdownMenuSeparator color', () => {
  it('restores bg-muted so the nav-user menu divider keeps its original look (live call site, not dead code)', () => {
    const { baseElement } = render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Item 2</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    const separator = baseElement.querySelector('[data-slot="dropdown-menu-separator"]') as HTMLElement;
    expect(separator).toBeTruthy();
    expect(separator.className).toContain('bg-muted');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/dropdown-menu-separator-color.test.tsx`
Expected: FAIL — current class is `bg-border`, not `bg-muted`.

- [ ] **Step 3: Write minimal implementation**

In `packages/ui/src/components/dropdown-menu.tsx`:
```tsx
function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-muted", className)}
      {...props}
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/dropdown-menu-separator-color.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add packages/ui/src/components/dropdown-menu.tsx apps/web/tests/unit/dropdown-menu-separator-color.test.tsx
git commit -m "Restore DropdownMenuSeparator's bg-muted (live in nav-user.tsx's user menu, not dead code)"
```

---

### Task 22: Restore `Button` variants' shadow depth

**Goal:** The Phase-1 shadcn regen dropped `shadow`/`shadow-sm` depth from most stock `Button` variants. `Button` is the single most-used component in this app (landing CTAs, all dashboard forms, nav menus) — correcting the design doc's characterization of this as a "not-yet-exercised-anywhere" item, which a fresh sweep shows is clearly wrong for `Button` specifically.

**Files:**
- Modify: `packages/ui/src/components/button.tsx`
- Test: `apps/web/tests/unit/button-shadow.test.tsx`

**Acceptance Criteria:**
- [ ] `default`, `secondary`, and `destructive` variants all include `shadow-xs` (matching `outline`, which already has it and was never regressed).
- [ ] `ghost` and `link` variants remain flat (no shadow), matching original shadcn convention.
- [ ] **Open question flagged for the user:** restoring the shadow is a visual-depth preference, not a functional bug — confirm the flatter, shadow-less look introduced by the registry regen isn't the intentionally preferred new direction before merging this change app-wide.

**Verify:** `pnpm --filter web test -- tests/unit/button-shadow.test.tsx` -> `Test Files 1 passed`, `Tests 3 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/button-shadow.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@repo/ui/components/button';

describe('Button variant shadow depth', () => {
  it('restores shadow-xs on the default variant', () => {
    render(<Button>Default</Button>);
    expect(screen.getByRole('button', { name: 'Default' }).className).toContain('shadow-xs');
  });

  it('restores shadow-xs on the secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button', { name: 'Secondary' }).className).toContain('shadow-xs');
  });

  it('restores shadow-xs on the destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('shadow-xs');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/button-shadow.test.tsx`
Expected: FAIL — none of `default`/`secondary`/`destructive` currently include `shadow-xs`.

- [ ] **Step 3: Write minimal implementation**

In `packages/ui/src/components/button.tsx`:
```tsx
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/button-shadow.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add packages/ui/src/components/button.tsx apps/web/tests/unit/button-shadow.test.tsx
git commit -m "Restore shadow-xs on default/secondary/destructive Button variants"
```

---

### Task 23: Rebuild the Chatbot page onto the shared `Card`

**Goal:** Replace the mismatched "AI Story Generator" hero heading and no-op `glass-morphism` panel on `/dashboard/chatbot` with the same `Card` + header pattern used by `general`/`activity`/`security`/`team`. This is the first of six tasks reconciling the dashboard's two divergent visual languages — the biggest diff in this plan, verified manually per-page per the Testing Strategy.

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/chatbot/page.tsx`
- Test: `apps/web/tests/unit/chatbot-page.test.tsx`

**Acceptance Criteria:**
- [ ] Page renders a `[data-slot="card"]` element and contains no `.glass-morphism` element.
- [ ] Page heading is `<h1>Chatbot</h1>`, matching the `general`/`activity` header pattern.
- [ ] The embedded iframe's `src` is unchanged.
- [ ] The dead `next/link` import is removed.

**Verify:** `pnpm --filter web test -- tests/unit/chatbot-page.test.tsx && pnpm --filter web build` -> `Tests 4 passed`, build succeeds

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/chatbot-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import Chatbot from '@/app/(dashboard)/dashboard/chatbot/page';

describe('Chatbot dashboard page', () => {
  it('renders the shared Card primitive instead of a hand-rolled glass-morphism panel', () => {
    const { container } = render(<Chatbot />);
    expect(container.querySelector('[data-slot="card"]')).toBeTruthy();
    expect(container.querySelector('.glass-morphism')).toBeNull();
  });

  it('uses the consistent dashboard header pattern instead of the mismatched hero heading', () => {
    render(<Chatbot />);
    expect(screen.getByRole('heading', { name: 'Chatbot', level: 1 })).toBeTruthy();
  });

  it('still embeds the AI Story Generator iframe', () => {
    const { container } = render(<Chatbot />);
    const iframe = container.querySelector('iframe');
    expect(iframe?.getAttribute('src')).toContain('aitutor-api.vercel.app/embed/chatbot');
  });

  it('no longer imports the unused next/link module', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'app/(dashboard)/dashboard/chatbot/page.tsx'),
      'utf-8'
    );
    expect(source).not.toMatch(/from ['"]next\/link['"]/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/chatbot-page.test.tsx`
Expected: FAIL — `[data-slot="card"]` not found, heading `Chatbot` not found, `.glass-morphism` element present, source still imports `next/link`.

- [ ] **Step 3: Write minimal implementation**
```tsx
// apps/web/app/(dashboard)/dashboard/chatbot/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';

export default function Chatbot() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Chatbot
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>AI Story Generator</CardTitle>
        </CardHeader>
        <CardContent>
          <iframe
            src="https://aitutor-api.vercel.app/embed/chatbot/cm6w0fkel0001vfbweh9y6j1a"
            title="AI Story Generator chatbot"
            className="w-full h-[600px] rounded-lg border"
          />
        </CardContent>
      </Card>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/chatbot-page.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**
```bash
git add "apps/web/app/(dashboard)/dashboard/chatbot/page.tsx" apps/web/tests/unit/chatbot-page.test.tsx
git commit -m "Rebuild chatbot page onto the shared Card, dropping the mismatched hero heading"
```

---

### Task 24: Fix `StoryDisplay.tsx`'s glass-morphism panel and no-op `prose` classes

**Goal:** Rebuild the story-result panel onto the shared `Card`, and drop the `prose`/`prose-lg` classes (no `@tailwindcss/typography` plugin is installed, so they are currently invisible to Tailwind) in favor of concrete utility classes that reproduce the same look. This component is rendered by the Workflow page (Task 25), so it must be fixed first.

**Files:**
- Modify: `apps/web/components/ai-tutor-api/StoryDisplay.tsx`
- Test: `apps/web/tests/unit/story-display.test.tsx`

**Acceptance Criteria:**
- [ ] Component renders a `[data-slot="card"]` element and no `.glass-morphism` element.
- [ ] The rendered content container no longer has the `prose` class.
- [ ] Rendered markdown (headings, paragraphs) still displays with the same visual hierarchy via explicit utility classes.

**Verify:** `pnpm --filter web test -- tests/unit/story-display.test.tsx` -> `Test Files 1 passed`, `Tests 2 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/story-display.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import StoryDisplay from '@/components/ai-tutor-api/StoryDisplay';

describe('StoryDisplay', () => {
  it('renders the shared Card primitive instead of a glass-morphism panel', async () => {
    const { container } = render(<StoryDisplay result={{ result: '# Hello\n\nA story.' }} />);
    await waitFor(() => {
      expect(container.querySelector('[data-slot="card"]')).toBeTruthy();
    });
    expect(container.querySelector('.glass-morphism')).toBeNull();
  });

  it('drops the no-op prose classes', () => {
    const { container } = render(<StoryDisplay result={{ result: 'A story.' }} />);
    const content = container.querySelector('.story-content');
    expect(content?.className).not.toMatch(/\bprose\b/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/story-display.test.tsx`
Expected: FAIL — `[data-slot="card"]` not found, `.glass-morphism` element present, `.story-content` className still matches `/\bprose\b/`.

- [ ] **Step 3: Write minimal implementation**
```tsx
// apps/web/components/ai-tutor-api/StoryDisplay.tsx
"use client";
import { marked } from 'marked';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';

interface StoryDisplayProps {
  result: {
    result?: string;
    success?: boolean;
  };
}

export default function StoryDisplay({ result }: StoryDisplayProps) {
    const [formattedResult, setFormattedResult] = useState('');

    useEffect(() => {
        if (result && result.result) {
            const parser = new marked.Parser();
            const lexer = new marked.Lexer();

            try {
                const tokens = lexer.lex(result.result);
                const htmlContent = parser.parse(tokens);
                setFormattedResult(htmlContent);
            } catch (error) {
                console.error('Error parsing markdown:', error);
                setFormattedResult('Error formatting the story.');
            }
        }
    }, [result]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Generated Story</CardTitle>
            </CardHeader>
            <CardContent>
                <div
                    className="story-content max-w-none text-gray-600 leading-[1.8] [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
                    dangerouslySetInnerHTML={{ __html: formattedResult }}
                />
            </CardContent>
        </Card>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/story-display.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**
```bash
git add apps/web/components/ai-tutor-api/StoryDisplay.tsx apps/web/tests/unit/story-display.test.tsx
git commit -m "Rebuild StoryDisplay onto the shared Card and drop no-op prose classes"
```

---

### Task 25: Rebuild the Workflow page onto shared `Card`/`Button`/`Input`/`Label`

**Goal:** Replace the mismatched hero heading, `glass-morphism` panel, and raw `<input>`/`<button>` on `/dashboard/workflow` with the shared UI kit, matching the `general`/`activity` header pattern.

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/workflow/page.tsx`
- Test: `apps/web/tests/unit/workflow-page.test.tsx`

**Acceptance Criteria:**
- [ ] Page renders `[data-slot="card"]`, `[data-slot="input"]`, and `[data-slot="button"]` elements, and no `.glass-morphism` element.
- [ ] Submitting the story form still POSTs to `/api/run` and renders the result via `StoryDisplay`.
- [ ] The dead `next/link` import is removed.

**Verify:** `pnpm --filter web test -- tests/unit/workflow-page.test.tsx && pnpm --filter web build` -> `Tests 3 passed`, build succeeds

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/workflow-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Workflow from '@/app/(dashboard)/dashboard/workflow/page';

vi.mock('@/components/workflow/WorkflowHistoryDrawer', () => ({
  WorkflowHistoryDrawer: () => null,
}));

describe('Workflow dashboard page', () => {
  it('renders the shared Card/Input/Button primitives instead of raw elements', () => {
    const { container } = render(<Workflow />);
    expect(container.querySelector('[data-slot="card"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="input"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="button"]')).toBeTruthy();
    expect(container.querySelector('.glass-morphism')).toBeNull();
  });

  it('still submits the story prompt to /api/run and renders the result', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'Once upon a time.' }),
    }) as unknown as typeof fetch;

    render(<Workflow />);
    fireEvent.change(screen.getByLabelText('Enter your story prompt'), {
      target: { value: 'a magical forest' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate story/i }));

    await waitFor(() => {
      expect(screen.getByText(/once upon a time/i)).toBeTruthy();
    });
  });

  it('no longer imports the unused next/link module', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'app/(dashboard)/dashboard/workflow/page.tsx'),
      'utf-8'
    );
    expect(source).not.toMatch(/from ['"]next\/link['"]/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/workflow-page.test.tsx`
Expected: FAIL — `[data-slot="input"]`/`[data-slot="button"]` not found (raw `<input>`/`<button>` used instead), `.glass-morphism` element present, source still imports `next/link`.

- [ ] **Step 3: Write minimal implementation**
```tsx
// apps/web/app/(dashboard)/dashboard/workflow/page.tsx
"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Loader2 } from 'lucide-react';
import StoryDisplay from '@/components/ai-tutor-api/StoryDisplay';
import { WorkflowHistoryDrawer } from '@/components/workflow/WorkflowHistoryDrawer';

export default function Workflow() {
    const [story, setStory] = useState('');
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!story.trim()) {
            setError('Please enter a story');
            return;
        }
        setError('');
        setLoading(true);
        setResult(null);

        try {
            const response = await fetch('/api/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ story }),
            });

            const data = await response.json();

            if (response.ok) {
                setResult(data);
                setError('');
            } else {
                setError(data.error || 'An error occurred while fetching the story.');
            }
        } catch (err) {
            setError('An error occurred while fetching the story.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectHistory = (input: string, output: string) => {
        setStory(input);
        try {
            const outputData = typeof output === 'string' ? JSON.parse(output) : output;
            setResult(outputData);
        } catch (err) {
            setResult({ result: output });
        }
    };

    return (
        <section className="flex-1 p-4 lg:p-8">
            <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
                Workflow
            </h1>
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Generate a Story</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center">
                                <Label htmlFor="story">Enter your story prompt</Label>
                                <WorkflowHistoryDrawer onSelectHistory={handleSelectHistory} />
                            </div>
                            <Input
                                id="story"
                                type="text"
                                value={story}
                                onChange={(e) => setStory(e.target.value)}
                                placeholder="E.g., Tell me a story about a magical forest..."
                            />
                        </div>
                        {error && (
                            <p className="text-sm text-red-500" role="alert">{error}</p>
                        )}
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                'Generate Story'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {result && <StoryDisplay result={result} />}
        </section>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/workflow-page.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**
```bash
git add "apps/web/app/(dashboard)/dashboard/workflow/page.tsx" apps/web/tests/unit/workflow-page.test.tsx
git commit -m "Rebuild workflow page onto shared Card/Input/Button, dropping the mismatched hero heading"
```

---

### Task 26: Rebuild `StreamingChat.tsx` onto shared `Input`/`Button`, add empty state and `aria-label`

**Goal:** Replace the raw `<input>`/`<button>` (no `focus-visible` styling) with the shared UI kit, add an empty state for the message list, and add an `aria-label` to the message input. This component still uses `ai/react`'s legacy `useChat` (per Phase 1's decision to freeze `ai` at `4.3.19`) — that is untouched here, only the markup changes.

**Files:**
- Modify: `apps/web/components/ai-tutor-api/StreamingChat.tsx`
- Modify: `apps/web/tests/e2e/chatbot.spec.ts`
- Test: `apps/web/tests/unit/streaming-chat.test.tsx`

**Acceptance Criteria:**
- [ ] Component renders `[data-slot="input"]` and `[data-slot="button"]` elements.
- [ ] The message input has an accessible label ("Chat message").
- [ ] Before any message is sent, an empty state ("No messages yet") is shown instead of a blank scroll area.
- [ ] `tests/e2e/chatbot.spec.ts`'s assistant-message locator is updated to match the new markup.

**Verify:** `pnpm --filter web test -- tests/unit/streaming-chat.test.tsx && pnpm --filter web build` -> `Tests 3 passed`, build succeeds

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/streaming-chat.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StreamingChat from '@/components/ai-tutor-api/StreamingChat';

describe('StreamingChat', () => {
  it('renders the shared Input/Button primitives instead of raw elements', () => {
    const { container } = render(<StreamingChat />);
    expect(container.querySelector('[data-slot="input"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="button"]')).toBeTruthy();
  });

  it('labels the message input for screen readers', () => {
    render(<StreamingChat />);
    expect(screen.getByLabelText('Chat message')).toBeTruthy();
  });

  it('shows an empty state before any message has been sent', () => {
    render(<StreamingChat />);
    expect(screen.getByText('No messages yet')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/streaming-chat.test.tsx`
Expected: FAIL — `[data-slot="input"]`/`[data-slot="button"]` not found, no element labeled "Chat message", no "No messages yet" text.

- [ ] **Step 3: Write minimal implementation**
```tsx
// apps/web/components/ai-tutor-api/StreamingChat.tsx
'use client';

import { useChat, Message } from 'ai/react';
import { Input } from '@repo/ui/components/input';
import { Button } from '@repo/ui/components/button';
import { Loader2, MessageCircle } from 'lucide-react';

export default function StreamingChat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat', // Use local API route instead of external URL
    keepLastMessageOnError: true,
  });

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No messages yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Send a message below to start streaming a conversation.
            </p>
          </div>
        ) : (
          messages.map((message: Message) => (
            <div
              key={message.id}
              data-role={message.role}
              className={`p-4 rounded-lg ${
                message.role === 'user'
                  ? 'bg-purple-100 ml-8'
                  : 'bg-muted mr-8'
              }`}
            >
              <div className="font-semibold mb-1">
                {message.role === 'user' ? 'You:' : 'AI:'}
              </div>
              <div className="text-gray-700">{message.content}</div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t">
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
          aria-label="Chat message"
          className="flex-1"
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            'Send'
          )}
        </Button>
      </form>
    </div>
  );
}
```

Then update the existing e2e spec's now-stale class-based locator (the `bg-white/50 mr-8` combo no longer exists — replaced with `bg-muted mr-8` plus the new `data-role` attribute):
```ts
// apps/web/tests/e2e/chatbot.spec.ts (change only the final assertion line)
    await expect(page.locator('[data-role="assistant"]').last()).toContainText(/.+/, { timeout: 15000 });
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/streaming-chat.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**
```bash
git add apps/web/components/ai-tutor-api/StreamingChat.tsx apps/web/tests/e2e/chatbot.spec.ts apps/web/tests/unit/streaming-chat.test.tsx
git commit -m "Rebuild StreamingChat onto shared Input/Button, add empty state and input aria-label"
```

---

### Task 27: Rebuild the Streaming page wrapper onto shared `Card`

**Goal:** Replace the mismatched hero heading and `glass-morphism` panel wrapping `StreamingChat` with the same `Card` + header pattern used elsewhere.

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/streaming/page.tsx`
- Test: `apps/web/tests/unit/streaming-page.test.tsx`

**Acceptance Criteria:**
- [ ] Page renders a `[data-slot="card"]` element and no `.glass-morphism` element.
- [ ] Page heading is `<h1>Streaming</h1>`.
- [ ] The dead `next/link` import is removed.

**Verify:** `pnpm --filter web test -- tests/unit/streaming-page.test.tsx && pnpm --filter web build` -> `Tests 3 passed`, build succeeds

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/streaming-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import Streaming from '@/app/(dashboard)/dashboard/streaming/page';

describe('Streaming dashboard page', () => {
  it('renders the shared Card primitive instead of a glass-morphism panel', () => {
    const { container } = render(<Streaming />);
    expect(container.querySelector('[data-slot="card"]')).toBeTruthy();
    expect(container.querySelector('.glass-morphism')).toBeNull();
  });

  it('uses the consistent dashboard header pattern', () => {
    render(<Streaming />);
    expect(screen.getByRole('heading', { name: 'Streaming', level: 1 })).toBeTruthy();
  });

  it('no longer imports the unused next/link module', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'app/(dashboard)/dashboard/streaming/page.tsx'),
      'utf-8'
    );
    expect(source).not.toMatch(/from ['"]next\/link['"]/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/streaming-page.test.tsx`
Expected: FAIL — `[data-slot="card"]` not found, heading `Streaming` not found, `.glass-morphism` element present, source still imports `next/link`.

- [ ] **Step 3: Write minimal implementation**
```tsx
// apps/web/app/(dashboard)/dashboard/streaming/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import StreamingChat from '@/components/ai-tutor-api/StreamingChat';

export default function Streaming() {
    return (
        <section className="flex-1 p-4 lg:p-8">
            <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
                Streaming
            </h1>
            <Card>
                <CardHeader>
                    <CardTitle>Streaming Chat</CardTitle>
                </CardHeader>
                <CardContent>
                    <StreamingChat />
                </CardContent>
            </Card>
        </section>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/streaming-page.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**
```bash
git add "apps/web/app/(dashboard)/dashboard/streaming/page.tsx" apps/web/tests/unit/streaming-page.test.tsx
git commit -m "Rebuild streaming page wrapper onto shared Card, dropping the mismatched hero heading"
```

---

### Task 28: Rebuild the Get Token page onto shared `Card`/`Button`/`Label`

**Goal:** Replace the mismatched hero heading, `glass-morphism` panel, and raw `<button>` on `/dashboard/get-token` with the shared UI kit. This is the last of the four mismatched pages — after this task, `glass-morphism` should not appear anywhere in the repo.

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/get-token/page.tsx`
- Test: `apps/web/tests/unit/get-token-page.test.tsx`

**Acceptance Criteria:**
- [ ] Page renders `[data-slot="card"]` and `[data-slot="button"]` elements, and no `.glass-morphism` element.
- [ ] Clicking "Get New Token" still calls `/api/token` and renders the returned token.
- [ ] The dead `next/link` import is removed.
- [ ] No file in the repo contains the string `glass-morphism` anymore.

**Verify:** `pnpm --filter web test -- tests/unit/get-token-page.test.tsx && grep -rl "glass-morphism" apps/web/app apps/web/components 2>/dev/null; pnpm --filter web build` -> `Tests 4 passed`, grep prints nothing, build succeeds

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/get-token-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Token from '@/app/(dashboard)/dashboard/get-token/page';

describe('Get Token dashboard page', () => {
  it('renders the shared Card/Button primitives instead of raw elements', () => {
    const { container } = render(<Token />);
    expect(container.querySelector('[data-slot="card"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="button"]')).toBeTruthy();
    expect(container.querySelector('.glass-morphism')).toBeNull();
  });

  it('fetches and displays a token when the button is clicked', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, token: 'test-token-123' }),
    }) as unknown as typeof fetch;

    render(<Token />);
    fireEvent.click(screen.getByRole('button', { name: /get new token/i }));

    await waitFor(() => {
      expect(screen.getByText('test-token-123')).toBeTruthy();
    });
  });

  it('uses the consistent dashboard header pattern', () => {
    render(<Token />);
    expect(screen.getByRole('heading', { name: 'Get Token', level: 1 })).toBeTruthy();
  });

  it('no longer imports the unused next/link module', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'app/(dashboard)/dashboard/get-token/page.tsx'),
      'utf-8'
    );
    expect(source).not.toMatch(/from ['"]next\/link['"]/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/get-token-page.test.tsx`
Expected: FAIL — `[data-slot="card"]`/`[data-slot="button"]` not found, `.glass-morphism` element present, heading `Get Token` not found, source still imports `next/link`.

- [ ] **Step 3: Write minimal implementation**
```tsx
// apps/web/app/(dashboard)/dashboard/get-token/page.tsx
"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Label } from '@repo/ui/components/label';
import { Loader2 } from 'lucide-react';

interface TokenResponse {
  success: boolean;
  token: string;
}

export default function Token() {
    const [tokenResponse, setTokenResponse] = useState<TokenResponse | null>(null);
    const [error, setError] = useState('');
    const [tokenLoading, setTokenLoading] = useState(false);

    const handleGetToken = async () => {
        setTokenLoading(true);
        setError('');
        try {
            const response = await fetch('/api/token', {
                method: 'POST',
            });
            const data = await response.json();
            if (response.ok) {
                setTokenResponse(data);
            } else {
                setError(data.error || 'Failed to get token');
            }
        } catch (err) {
            setError('Failed to get token');
        } finally {
            setTokenLoading(false);
        }
    };

    return (
        <section className="flex-1 p-4 lg:p-8">
            <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
                Get Token
            </h1>
            <Card>
                <CardHeader>
                    <CardTitle>API Token</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-start space-y-6">
                        <Button onClick={handleGetToken} disabled={tokenLoading}>
                            {tokenLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Getting Token...
                                </>
                            ) : (
                                'Get New Token'
                            )}
                        </Button>

                        {tokenResponse && (
                            <div className="w-full space-y-4">
                                <div>
                                    <Label>Token</Label>
                                    <code className="block p-3 mt-2 bg-muted rounded border text-sm overflow-x-auto">
                                        {tokenResponse.token}
                                    </code>
                                </div>

                                <div>
                                    <Label>Full Response</Label>
                                    <pre className="block p-3 mt-2 bg-muted rounded border text-sm overflow-x-auto whitespace-pre-wrap">
                                        {JSON.stringify(tokenResponse, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}

                        {error && (
                            <p className="w-full text-sm text-red-500" role="alert">
                                {error}
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </section>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/get-token-page.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**
```bash
git add "apps/web/app/(dashboard)/dashboard/get-token/page.tsx" apps/web/tests/unit/get-token-page.test.tsx
git commit -m "Rebuild get-token page onto shared Card/Button, removing the last glass-morphism panel"
```

---

### Task 29: Make `DisplayCard` width responsive instead of fixed `w-[42rem]`

**Goal:** Replace `DisplayCard`'s hardcoded `w-[42rem]` (672px) with a responsive width so the card doesn't overflow narrow viewports. Optional polish — not launch-blocking.

**Files:**
- Modify: `apps/web/components/landing-page/timeline/components/display-cards.tsx`
- Test: `apps/web/tests/unit/display-card.test.tsx`

**Acceptance Criteria:**
- [ ] `DisplayCard`'s root element no longer applies a bare `w-[42rem]` utility at the base breakpoint.
- [ ] The card still caps out at 42rem on larger screens (via `max-w-[42rem]`).
- [ ] Manual check: at a 375px viewport the card no longer forces horizontal page scroll.

**Verify:** `pnpm --filter web test -- tests/unit/display-card.test.tsx` -> `Test Files 1 passed`, `Tests 1 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/display-card.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DisplayCard } from '@/components/landing-page/timeline/components/display-cards';

describe('DisplayCard', () => {
  it('caps its width responsively instead of a fixed w-[42rem]', () => {
    const { container } = render(<DisplayCard />);
    const card = container.firstChild as HTMLElement;
    const classes = card.className.split(' ');
    expect(classes).not.toContain('w-[42rem]');
    expect(classes).toContain('max-w-[42rem]');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/display-card.test.tsx`
Expected: FAIL — `classes` contains `w-[42rem]`, does not contain `max-w-[42rem]`.

- [ ] **Step 3: Write minimal implementation**
Change the `className` string in `apps/web/components/landing-page/timeline/components/display-cards.tsx`'s `DisplayCard` from:
```tsx
        "relative flex h-56 w-[42rem] -skew-y-[8deg] select-none flex-col justify-between rounded-xl border-2 bg-muted/70 backdrop-blur-sm px-4 py-3 transition-all duration-700 after:absolute after:-right-1 after:top-[-5%] after:h-[110%] after:w-[20rem] after:bg-gradient-to-l after:from-background after:to-transparent after:content-[''] hover:border-white/20 hover:bg-muted [&>*]:flex [&>*]:items-center [&>*]:gap-2",
```
to:
```tsx
        "relative flex h-56 w-[88vw] max-w-[42rem] -skew-y-[8deg] select-none flex-col justify-between rounded-xl border-2 bg-muted/70 backdrop-blur-sm px-4 py-3 transition-all duration-700 after:absolute after:-right-1 after:top-[-5%] after:h-[110%] after:w-[20rem] after:bg-gradient-to-l after:from-background after:to-transparent after:content-[''] hover:border-white/20 hover:bg-muted [&>*]:flex [&>*]:items-center [&>*]:gap-2",
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/display-card.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/web/components/landing-page/timeline/components/display-cards.tsx apps/web/tests/unit/display-card.test.tsx
git commit -m "Make DisplayCard width responsive instead of a fixed 42rem"
```

---

### Task 30: Fix `ShuffleCards` pushing cards off-screen under 375px

**Goal:** Shrink the testimonial-card stack and its negative-margin desktop offset to a mobile-safe base size, only applying the fixed 350px/negative-margin desktop layout from `sm:` upward. Optional polish — not launch-blocking.

**Files:**
- Modify: `apps/web/components/landing-page/timeline/components/testimonial-cards.tsx`
- Test: `apps/web/tests/unit/shuffle-cards.test.tsx`

**Acceptance Criteria:**
- [ ] The card stack's wrapper no longer applies a bare `-ml-[100px]`/`w-[350px]` at the base breakpoint.
- [ ] The desktop offset/size is preserved from `sm:` upward.
- [ ] Manual check: at a 375px viewport, no testimonial card is pushed outside the visible area.

**Verify:** `pnpm --filter web test -- tests/unit/shuffle-cards.test.tsx` -> `Test Files 1 passed`, `Tests 2 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/shuffle-cards.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ShuffleCards } from '@/components/landing-page/timeline/components/testimonial-cards';

describe('ShuffleCards', () => {
  it('does not apply a fixed negative offset at the base (mobile) breakpoint', () => {
    const { container } = render(<ShuffleCards />);
    const stack = container.querySelector('.relative') as HTMLElement;
    const classes = stack.className.split(' ');
    expect(classes).not.toContain('-ml-[100px]');
    expect(classes).toContain('sm:-ml-[100px]');
  });

  it('uses a narrower card width at the base breakpoint than the desktop 350px', () => {
    const { container } = render(<ShuffleCards />);
    const stack = container.querySelector('.relative') as HTMLElement;
    const classes = stack.className.split(' ');
    expect(classes).not.toContain('w-[350px]');
    expect(classes).toContain('sm:w-[350px]');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/shuffle-cards.test.tsx`
Expected: FAIL — `classes` contains `-ml-[100px]` and `w-[350px]` at the base breakpoint, does not contain the `sm:`-prefixed variants.

- [ ] **Step 3: Write minimal implementation**
In `apps/web/components/landing-page/timeline/components/testimonial-cards.tsx`, change the `TestimonialCard` className from:
```tsx
      className={`absolute left-0 top-0 grid h-[450px] w-[350px] select-none place-content-center space-y-6 rounded-2xl border-2 border-gray-700 bg-gray-300/20 p-6 shadow-xl backdrop-blur-md ${
        isFront ? "cursor-grab active:cursor-grabbing" : ""
      }`}
```
to:
```tsx
      className={`absolute left-0 top-0 grid h-[380px] w-[260px] sm:h-[450px] sm:w-[350px] select-none place-content-center space-y-6 rounded-2xl border-2 border-gray-700 bg-gray-300/20 p-6 shadow-xl backdrop-blur-md ${
        isFront ? "cursor-grab active:cursor-grabbing" : ""
      }`}
```
and change `ShuffleCards`'s wrapper from:
```tsx
      <div className="relative -ml-[100px] h-[450px] w-[350px] md:-ml-[175px]">
```
to:
```tsx
      <div className="relative h-[380px] w-[260px] sm:-ml-[100px] sm:h-[450px] sm:w-[350px] md:-ml-[175px]">
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/shuffle-cards.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**
```bash
git add apps/web/components/landing-page/timeline/components/testimonial-cards.tsx apps/web/tests/unit/shuffle-cards.test.tsx
git commit -m "Fix ShuffleCards pushing testimonial cards off-screen under 375px"
```
