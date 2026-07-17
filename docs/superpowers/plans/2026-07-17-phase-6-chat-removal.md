# Phase 6: Remove chat features, keep workflow-only

**Goal:** The AI Tutor API no longer supports the chat surface (embedded chatbot, in-app streaming chat, chatbot session tokens). Strip those features out entirely so the product is workflow-integration-only, and drop the `ai` SDK that was frozen at 4.3.19 solely to power chat streaming.

**Confirmed scope decisions (from the user):**
- Remove the Get Token page + `/api/token` (they mint a token scoped to `CHATBOT_ID`, i.e. purely for the chatbot embed).
- Rewrite the landing-page marketing so it advertises workflow only, not chatbots / chat streaming.

**Keep (the workflow integration):** `/dashboard/workflow`, `/api/run`, `StoryDisplay.tsx`, `WorkflowHistoryDrawer.tsx` + `/api/workflow/history`, the `AITUTOR_API_KEY` + `WORKFLOW_ID` env vars, and all tier / message-limit logic.

**Baseline:** commit `74f2d73` (main after Phases 1–5).

## Operational notes
- Monorepo: `apps/web` (Next.js), `packages/{db,ui,email,config}`.
- The `pnpm --filter web test -- <pattern>` trailing-`--` does NOT filter in this repo — use `pnpm --filter web exec vitest run <path>` for an isolated run.
- Deleting these files keeps `tsc` clean throughout: nothing imports the deleted routes; the nav references pages only by URL string (not import); `StreamingChat` is the sole `ai` consumer and is deleted in Task 2.
- Level 0 tasks are pure file operations (no `pnpm install`) and touch disjoint file sets, so they run safely in parallel. The single `ai`-dependency removal + lockfile update is deferred to Task 8 so only one agent ever runs `pnpm install`.
- Commit with an explicit pathspec (`git commit <files> -m "..."`), never a bare `git commit`, to avoid sweeping up concurrent agents' staged files.
- For "removed" assertions, follow the existing `terminal-removed.test.ts` pattern (Phase 4 Task 1): a tiny test asserting `existsSync(path)` is `false`.

---

## Task 1: Remove the Chatbot page
**Files:** delete `apps/web/app/(dashboard)/dashboard/chatbot/page.tsx` and `apps/web/tests/unit/chatbot-page.test.tsx`; create `apps/web/tests/unit/chatbot-removed.test.ts`.
**Acceptance:** the chatbot page/dir no longer exists; `grep -rn "dashboard/chatbot" apps/web/app apps/web/components apps/web/lib` returns nothing; new removed-test passes.
**Verify:** `pnpm --filter web exec vitest run tests/unit/chatbot-removed.test.ts` → passes; `pnpm --filter web exec tsc --noEmit` → clean.

## Task 2: Remove the Streaming chat feature (page, component, /api/chat, e2e)
**Files:** delete `apps/web/app/(dashboard)/dashboard/streaming/page.tsx`, `apps/web/components/ai-tutor-api/StreamingChat.tsx`, `apps/web/app/api/chat/route.ts`, `apps/web/tests/unit/streaming-page.test.tsx`, `apps/web/tests/unit/streaming-chat.test.tsx`, `apps/web/tests/e2e/chatbot.spec.ts`; create `apps/web/tests/unit/chat-removed.test.ts`.
**Do NOT touch `package.json` here** — the `ai` dependency removal is Task 8 (single-owner install).
**Acceptance:** all listed files gone; `grep -rn "StreamingChat\|api/chat\|ai/react\|dashboard/streaming" apps/web/app apps/web/components apps/web/lib` returns nothing; `components/ai-tutor-api/` still contains `StoryDisplay.tsx` (workflow — keep).
**Verify:** `pnpm --filter web exec vitest run tests/unit/chat-removed.test.ts` → passes; `pnpm --filter web exec tsc --noEmit` → clean.

## Task 3: Remove the Get Token page + /api/token
**Files:** delete `apps/web/app/(dashboard)/dashboard/get-token/page.tsx`, `apps/web/app/api/token/route.ts`, `apps/web/tests/unit/get-token-page.test.tsx`, `apps/web/tests/unit/get-token-page-mutation.test.tsx`; create `apps/web/tests/unit/get-token-removed.test.ts`.
**Acceptance:** all listed files gone; `grep -rn "get-token\|api/token\|CHATBOT_ID" apps/web/app apps/web/components apps/web/lib` returns nothing.
**Verify:** `pnpm --filter web exec vitest run tests/unit/get-token-removed.test.ts` → passes; `pnpm --filter web exec tsc --noEmit` → clean.

## Task 4: Prune the dashboard nav (+ unit test + e2e nav assertion)
**Files:** `apps/web/lib/navigation/dashboard-nav-items.ts`, `apps/web/tests/unit/dashboard-nav-items.test.ts`, `apps/web/tests/e2e/auth-and-dashboard.spec.ts`.
**Changes:** remove the `Chatbot`, `Streaming`, and `Get Token` entries; drop the now-unused `BotIcon`, `MessageCircle`, `KeyRound` imports (keep the rest). Update `dashboard-nav-items.test.ts` so it asserts those three are absent and `Workflow` is still present. In `auth-and-dashboard.spec.ts`, change the line asserting a `chatbot` nav link is visible to assert the `Workflow` nav link is visible instead.
**Acceptance:** nav returns 5 items (Workflow, Team, General, Activity, Security); no unused icon imports; unit test passes.
**Verify:** `pnpm --filter web exec vitest run tests/unit/dashboard-nav-items.test.ts` → passes; `pnpm --filter web exec tsc --noEmit` → clean.

## Task 5: Remove chat env vars
**Files:** `apps/web/.env.example`; `apps/web/tests/unit/env-example.test.ts` (only if it references the removed vars — otherwise leave it).
**Changes:** remove `CHATBOT_ID=` and `NEXT_PUBLIC_AITUTOR_TOKEN=` lines. Keep `AITUTOR_API_KEY`, `WORKFLOW_ID`, and all others.
**Acceptance:** `grep -n "CHATBOT_ID\|NEXT_PUBLIC_AITUTOR_TOKEN" apps/web/.env.example` returns nothing; `AITUTOR_API_KEY`/`WORKFLOW_ID` still present.
**Verify:** `pnpm --filter web exec vitest run tests/unit/env-example.test.ts` → passes.

## Task 6: Rewrite the landing marketing to workflow-only
**Files:** `apps/web/components/landing-page/hero/hero.tsx`, `apps/web/components/landing-page/timeline/components/glowing-effect-demo.tsx`, and `apps/web/tests/unit/hero.test.tsx` (update only if it asserts on the rotating words).
**Changes:**
- `hero.tsx`: the rotating words are currently `["workflows", "chatbots", "personalities", "models"]`. Replace `"chatbots"` so no removed feature is advertised — e.g. `["workflows", "agents", "automations", "models"]` (keep it truthful to a workflow-only AI Tutor API product). Do not reintroduce `text-spektr-cyan-50` or the pre-Phase-4 grammar regressions.
- `glowing-effect-demo.tsx`: keep the first card ("Create workflow for specific tasks"). Replace the "Build chatbots" and "Real time chat streaming" cards with two workflow-truthful cards (e.g. workflow history / message-limit tiers, or running agentic workflows against 300+ models). Pick sensible lucide icons already available; drop the now-unused `BotIcon` import if nothing else uses it.
**Acceptance:** no "chatbot"/"chat streaming" marketing copy remains in these two files; hero still renders; existing hero test still passes (updated if needed).
**Verify:** `pnpm --filter web exec vitest run tests/unit/hero.test.tsx` → passes; `pnpm --filter web exec tsc --noEmit` → clean.

## Task 7: Update the README
**Files:** `README.md`.
**Changes:** remove the "Chatbot Page", "Extending Chat History to the Chatbot Page", and "Real-time Streaming" sections; remove `CHATBOT_ID` and `NEXT_PUBLIC_AITUTOR_TOKEN` from the env-var list; drop chatbot/chat mentions from the Tech Stack / overview so the doc describes a workflow-only product. Keep all workflow, Stripe, DB, and auth documentation.
**Acceptance:** `grep -in "chatbot\|chat streaming\|CHATBOT_ID\|NEXT_PUBLIC_AITUTOR_TOKEN" README.md` returns nothing (or only incidental non-feature mentions); workflow docs intact.

## Task 8: Drop the `ai` dependency + final full-repo verification
**Files:** `apps/web/package.json`, `pnpm-lock.yaml`.
**Changes:** remove `"ai"` from `apps/web/package.json` dependencies (its only consumer, `StreamingChat.tsx`, was deleted in Task 2), then `pnpm install` to update the lockfile.
**Acceptance / Verify (whole repo, after all of Tasks 1–7 have landed):**
- `grep -rn "'ai'\|\"ai\"\|ai/react" apps/web/app apps/web/components apps/web/lib` → nothing (no residual `ai` import).
- `grep -rn "chatbot\|StreamingChat\|api/chat\|api/token\|get-token\|CHATBOT_ID\|NEXT_PUBLIC_AITUTOR_TOKEN" apps/web/app apps/web/components apps/web/lib` → nothing outside tests asserting absence.
- `pnpm install && pnpm --filter web exec tsc --noEmit && pnpm --filter @repo/ui exec tsc --noEmit && pnpm --filter @repo/db exec tsc --noEmit && pnpm --filter @repo/email run typecheck` → all clean.
- `pnpm --filter web exec vitest run` → full unit suite green.
- `pnpm --filter web build` → succeeds; route list contains `/dashboard/workflow` and NOT `/dashboard/chatbot`, `/dashboard/streaming`, `/dashboard/get-token`, `/api/chat`, `/api/token`.
- `pnpm --filter web test:e2e` (or an automated substitute against a running dev server if the environment allows) → the remaining specs (`auth-and-dashboard.spec.ts`) pass.
