# aitutor-api-saas-starter — Unified Modernization Design

## Overview

This document merges five independently-authored design proposals — dependency upgrade, monorepo conversion, password-reset/email, design cleanup, and a React Query/performance pass — into one execution-ordered plan for `aitutor-api-saas-starter`. The five phases execute strictly in sequence (upgrade → monorepo → email → design → performance) so that every later phase can assume the concrete package versions, directory layout, and architectural decisions made by the phases before it are already in place, rather than re-litigating them.

## Current State Summary

A single-package Next.js 15 App Router SaaS starter (no monorepo tooling, no test runner, no CI) using React 19.0.0, Tailwind v4 (CSS-first config, pre-refresh shadcn `forwardRef` components), Drizzle ORM/Postgres, stateless JWT-cookie auth (jose + bcryptjs), Stripe billing, and a Vercel AI SDK v4 (`ai/react` `useChat`) chat client that talks to an external `aitutor-api.vercel.app` service via a raw byte-proxying Route Handler. There is no email-sending capability (only a `// TODO: Send invitation email` comment), no `packages/`/`apps/` split, and no automated tests of any kind. The codebase also carries a meaningful amount of half-finished/dead template boilerplate: two divergent visual languages in the dashboard, several no-op CSS classes (`glass-morphism`, dynamic `text-${color}-500`, `text-spektr-cyan-50`), dead files (`terminal.tsx`, a duplicate `TimelineContent.tsx`), a broken checkout CTA (empty Stripe `priceId`s), and a client-side polling component (`subscription-status.tsx`) with a stale comment and no cache/dedup.

## Target Architecture

A pnpm + Turborepo monorepo with one app and four internal packages, current-stable dependencies, a real Vitest/Playwright test harness wired into CI, a working password-reset + transactional-email feature, a single reconciled dashboard visual language, and React Query replacing every hand-rolled fetch/poll.

```
repo-root/
├── pnpm-workspace.yaml
├── turbo.json                        # build/dev/lint/test/test:e2e/db:generate/db:migrate tasks
├── package.json                      # "packageManager": "pnpm@10.23.0", engines.node >=20.9.0, devDep turbo
├── .github/workflows/ci.yml          # pnpm install -> turbo run lint/typecheck/test/build (+ e2e on PR)
│
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (front)/              # landing, pricing — single-consumer, stays app-local
│       │   ├── (login)/              # sign-in, sign-up, forgot-password, reset-password (new)
│       │   ├── (dashboard)/dashboard/**
│       │   └── api/
│       │       ├── chat/, run/, token/, team/limit/, workflow/history/
│       │       ├── stripe/{checkout,webhook}/
│       │       └── password-reset/{request,confirm}/route.ts   # new
│       ├── components/               # app-only: ai-tutor-api/*, landing-page/**, app-sidebar, workflow/*
│       ├── lib/
│       │   ├── auth/{index.tsx, middleware.ts, session.ts, reset-token.ts, password-reset.ts}  # Next-coupled, stays here
│       │   └── payments/{actions.ts, stripe.ts}                # Next-coupled, stays here
│       ├── middleware.ts, next.config.ts (transpilePackages: ['@repo/ui','@repo/db','@repo/email'])
│       ├── vitest.config.ts, playwright.config.ts, tests/**    # new (Phase 1, relocated in Phase 2)
│       ├── .env.example              # + RESEND_API_KEY, RESEND_FROM_EMAIL
│       └── package.json              # deps on @repo/ui, @repo/db, @repo/email (workspace:*) + @tanstack/react-query
│
├── packages/
│   ├── ui/                           # 12 shadcn primitives (already regenerated to current registry in Phase 1)
│   │   ├── src/{components/*.tsx, hooks/use-mobile.tsx, lib/utils.ts}
│   │   └── components.json, package.json
│   │
│   ├── db/
│   │   ├── src/{schema.ts, client.ts, queries.ts, utils.ts, tiers.ts}
│   │   ├── migrations/**, scripts/{seed.ts, setup.ts}
│   │   └── drizzle.config.ts, package.json
│   │
│   ├── email/                        # scaffolded in Phase 2, filled in during Phase 3
│   │   ├── src/{client.ts, send.ts, templates/{EmailLayout,PasswordResetEmail,TeamInvitationEmail}.tsx}
│   │   └── package.json
│   │
│   └── config/
│       ├── typescript/{base.json, nextjs.json, react-library.json}
│       ├── eslint/                   # net-new, minimal
│       └── tailwind/shared-theme.css # deduplicated @theme token block
```

Package naming uses the generic `@repo/*` scope (no real npm org exists today — flagged as an open question below).

---

## Phase 1: Dependency Upgrade

**Order of operations** (safest-first; commit after each step so a regression bisects to one dependency family):

0. **Test harness first**, before any bump — this is the foundation every later phase relies on. Add Vitest + `@testing-library/react` and Playwright. Write the initial suite against the *current* code as a red/green baseline: unit tests for `lib/auth/session.ts` (token round-trip), `lib/utils` `cn()`, the Zod schemas in `lib/auth/middleware.ts`, and `checkMessageLimit`/`incrementMessageCount`; Playwright e2e for sign-up→dashboard redirect, sign-in with a seeded user, dashboard load, and a chatbot smoke test. Add `test`/`test:e2e` npm scripts and a new GitHub Actions workflow (none exists today).

1. **Trivial/patch bumps** (batched): all 10 `@radix-ui/react-*` packages, `postgres`, `dotenv`, `date-fns`, `tailwind-merge`, `autoprefixer`, `canvas-confetti` + its `@types`, `tailwindcss-react-aria-components` → 2.2.0.
2. **Consolidate `framer-motion`/`motion`**: keep `motion` (framer-motion is now a compatibility wrapper), migrate call sites in `components/landing-page/**`, drop `framer-motion`, bump the survivor to 12.42.2.
3. **React 19.0.0 → 19.2.7** + matching `@types/react`/`@types/react-dom` (19.2.17/19.2.3).
4. **TypeScript 5.7.3 → newest 5.x line** (explicitly *not* the 7.0.2 `tsgo` native-compiler rewrite yet — that's an architectural jump, not a routine bump; ecosystem tooling, including Next's own TS plugin, may not have caught up). Revisit TS7 as its own follow-up once Next.js and editor tooling confirm compatibility.
5. **Tailwind 4.0.3 → 4.3.2** (+ `@tailwindcss/postcss`), then regenerate all 12 `components/ui/*.tsx` files from the current shadcn Tailwind-v4 registry (function components + `data-slot` + `oklch()` tokens, replacing the pre-refresh `forwardRef`/`hsl(var(--x))` pattern). Diff every file back afterward to confirm no primitive was hand-edited (custom styling in this repo lives at call sites via `className`, so this should be low-risk).
6. **lucide-react 0.474 → 1.24.0.** `tsc --noEmit` catches renamed/removed icons immediately; pay particular attention to brand icons (Facebook/Instagram/Linkedin).
7. **marked ^15 → 18.** Check `parse()` signature and options-API changes across the 3 majors before bumping.
8. **drizzle-orm 0.39→0.45 / drizzle-kit 0.30→0.31.** Still pre-1.0 — treat as a real migration review, not a patch. Regenerate types, re-run `db:generate`/`db:migrate`, `db:seed` against a scratch Postgres.
9. **zod 3→4.** Small blast radius (`lib/auth/middleware.ts`, `app/(login)/actions.ts`) — review against v4's error-map/`.merge()` migration notes.
10. **stripe ^17.6.0 → 22.3.1** (5 majors, billing-critical). Update the pinned `apiVersion: '2025-01-27.acacia'` literal in `lib/payments/stripe.ts` to whatever the new SDK expects (it will fail to compile otherwise). Review Checkout Session / webhook Event payload changes across the range; re-test the full checkout+webhook round trip with `stripe listen --forward-to localhost:3000/api/stripe/webhook` in test mode.
11. **`ai` package: freeze at the newest v4.x patch, do *not* upgrade to v5/v6/v7 in this phase.** The v4→v7 jump rewrites `useChat`'s entire contract (`ai/react`→`@ai-sdk/react`, `input`/`handleInputChange`/`handleSubmit` removed, `message.content`→`parts`, `isLoading`→`status`), and `app/api/chat/route.ts` doesn't touch the server SDK at all — it blindly proxies bytes from an external, out-of-repo service whose actual wire format is unverified. This decision is load-bearing for every later phase: `StreamingChat.tsx`'s v4 contract is what Phase 4's accessibility fixes and Phase 5's "leave `/api/chat` alone" both assume. Scope the v5+ migration as an explicit separate initiative, outside these five phases.
12. **Next.js off canary → 16.2.10 stable, last**, once React/TypeScript/Tailwind/shadcn are settled. "Latest stable" today means Next 16, not a Next 15 point release. Use `npx @next/codemod@latest upgrade latest` for the mechanical pass, then resolve `next.config.ts`'s `experimental` block by hand: **drop `experimental.ppr` entirely** — full/boolean PPR has historically been canary-only on stable channels, and with zero `<Suspense>` usage anywhere in the app today it's already an inert flag providing no benefit, so removing it now (rather than carrying the decision into Phase 5) is the concrete resolution this document adopts. Check whether `newDevOverlay` has stabilized/renamed/removed and update accordingly — verify against actual release notes/codemod output at execution time, not assumed. After the bump, do a full manual click-through of every route plus the Phase-0 automated suite.

**Dependency version baseline (what every later phase assumes is installed):**

| Package | Target |
|---|---|
| next | 16.2.10 |
| react / react-dom | 19.2.7 |
| typescript | newest 5.x (not 7.0 tsgo) |
| tailwindcss / @tailwindcss/postcss | 4.3.2 |
| drizzle-orm / drizzle-kit | 0.45.2 / 0.31.10 |
| stripe | 22.3.1 |
| ai | latest 4.x (frozen, not v5+) |
| jose | 6.2.3 |
| bcryptjs | 3.0.3 |
| zod | 4.4.3 |
| lucide-react | 1.24.0 |
| marked | 18.0.6 |
| motion (framer-motion dropped) | 12.42.2 |
| @radix-ui/react-* | latest minor/patch, same major |
| tailwindcss-react-aria-components | 2.2.0 |

**Verification approach:** `tsc --noEmit`, `npm run build`, the new unit suite, and the new Playwright suite after *every* step, not batched at the end. Sanity-check `git diff --stat` at each commit.

---

## Phase 2: Monorepo Conversion

**Tooling:** pnpm workspaces + Turborepo. Root `package.json` gets `"packageManager": "pnpm@10.23.0"` and `turbo` as its only devDependency (pnpm-lock.yaml is currently a v9-format lockfile against a local pnpm 10.23.0 — regenerate it as part of this phase). `next.config.ts` gains `transpilePackages: ['@repo/ui', '@repo/db']` (and `'@repo/email'` once Phase 3 adds JSX templates) since internal packages ship raw `.ts`/`.tsx` with no build step (Turborepo's standard no-build internal-package pattern — building to `dist/` via tsup was considered and deferred as unnecessary friction for a starter template).

**What moves where:**

- **`apps/web`** — `git mv` the whole app here first (preserves history), then carve packages out in follow-up commits. `lib/auth/*` and `lib/payments/*` **stay** in `apps/web/lib` — both are saturated with Next.js-only APIs (`next/headers`, `next/navigation`, `'use server'`) and have exactly one consumer, so extracting them would just add a Next.js peer-dependency to a "shared" package for no reuse benefit. This decision matters for Phase 3: the new `reset-token.ts`/`password-reset.ts` files land in `apps/web/lib/auth/` alongside `session.ts`, not in a package.
- **`packages/ui`** — the 12 (already-regenerated, Phase-1) shadcn primitives, `hooks/use-mobile.tsx`, and `lib/utils.ts`'s `cn()`, moved verbatim. `exports` map points directly at source (no build step). Every `@/components/ui/*`, `@/lib/utils`, `@/hooks/use-mobile` import across `apps/web` is mechanically rewritten to `@repo/ui/...` — the single largest diff in this phase.
- **`packages/db`** — `schema.ts`, `drizzle.ts`→`client.ts`, `queries.ts`, `utils.ts`, `tiers.ts` (must move here since `utils.ts` imports it directly), plus `migrations/**` and `drizzle.config.ts` (paths re-pointed relative to the new location). `seed.ts`/`setup.ts` move to `scripts/`; `seed.ts` is rewritten to instantiate its own inline Stripe client instead of importing `apps/web/lib/payments/stripe` (a package must not depend on the app that consumes it). `queries.ts`'s `getUser()` either stays a thin wrapper in `apps/web/lib` calling a new `getUserById(id)` exported from `@repo/db`, or `@repo/db` accepts a `next/headers` dependency — **recommend the former** so `@repo/db` stays framework-agnostic, which also matters for Phase 5's query-layer work.
- **`packages/email`** — scaffolded empty-but-wired in this phase (package.json + one placeholder export) purely so Phase 3 doesn't need to touch `pnpm-workspace.yaml`/`turbo.json`/`next.config.ts` again. **Phase 3 builds its templates and send functions directly into this package.**
- **`packages/config`** — `tsconfig` split into `base.json`/`nextjs.json`/`react-library.json`; a net-new minimal ESLint config (none exists today); Tailwind's `@theme`/`:root`/`.dark` token block extracted into `packages/config/tailwind/shared-theme.css`, **deduplicating** the two copies currently present in `app/globals.css`. `apps/web/app/globals.css` becomes `@import 'tailwindcss'; @import '@repo/config/tailwind/shared-theme.css'; @plugin 'tailwindcss-animate'; @source '../../packages/ui/src';` — the `@source` line is required because Tailwind v4's content detection won't walk outside `apps/web`'s own tree, and without it, classes used only inside `@repo/ui` silently get purged.

**Test infra relocation:** the Vitest/Playwright setup added in Phase 1 moves into `apps/web/` along with the app; `turbo.json` gains `test`/`test:e2e`/`lint` tasks; the GitHub Actions workflow is updated to `pnpm install` at the workspace root and run `turbo run lint typecheck test build` (and `test:e2e` on PRs). No new tests are written in this phase — verification is that the existing Phase-1 suite still passes after the move.

**Deployment:** change Vercel's Root Directory to `apps/web`, confirm sibling `packages/*` are included in the build, and validate with an actual preview deploy before merging.

---

## Phase 3: Email Feature

**Flow:** a `passwordResetTokens` table is added to `packages/db/src/schema.ts` (id, `userId` FK, `tokenHash` unique, `expiresAt`, `usedAt` nullable, `createdAt`), plus `ActivityType.REQUEST_PASSWORD_RESET`/`RESET_PASSWORD`. The reset token itself is a signed jose JWT (reusing `session.ts`'s exact primitive) carrying a `purpose: 'password-reset'` claim — this is what stops a leaked session token (signed with the same `AUTH_SECRET`) from being replayed as a reset token. The DB row is keyed by a **SHA-256** hash of the token's `jti` (not bcrypt — bcrypt's per-call salting makes it unusable for DB lookup; bcryptjs stays reserved for the password hash itself). `requestPasswordReset(email)` always returns an identical success response regardless of whether the account exists (no enumeration leak), invalidates any prior outstanding token for that user, inserts the new row, and calls `packages/email`'s `sendPasswordResetEmail`. `confirmPasswordReset(token, newPassword)` verifies the JWT, checks the DB row is unused and unexpired, updates `users.passwordHash`, marks the token used, and (flagged as a product decision) auto-signs the user in via `setSession`.

**Where things live (per Phase 2's package boundaries):** `reset-token.ts` and `password-reset.ts` go in `apps/web/lib/auth/`, next to `session.ts`. The schema change lands in `packages/db`. The email templates and send functions land in `packages/email` (filled in now, not scaffolded).

**`packages/email` interface:**
- `src/client.ts` — lazy Resend client + generic `sendEmail({ to, subject, react }): Promise<{ id: string }>`, throwing at call time (not import time) if `RESEND_API_KEY` is missing.
- `src/send.ts` — `sendPasswordResetEmail({ to, name, resetUrl, expiresInMinutes })` and `sendTeamInvitationEmail({ to, teamName, inviterName, inviteUrl, role })`.
- `src/templates/EmailLayout.tsx` — shared `@react-email/components` wrapper with an absolute-URL logo (`${BASE_URL}/logo-long.png`) and the app's gradient accent.
- `src/templates/PasswordResetEmail.tsx` — greeting, CTA, expiry notice, plain-text fallback.
- `src/templates/TeamInvitationEmail.tsx` — wires directly into the existing TODO in `inviteTeamMember` (`app/(login)/actions.ts`), CTA to `${BASE_URL}/sign-up?inviteId={id}`.

**HTTP surface:** both a Route Handler pair (`app/api/password-reset/{request,confirm}/route.ts`, POST, Zod-validated) and Server Actions (`requestPasswordReset`/`resetPassword` added to `app/(login)/actions.ts`, `validatedAction`-wrapped like every existing mutation) over the *same* shared `password-reset.ts` logic.

**New pages:** `app/(login)/forgot-password/page.tsx` (generic success message regardless of account existence) and `app/(login)/reset-password/page.tsx` (reads `?token=`, new-password form). A "Forgot your password?" link is added under the password field in `login.tsx` (sign-in mode only).

**New env vars:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL` added to `apps/web/.env.example`; `resend` and `@react-email/components` added as `packages/email` dependencies.

---

## Phase 4: Design Cleanup

All file paths below are post-Phase-2 (`apps/web/...`).

**Landing page (`apps/web/app/(front)/**`, `apps/web/components/landing-page/**`):**
- Contradictory Sign In button classes (`bg-black` + `bg-transparent` + `text-black`) in `(front)/layout.tsx` — pick one real variant, prefer `@repo/ui`'s `Button variant="outline"`.
- Buggy avatar-initials logic (`email.split(' ')` — emails never contain spaces) in `(front)/layout.tsx` and `dashboard/settings.tsx` — centralize into one helper that splits on `name` first, falls back to first letters of email.
- Invalid `text-spektr-cyan-50` class in `hero.tsx` (undefined, no-op) — replace with a real token.
- Grammar fixes in hero copy.
- `terminal.tsx` is dead (never imported) and shows the *original* Vercel starter's clone URL — delete, or revive with this repo's own setup commands (open question).
- `TimelineContent.tsx` (unused, has a real scroll-linked animation) vs `TImelineSecion.tsx` (typo'd filename, live but stripped-down) — delete the dead duplicate or port its animation into the live component; rename the typo'd file.
- Commented-out newsletter form in `footer.tsx` — ship it or remove it; fix the dead `href="#"` Home link.
- Dynamic Tailwind class `` `text-${color}-500` `` in `pricing/page.tsx` (invisible to Tailwind's static scanner) — replace with a static lookup object.
- Typos and fabricated-looking testimonial handles — confirm with user whether these are real quotes or placeholders (open question).
- `lib/tiers.ts` (now `packages/db/src/tiers.ts`) ships empty `priceId: ''` — the primary "Get Started" CTA cannot start checkout out of the box; needs real Stripe IDs from the user.

**Dashboard (`apps/web/app/(dashboard)/dashboard/**`):** the core fix — reconcile two divergent visual languages. `activity`/`general`/`security`/`team` use the shared `@repo/ui` kit with a consistent header pattern; `chatbot`/`get-token`/`streaming`/`workflow` instead use a mismatched "AI Story Generator" hero heading, hand-rolled `glass-morphism` panels (a class defined nowhere), and raw `<button>`/`<input>` elements with no `focus-visible` styling. Rebuild those four pages onto `@repo/ui`'s `Card`/`Button`/`Input`/`Label`. While in these files: fix `glass-morphism` (define or drop), fix `prose`/`prose-lg` in `StoryDisplay.tsx` (add `@tailwindcss/typography` or drop the classes), add an empty state and `aria-label` to `StreamingChat.tsx`'s message input, remove dead `Link` imports, fix `font-medium bold`→`font-bold` in `security/page.tsx`.

**Functional/routing fixes:** `settings.tsx`'s remove-member gate (`index > 1`, hardcoded) needs a real `isOwner`/self-protection rule; missing `public/placeholder.svg` causes every team-member avatar image request to 404; `get-token/page.tsx` is unreachable from any nav item (decide: add nav entry or delete); `dashboard/team/page.tsx` renders the same component as root `/dashboard` (decide: distinct page, or collapse the duplicate route).

**Mobile fixes:** `DisplayCard` uses a fixed `w-[42rem]` with no responsive variant; `ShuffleCards` can push cards off-screen under 375px.

**Sequencing:** dead code / no-op classes / functional fixes ship first (cheap, mechanical). Dashboard reconciliation ships as its own PR (largest diff, verify manually per-page). Mobile fixes are optional polish.

---

## Phase 5: Performance Pass

**React Query adoption** (`@tanstack/react-query` added as an `apps/web`-only dependency):

1. `components/subscription-status.tsx`'s three `useState`s + two `useEffect`s (including a `setInterval(20000)` whose comment incorrectly says "10 seconds") become one `useQuery({ queryKey: ['team-limit', teamId], refetchInterval: 20000, refetchOnWindowFocus: true })`.
2. `components/workflow/WorkflowHistoryDrawer.tsx`'s `open`-gated `useEffect` becomes `useQuery({ queryKey: ['workflow-history', teamId], enabled: open })`.
3. `workflow/page.tsx`'s `/api/run` call and `get-token/page.tsx`'s `/api/token` call become `useMutation`s. `/api/run`'s `onSuccess` calls `queryClient.invalidateQueries` on both `['team-limit']` and `['workflow-history']` — the actual scalability win, since today the sidebar badge only reflects a just-consumed message after waiting up to 20s.
4. A single `QueryClientProvider` is added to `apps/web/app/(dashboard)/dashboard/layout.tsx`.

**Query-layer trim** (`packages/db/src/queries.ts`, `packages/db/src/utils.ts`): the 4-level-nested `getTeamForUser` — used by every poll tick, every story generation, and every history-drawer open — is replaced at those call sites by the already-present-but-unused lean `getUserWithTeam` (or a new `getTeamCore(userId)`), returning just the scalar fields that `/api/team/limit` and `/api/run` actually need. `checkMessageLimit`'s signature changes to accept the already-fetched team row, collapsing a double team-fetch into one. `getTeamForUser`'s full member-roster join is retained for the team/settings page, which genuinely needs the member list.

**PPR:** already resolved in Phase 1 (the flag was dropped as inert/canary-only).

**Streaming left alone:** `/api/chat` + `StreamingChat.tsx`'s `useChat` (frozen at `ai` v4 per Phase 1) are untouched. `/api/run` is a single blocking `fetch`; if AI Tutor API's `/run` endpoint supports SSE/chunked responses (unconfirmed), streaming it would be a bigger UX win than `useMutation` alone.

**Route Handlers vs. Server Actions going forward:** keep Route Handlers for anything independently fetchable/pollable or that must stream; prefer Server Actions for same-origin, no-external-caller mutations.

---

## Testing Strategy

No test infrastructure exists at the start of this effort — the harness is deliberately introduced in Phase 1, before any other change, and every later phase is expected to leave it green.

- **Phase 1** introduces Vitest + `@testing-library/react` and Playwright, plus the first GitHub Actions CI workflow. Baseline suite written against the pre-upgrade code: token round-trip, `cn()`, Zod schemas, `checkMessageLimit`/`incrementMessageCount`, and Playwright coverage of sign-up→dashboard, sign-in, dashboard load, and a chatbot smoke test. Run the full suite after every individual dependency bump.
- **Phase 2** relocates the Phase-1 test config into `apps/web/`, adds `test`/`test:e2e`/`lint` as Turborepo tasks, updates CI. No new tests written; success is the existing suite passing from its new location, plus a manual build and Vercel preview deploy.
- **Phase 3** adds unit tests for the token primitives (round-trip, purpose-claim rejection, expiry), orchestration tests for `requestPasswordReset`/`confirmPasswordReset` with a mocked db and mocked email send functions (asserting no account-enumeration leak, single-use token behavior), and `@react-email/render`-based snapshot tests for the templates.
- **Phase 4** is primarily manual/visual: build after each batch, a browser walk-through at 375/768/1280px across every touched route, a keyboard-only pass for `focus-visible`. Re-run the Phase-1 Playwright suite after each batch.
- **Phase 5** adds unit tests around `checkMessageLimit`'s new signature, component-level tests against a mocked `QueryClient`, and manual Network-tab verification that the 20s poll collapses to one shared request and that a mutation triggers immediate sidebar invalidation.

---

## Risks & Open Questions

**Decisions this document makes (flagged here, not silently buried — say so if you want any of these changed):**

1. **`ai` SDK stays frozen at v4.x** rather than upgrading to v7, given the unverified external stream format from `aitutor-api.vercel.app` and the scale of the `useChat` rewrite. The v5+ migration becomes its own separate future initiative.
2. **Next.js target is 16.2.10 stable** (a major-version jump from the current canary), not an intermediate Next-15 stable point release.
3. **TypeScript stays on the newest 5.x line**, deferring the 7.0 `tsgo` rewrite.
4. **`experimental.ppr` is dropped in Phase 1** rather than carried forward or built out with real Suspense boundaries.
5. **`packages/ui`/`packages/db`/`packages/email` ship raw TypeScript via `transpilePackages`**, not built to `dist/` via tsup.
6. **Generic `@repo/*` package scope** (no real npm org).
7. **`packages/db` stays framework-agnostic**; `getUser()` stays a thin Next-coupled wrapper in `apps/web/lib`.
8. **Team-invitation email is built alongside password-reset in Phase 3** (the template + send function; wiring into the existing `inviteTeamMember` TODO), since the incremental cost is low and it directly closes an already-flagged loop.
9. **`PASSWORD_RESET_SECRET` is not introduced** — the reset token reuses `AUTH_SECRET`, isolated by a `purpose: 'password-reset'` claim.
10. **No rate-limiting is added to the forgot-password endpoint** in this pass — flagged as a real gap (no rate-limiting infra exists anywhere in the repo today) but scoped out to avoid stalling Phase 3 on infrastructure the rest of the app doesn't have either.

**Deferred to Phase 4 execution time (content/product decisions, not blocking approval of this design):**

- Real Stripe `priceId`/`productId` values for `tiers.ts`, vs. staying a documented placeholder.
- Whether `terminal.tsx`, `get-token/page.tsx`, and the `dashboard/team` vs. root `/dashboard` duplicate are revived, kept, or deleted.
- Whether the landing-page testimonials are real quotes needing a typo fix or placeholder content to replace.

**Open questions needing your input now (see the follow-up questions):**

- Should Phase 1 attempt the full `ai` v4→v7 upgrade instead of freezing at v4.x?
- Do you have Stripe test-mode/CLI access to validate the checkout+webhook flow after the Phase 1 Stripe upgrade, or should that step be flagged for your manual verification?
- Should a successful password reset auto-sign the user in, or force them back through `/sign-in`?

**Known architectural limitation, not fixed by this plan:**

Sessions are stateless JWTs with no server-side session table, so a password reset does not invalidate any already-issued session cookie for that user — a stolen device stays logged in for up to 24 hours post-reset. A real fix (a per-user `tokenVersion` column checked in `verifyToken`) is a larger, separate change worth its own decision.
