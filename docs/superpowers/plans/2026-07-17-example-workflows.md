# Example Workflows: Real Estate, Google Ads, Resume Screening

**Goal:** Add 3 new example workflow pages (Real Estate Investment Analysis, Google Ads Campaign Analysis, Resume & Candidate Fit Analysis), each in the sidebar, each backed by its own AI Tutor API workflow ID, plus a per-workflow JSON spec the user can use to manually recreate the workflow in AI Tutor API's dashboard.

**Baseline:** commit `195d96e` (main after Phase 6 chat removal).

## Important finding — no workflow-JSON import exists in AI Tutor API

Researched `aitutor-api.vercel.app` and its docs (`support.myapps.ai/aitutor-api/*`). AI Tutor API workflows are **a single prompt template + one selected model + settings**, created only through their own no-code dashboard UI — there is no documented API or file format to create/import a workflow programmatically. The `{{variable}}` placeholders in a workflow's prompt template must match the JSON body keys the calling app sends to `POST /api/v1/run/{workflow_id}`.

So the 3 JSON files this plan produces are **specs to guide manual setup** in AI Tutor API's dashboard (prompt template text, recommended model, the required variable name), not literal import files. Each spec's `setupNote` field says this explicitly.

## Design

- **New route segment**: `/dashboard/workflows/<slug>` (plural — distinct from the existing singular `/dashboard/workflow`, which is left alone and renamed "Custom Workflow" in the nav for clarity).
- **3 new env vars**, one workflow_id per example: `WORKFLOW_ID_REAL_ESTATE_ANALYSIS`, `WORKFLOW_ID_GOOGLE_ADS_ANALYSIS`, `WORKFLOW_ID_RESUME_SCREENING`. `AITUTOR_API_KEY` is shared across all workflows (unchanged).
- **`/api/run` generalized**: accepts either the legacy body `{ story: string }` (unchanged behavior — maps to `workflowKey: 'story-generator'`, env var `WORKFLOW_ID`, request to AI Tutor API stays `{ story }`) OR the new body `{ workflowKey: string, input: string }` (maps `workflowKey` → the corresponding `WORKFLOW_ID_*` env var, request to AI Tutor API is `{ input }`). This is 100% backward compatible with any already-configured `story-generator` workflow.
- **`workflow_history` gets a `workflowKey` column** (nullable varchar) so each page's history drawer only shows its own runs. `saveWorkflowHistory`/`getWorkflowHistory` both take a required `workflowKey` argument now. Existing pre-migration rows (workflowKey `NULL`) will no longer surface in any drawer once this lands — acceptable for a starter template with no real production history to preserve.
- **`/api/workflow/history`** takes a required `?workflowKey=` query param. **`WorkflowHistoryDrawer`** takes a required `workflowKey` prop, included in its React Query `queryKey` and its fetch URL.
- **New `Textarea` component** in `packages/ui` (doesn't exist yet) — the 3 new pages need multi-line input (property listings, ad metrics, resumes), unlike the original single-line story prompt.
- **New generic `WorkflowResultDisplay` component** (title-parameterized, same markdown-rendering approach as the existing `StoryDisplay`) for the 3 new pages. `StoryDisplay` itself is untouched (still used only by the original page).
- **`workflow-templates/` directory** at the repo root: one JSON spec per example, plus a `workflow-templates/README.md` explaining the no-import-feature caveat up front.

## Task 1 (Level 0a): Add Textarea to packages/ui
**Files:** `packages/ui/src/components/textarea.tsx` (new, standard shadcn-style Textarea — same visual language as `input.tsx`: border, ring-offset, focus-visible ring, disabled states), `packages/ui/package.json` exports map (`"./components/*"` pattern already covers it, confirm), `apps/web/tests/unit/textarea.test.tsx` (renders, forwards value/onChange, applies className).
**Verify:** `pnpm --filter web exec vitest run tests/unit/textarea.test.tsx` passes; `pnpm --filter @repo/ui exec tsc --noEmit` clean.

## Task 2 (Level 0b): workflowKey column + utils signatures
**Files:** `packages/db/src/schema.ts` (add `workflowKey: varchar('workflow_key', { length: 100 })` nullable to `workflowHistory` table), generated migration under `packages/db/migrations/`, `packages/db/src/utils.ts` (`saveWorkflowHistory(teamId, userId, input, output, workflowKey: string)`, `getWorkflowHistory(teamId, workflowKey: string, limit = 10)` — both now require `workflowKey` and filter/store by it), existing tests for these functions updated to pass a `workflowKey`.
**Verify:** `pnpm --filter @repo/db run db:generate` reports the new migration; `pnpm --filter web exec vitest run tests/unit/tiers-limit.test.ts` (or wherever these are tested) passes with Postgres reachable at `POSTGRES_URL`; `pnpm --filter web exec tsc --noEmit` clean (this will show errors in api/run and api/workflow/history routes until Tasks 3/4 land — that's expected, not a regression in this task).

## Task 3 (Level 1a, depends on 2): Generalize /api/run
**Files:** `apps/web/app/api/run/route.ts`, its test(s).
**Changes:** Accept `{ story }` (legacy) OR `{ workflowKey, input }` (new). A lookup map `{ 'story-generator': 'WORKFLOW_ID', 'real-estate-analysis': 'WORKFLOW_ID_REAL_ESTATE_ANALYSIS', 'google-ads-analysis': 'WORKFLOW_ID_GOOGLE_ADS_ANALYSIS', 'resume-screening': 'WORKFLOW_ID_RESUME_SCREENING' }` resolves the right env var. Body sent to AI Tutor API is `{ story: input }` for the legacy key, `{ input }` for all new keys. Call `saveWorkflowHistory(team.id, user.id, input, ..., workflowKey)` with the resolved key.
**Verify:** existing story-generator tests still pass unchanged; new tests cover a `workflowKey`-based call resolving to the right env var and body shape.

## Task 4 (Level 1b, depends on 2): Generalize history route + drawer
**Files:** `apps/web/app/api/workflow/history/route.ts` (require `?workflowKey=`, 400 if missing), `apps/web/components/workflow/WorkflowHistoryDrawer.tsx` (require a `workflowKey` prop, include in queryKey `['workflow-history', workflowKey]` and the fetch URL), their tests.
**Verify:** tests pass; `tsc --noEmit` clean for these two files (repo-wide tsc still won't be clean until Task 5 updates the original page's drawer usage).

## Task 5 (Level 2a, depends on 4): Migrate the original workflow page
**Files:** `apps/web/app/(dashboard)/dashboard/workflow/page.tsx` — pass `workflowKey="story-generator"` to its `<WorkflowHistoryDrawer>` instance. That's the only change needed (the route already infers the key server-side from the legacy `{ story }` body).
**Verify:** existing `workflow-page.test.tsx`/`workflow-page-mutation.test.tsx` still pass (update only if they assert on the drawer's props).

## Task 6 (Level 2b, depends on 1, 3, 4): Real Estate Investment Analysis page
**Files:** `apps/web/app/(dashboard)/dashboard/workflows/real-estate-analysis/page.tsx` (new — note the `(dashboard)` route group; the existing pages live at `apps/web/app/(dashboard)/dashboard/...`, NOT `apps/web/app/dashboard/...` — omitting the route group means the page won't get the dashboard layout/sidebar/auth wrapper at all), `apps/web/components/ai-tutor-api/WorkflowResultDisplay.tsx` (new, shared — first task to land it; if Tasks 7/8 also need it, they read it, don't recreate it — but since these run in parallel, each task should create it defensively only if absent; simplest: have Task 6 own creating `WorkflowResultDisplay.tsx`, note this to avoid duplicate creation by 7/8), its test file, `workflow-templates/real-estate-analysis.json` (new).
**Page UI:** Card with a `Textarea` (label "Property details", the sample input as placeholder or a "Load sample" button that fills the textarea from the JSON spec's `sampleInput`), submit button calling `/api/run` with `{ workflowKey: 'real-estate-analysis', input }`, a `WorkflowHistoryDrawer workflowKey="real-estate-analysis"`, and `<WorkflowResultDisplay title="Investment Analysis" result={...} />` on success. Same `useMutation` + React Query invalidation pattern (`['team-limit']`, `['workflow-history', 'real-estate-analysis']`) as the existing workflow page.
**JSON spec content (use verbatim):**
```json
{
  "name": "Real Estate Investment Analysis",
  "slug": "real-estate-analysis",
  "description": "Analyzes a property listing/deal and returns an investment analysis with a buy/hold/pass recommendation.",
  "recommendedModel": "gpt-4o (or an equivalent reasoning-capable model)",
  "systemInstructions": "You are an experienced real estate investment analyst. You evaluate residential and small multifamily properties for investment potential using conservative, data-driven assumptions. Always state your assumptions explicitly when data is missing.",
  "promptTemplate": "Analyze the following property for investment potential:\n\n{{input}}\n\nProvide your analysis as markdown with these sections:\n## Summary\nA 2-3 sentence verdict.\n## Estimated Cap Rate\nShow your math using any provided price, rent, and expense figures (assume standard operating-expense ratios if not given, and say so).\n## Cash Flow Snapshot\nEstimated monthly cash flow after typical mortgage, taxes, insurance, and maintenance reserves.\n## Risks & Red Flags\nBulleted list.\n## Recommendation\nBuy, Hold, or Pass, with a one-sentence reason.",
  "variables": ["input"],
  "settings": { "temperature": 0.4, "maxOutputTokens": 2000 },
  "sampleInput": "3-bed/2-bath single-family home in Austin, TX. Asking price $415,000. Estimated market rent $2,600/mo. Property taxes ~2.1%/yr. Built 1998, roof replaced 2019. HOA: none.",
  "setupNote": "AI Tutor API has no JSON-import feature - create a new workflow in its dashboard, paste systemInstructions into the system-prompt field and promptTemplate into the prompt field, name the template variable exactly 'input' (matching what this app sends), select recommendedModel (or an equivalent), then copy the published workflow_id into WORKFLOW_ID_REAL_ESTATE_ANALYSIS in apps/web/.env."
}
```
**Verify:** `pnpm --filter web exec vitest run tests/unit/real-estate-analysis-page.test.tsx` passes; `tsc --noEmit` clean for this file's own scope.

## Task 7 (Level 2b, depends on 1, 3, 4): Google Ads Campaign Analysis page
**Files:** `apps/web/app/(dashboard)/dashboard/workflows/google-ads-analysis/page.tsx` (new — same `(dashboard)` route-group note as Task 6), its test file, `workflow-templates/google-ads-analysis.json` (new). Reuse `WorkflowResultDisplay.tsx` from Task 6 if already present in the shared worktree by the time this runs; if not yet present, create it (identical content either way — title-parameterized wrapper around the same markdown-rendering approach as `StoryDisplay.tsx`) but do NOT overwrite a version that already exists and differs — check first.
**Page UI:** same pattern as Task 6, `workflowKey: 'google-ads-analysis'`, label "Campaign performance data", `WorkflowHistoryDrawer workflowKey="google-ads-analysis"`, `<WorkflowResultDisplay title="Campaign Analysis" .../>`.
**JSON spec content (use verbatim):**
```json
{
  "name": "Google Ads Campaign Analysis",
  "slug": "google-ads-analysis",
  "description": "Analyzes Google Ads campaign performance data and returns prioritized optimization recommendations.",
  "recommendedModel": "gpt-4o (or an equivalent reasoning-capable model)",
  "systemInstructions": "You are a senior paid-search analyst who audits Google Ads campaign performance and gives specific, prioritized optimization recommendations.",
  "promptTemplate": "Analyze the following Google Ads campaign performance data:\n\n{{input}}\n\nProvide your analysis as markdown with these sections:\n## Performance Summary\nKey metrics interpreted (CTR, CPC, conversion rate, ROAS/CPA if computable).\n## What's Working\nBulleted list.\n## What's Underperforming\nBulleted list, with the likely root cause for each.\n## Recommended Actions\nA prioritized, numbered list of concrete changes (bids, keywords, ad copy, targeting, budget shifts).\n## Suggested Next Test\nOne specific A/B test to run next.",
  "variables": ["input"],
  "settings": { "temperature": 0.3, "maxOutputTokens": 2000 },
  "sampleInput": "Campaign: 'Brand - Search'. Last 30 days: Impressions 42,300, Clicks 1,890 (CTR 4.5%), Avg CPC $1.85, Spend $3,496.50, Conversions 58 (Conv. rate 3.07%), Conversion value $8,700. Top keyword 'acme software pricing' has 210 clicks, 2 conversions.",
  "setupNote": "AI Tutor API has no JSON-import feature - create a new workflow in its dashboard, paste systemInstructions into the system-prompt field and promptTemplate into the prompt field, name the template variable exactly 'input' (matching what this app sends), select recommendedModel (or an equivalent), then copy the published workflow_id into WORKFLOW_ID_GOOGLE_ADS_ANALYSIS in apps/web/.env."
}
```
**Verify:** `pnpm --filter web exec vitest run tests/unit/google-ads-analysis-page.test.tsx` passes; `tsc --noEmit` clean for this file's own scope.

## Task 8 (Level 2b, depends on 1, 3, 4): Resume & Candidate Fit Analysis page
**Files:** `apps/web/app/(dashboard)/dashboard/workflows/resume-screening/page.tsx` (new — same `(dashboard)` route-group note as Task 6), its test file, `workflow-templates/resume-screening.json` (new). Same `WorkflowResultDisplay.tsx` note as Task 7.
**Page UI:** same pattern, `workflowKey: 'resume-screening'`, label "Resume & job description", `WorkflowHistoryDrawer workflowKey="resume-screening"`, `<WorkflowResultDisplay title="Candidate Fit Analysis" .../>`.
**JSON spec content (use verbatim):**
```json
{
  "name": "Resume & Candidate Fit Analysis",
  "slug": "resume-screening",
  "description": "Evaluates a candidate's resume against a job description and returns a fit score with interview questions.",
  "recommendedModel": "gpt-4o (or an equivalent reasoning-capable model)",
  "systemInstructions": "You are a technical recruiter who screens resumes against a specific job description objectively and without bias toward school prestige, employer brand names, or demographic signals. Focus only on demonstrated skills and experience relevant to the role.",
  "promptTemplate": "Evaluate the candidate's fit for the role using the resume and job description below:\n\n{{input}}\n\nProvide your analysis as markdown with these sections:\n## Fit Score\nA score from 1-10 with one sentence justifying it.\n## Matching Strengths\nBulleted list of specific resume experience that matches the job requirements.\n## Gaps or Concerns\nBulleted list of missing or unclear qualifications.\n## Suggested Interview Questions\n3-5 targeted questions to probe the gaps above.\n## Recommendation\nAdvance, Maybe (with what to clarify), or Pass, with a one-sentence reason.",
  "variables": ["input"],
  "settings": { "temperature": 0.4, "maxOutputTokens": 2000 },
  "sampleInput": "Job Description: Senior Backend Engineer, needs 5+ years Node.js/TypeScript, Postgres, AWS, and experience leading a small team.\n\nResume: Jane Doe - 6 years experience. 4 years Python/Django at a fintech startup, 2 years Node.js/TypeScript at current role building REST APIs on AWS Lambda with Postgres (RDS). Mentored 2 junior engineers informally. No formal team-lead title.",
  "setupNote": "AI Tutor API has no JSON-import feature - create a new workflow in its dashboard, paste systemInstructions into the system-prompt field and promptTemplate into the prompt field, name the template variable exactly 'input' (matching what this app sends), select recommendedModel (or an equivalent), then copy the published workflow_id into WORKFLOW_ID_RESUME_SCREENING in apps/web/.env."
}
```
**Verify:** `pnpm --filter web exec vitest run tests/unit/resume-screening-page.test.tsx` passes; `tsc --noEmit` clean for this file's own scope.

## Task 9 (Level 3, depends on 6, 7, 8): Nav entries
**Files:** `apps/web/lib/navigation/dashboard-nav-items.ts`, its test.
**Changes:** rename the existing `"Workflow"` entry's title to `"Custom Workflow"` (URL/icon unchanged). Add 3 new entries after it: `"Real Estate Analysis"` → `/dashboard/workflows/real-estate-analysis` (icon `Building2`), `"Google Ads Analysis"` → `/dashboard/workflows/google-ads-analysis` (icon `TrendingUp`), `"Resume Screening"` → `/dashboard/workflows/resume-screening` (icon `FileSearch`).
**Verify:** nav test passes; `pnpm --filter web exec tsc --noEmit` clean.

## Task 10 (Level 4, depends on 9): Env docs + workflow-templates README + final full-repo verification
**Files:** `apps/web/.env.example` (add the 3 new `WORKFLOW_ID_*` vars after the existing `WORKFLOW_ID`), `README.md` (document the 3 example workflows and point at `workflow-templates/`), `workflow-templates/README.md` (new — explain up front, prominently, that AI Tutor API has no JSON-import feature, these are manual-setup specs, and list the 3 files with the env var each maps to).
**Verify (whole repo):** `pnpm install && pnpm --filter web exec tsc --noEmit && pnpm --filter @repo/ui exec tsc --noEmit && pnpm --filter @repo/db exec tsc --noEmit` all clean; `pnpm --filter web exec vitest run` full suite green; `pnpm --filter web build` succeeds with `/dashboard/workflows/real-estate-analysis`, `/dashboard/workflows/google-ads-analysis`, `/dashboard/workflows/resume-screening` all in the route list.
