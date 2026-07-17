# Example Workflows: Real Estate, Google Ads, Resume Screening

**Goal:** Add 3 new example workflow pages (Real Estate Investment Analysis, Google Ads Campaign Analysis, Resume & Candidate Fit Analysis), each in the sidebar, each backed by its own AI Tutor API workflow ID, plus a per-workflow JSON spec matching AI Tutor API's real template structure so the user can quickly recreate each workflow in AI Tutor API's dashboard.

**Baseline:** commit `188ce5f` on branch `example-workflows` (rebased onto main after Phase 6 chat removal + the metadata/OpenGraph update).

## Corrected finding — AI Tutor API's real "import a template" mechanic

Browsed `aitutor-api.vercel.app` and `aitutor-api.vercel.app/workflows-guide` directly (an earlier research pass relying only on passive doc fetches missed this). AI Tutor API's own six-step "Create workflow" flow is: **"Create workflow → Use the visual builder or import a template."** They ship a built-in gallery of ready-made templates (Blog Post Generator, Code Review Assistant, Smart Email Composer, Document Data Extractor, Adaptive Tutor Engine, Research Analyst) — each with a defined shape shown in their UI: **category, description, Recommended model, Input Variables (a list of `{{variable}}` names), System Instructions, User Prompt Template**. Selecting one pre-fills a new workflow with that configuration; there's a "Copy" button on the System Instructions and User Prompt Template fields for pasting into your own workflow, but no confirmed "upload a custom JSON file" affordance for a template that isn't already in their built-in gallery (checked for an export/download icon near the template detail view — none found beyond the two field-level Copy buttons).

So: real estate / Google Ads / resume-screening aren't in AI Tutor's built-in gallery, and there's no confirmed way to bulk-upload a brand-new custom template as a file. The 3 JSON files this plan produces are **specs matching AI Tutor's own real field structure** (same field names/shape as their built-in templates) so a user can quickly hand-enter each one as a new custom workflow in the dashboard — not a literal upload-and-done import. Each spec's `setupNote` says this plainly.

**Also confirmed: workflows support multiple named variables in one prompt template** (AI Tutor's own Blog Post Generator example uses `{{topic}}`, `{{tone}}`, `{{word_count}}` together), and AI Tutor's own published advice explicitly says to prefer descriptive variable names over a generic `{{input}}`. This plan follows that: each example workflow gets its own descriptive variable name(s), and Resume & Candidate Fit Analysis uses two separate variables (`resume`, `job_description`) with two separate form fields, since that's a materially better UX than jamming both into one field — not just a single catch-all blob.

## Design

- **New route segment**: `/dashboard/workflows/<slug>` (plural — distinct from the existing singular `/dashboard/workflow`, left alone and renamed "Custom Workflow" in the nav for clarity).
- **3 new env vars**, one workflow_id per example: `WORKFLOW_ID_REAL_ESTATE_ANALYSIS`, `WORKFLOW_ID_GOOGLE_ADS_ANALYSIS`, `WORKFLOW_ID_RESUME_SCREENING`. `AITUTOR_API_KEY` is shared across all workflows (unchanged).
- **`/api/run` generalized**: accepts either the legacy body `{ story: string }` (unchanged behavior — maps to `workflowKey: 'story-generator'`, env var `WORKFLOW_ID`, request to AI Tutor API stays `{ story }`) OR the new body `{ workflowKey: string, variables: Record<string, string> }` (maps `workflowKey` → the corresponding `WORKFLOW_ID_*` env var; `variables` is spread directly as the JSON body sent to AI Tutor API, so its keys must exactly match that workflow's own `{{variable}}` names). This is 100% backward compatible with any already-configured `story-generator` workflow.
- **`workflow_history` gets a `workflowKey` column** (nullable varchar) so each page's history drawer only shows its own runs. `saveWorkflowHistory`/`getWorkflowHistory` both take a required `workflowKey` argument now, and the "input" stored/displayed for history purposes is a single joined/serialized string built from the `variables` map (e.g. `Object.entries(variables).map(([k,v]) => `${k}: ${v}`).join('\n\n')`) so the history drawer can still show one readable summary regardless of how many variables a workflow has. Existing pre-migration rows (workflowKey `NULL`) will no longer surface in any drawer once this lands — acceptable for a starter template with no real production history to preserve.
- **`/api/workflow/history`** takes a required `?workflowKey=` query param. **`WorkflowHistoryDrawer`** takes a required `workflowKey` prop, included in its React Query `queryKey` and its fetch URL. Its `onSelectHistory(input, output)` callback still passes a single joined input string back to the page (each new page's "restore from history" just drops that joined string into its first/primary field, or — simplest and safest — into a full re-fill only for single-variable workflows; for the 2-variable resume-screening page, restoring from history can just populate BOTH fields with an explanatory note if a clean split isn't feasible, or simplest of all: keep the joined string display in the drawer read-only and only implement click-to-restore for single-variable pages (6, 7), skip click-to-restore wiring for the 2-variable page (8) if it adds meaningfully more complexity — a history drawer that only displays past runs without one-click restore is still useful and is not a regression since this is a wholly new page).
- **New `Textarea` component** in `packages/ui` (doesn't exist yet) — the 3 new pages need multi-line input (property listings, ad metrics, resumes, job descriptions), unlike the original single-line story prompt.
- **New generic `WorkflowResultDisplay` component** (title-parameterized, same markdown-rendering approach as the existing `StoryDisplay`) for the 3 new pages. `StoryDisplay` itself is untouched (still used only by the original page).
- **`workflow-templates/` directory** at the repo root: one JSON spec per example, plus a `workflow-templates/README.md` explaining the real "pick from gallery vs. hand-enter a custom template" mechanic up front.

## Task 1 (Level 0a): Add Textarea to packages/ui
**Files:** `packages/ui/src/components/textarea.tsx` (new, standard shadcn-style Textarea — same visual language as `input.tsx`: border, ring-offset, focus-visible ring, disabled states), `packages/ui/package.json` exports map (`"./components/*"` pattern already covers it, confirm), `apps/web/tests/unit/textarea.test.tsx` (renders, forwards value/onChange, applies className).
**Verify:** `pnpm --filter web exec vitest run tests/unit/textarea.test.tsx` passes; `pnpm --filter @repo/ui exec tsc --noEmit` clean.

## Task 2 (Level 0b): workflowKey column + utils signatures
**Files:** `packages/db/src/schema.ts` (add `workflowKey: varchar('workflow_key', { length: 100 })` nullable to `workflowHistory` table), generated migration under `packages/db/migrations/`, `packages/db/src/utils.ts` (`saveWorkflowHistory(teamId, userId, input, output, workflowKey: string)`, `getWorkflowHistory(teamId, workflowKey: string, limit = 10)` — both now require `workflowKey` and filter/store by it), existing tests for these functions updated to pass a `workflowKey`.
**Verify:** `pnpm --filter @repo/db run db:generate` reports the new migration; `pnpm --filter web exec vitest run tests/unit/tiers-limit.test.ts` (or wherever these are tested) passes with Postgres reachable at `POSTGRES_URL`; `pnpm --filter web exec tsc --noEmit` clean (this will show errors in api/run and api/workflow/history routes until Tasks 3/4 land — that's expected, not a regression in this task).

## Task 3 (Level 1a, depends on 2): Generalize /api/run
**Files:** `apps/web/app/api/run/route.ts`, its test(s).
**Changes:** Accept `{ story }` (legacy) OR `{ workflowKey, variables }` where `variables` is `Record<string, string>`. A lookup map `{ 'story-generator': 'WORKFLOW_ID', 'real-estate-analysis': 'WORKFLOW_ID_REAL_ESTATE_ANALYSIS', 'google-ads-analysis': 'WORKFLOW_ID_GOOGLE_ADS_ANALYSIS', 'resume-screening': 'WORKFLOW_ID_RESUME_SCREENING' }` resolves the right env var. Body sent to AI Tutor API is `{ story }` for the legacy key, `{ ...variables }` (spread directly) for all new keys. Build a joined display string from `variables` (see Design section) and call `saveWorkflowHistory(team.id, user.id, joinedInput, ..., workflowKey)` with the resolved key.
**Verify:** existing story-generator tests still pass unchanged; new tests cover a `workflowKey`-based call resolving to the right env var and spreading `variables` into the AI Tutor API request body correctly (including the 2-variable resume-screening case).

## Task 4 (Level 1b, depends on 2): Generalize history route + drawer
**Files:** `apps/web/app/api/workflow/history/route.ts` (require `?workflowKey=`, 400 if missing), `apps/web/components/workflow/WorkflowHistoryDrawer.tsx` (require a `workflowKey` prop, include in queryKey `['workflow-history', workflowKey]` and the fetch URL), their tests.
**Verify:** tests pass; `tsc --noEmit` clean for these two files (repo-wide tsc still won't be clean until Task 5 updates the original page's drawer usage).

## Task 5 (Level 2a, depends on 4): Migrate the original workflow page
**Files:** `apps/web/app/(dashboard)/dashboard/workflow/page.tsx` — pass `workflowKey="story-generator"` to its `<WorkflowHistoryDrawer>` instance. That's the only change needed (the route already infers the key server-side from the legacy `{ story }` body).
**Verify:** existing `workflow-page.test.tsx`/`workflow-page-mutation.test.tsx` still pass (update only if they assert on the drawer's props).

## Task 6 (Level 2b, depends on 1, 3, 4): Real Estate Investment Analysis page
**Files:** `apps/web/app/(dashboard)/dashboard/workflows/real-estate-analysis/page.tsx` (new — note the `(dashboard)` route group; the existing pages live at `apps/web/app/(dashboard)/dashboard/...`, NOT `apps/web/app/dashboard/...` — omitting the route group means the page won't get the dashboard layout/sidebar/auth wrapper at all), `apps/web/components/ai-tutor-api/WorkflowResultDisplay.tsx` (new, shared — this task owns creating it; Tasks 7/8 read it, don't recreate/overwrite it), its test file, `workflow-templates/real-estate-analysis.json` (new).
**Single variable:** `property_details`.
**Page UI:** Card with a `Textarea` (label "Property details", a "Load sample" button that fills the textarea from the JSON spec's `sampleInput`), submit button calling `/api/run` with `{ workflowKey: 'real-estate-analysis', variables: { property_details } }`, a `WorkflowHistoryDrawer workflowKey="real-estate-analysis"` with click-to-restore into the single field, and `<WorkflowResultDisplay title="Investment Analysis" result={...} />` on success. Same `useMutation` + React Query invalidation pattern (`['team-limit']`, `['workflow-history', 'real-estate-analysis']`) as the existing workflow page.
**JSON spec content (use verbatim, field names match AI Tutor API's own template UI labels):**
```json
{
  "name": "Real Estate Investment Analysis",
  "slug": "real-estate-analysis",
  "category": "Business",
  "description": "Analyzes a property listing/deal and returns an investment analysis with a buy/hold/pass recommendation.",
  "recommendedModel": "GPT-5 (or an equivalent reasoning-capable model)",
  "inputVariables": ["property_details"],
  "systemInstructions": "You are an experienced real estate investment analyst. You evaluate residential and small multifamily properties for investment potential using conservative, data-driven assumptions. Always state your assumptions explicitly when data is missing.",
  "userPromptTemplate": "Analyze the following property for investment potential:\n\n{{property_details}}\n\nProvide your analysis as markdown with these sections:\n## Summary\nA 2-3 sentence verdict.\n## Estimated Cap Rate\nShow your math using any provided price, rent, and expense figures (assume standard operating-expense ratios if not given, and say so).\n## Cash Flow Snapshot\nEstimated monthly cash flow after typical mortgage, taxes, insurance, and maintenance reserves.\n## Risks & Red Flags\nBulleted list.\n## Recommendation\nBuy, Hold, or Pass, with a one-sentence reason.",
  "settings": { "temperature": 0.4, "maxOutputTokens": 2000 },
  "sampleInput": { "property_details": "3-bed/2-bath single-family home in Austin, TX. Asking price $415,000. Estimated market rent $2,600/mo. Property taxes ~2.1%/yr. Built 1998, roof replaced 2019. HOA: none." },
  "setupNote": "AI Tutor API's built-in template gallery doesn't include this one - create a new workflow in its dashboard, paste systemInstructions into the System Instructions field and userPromptTemplate into the User Prompt Template field, add an input variable named exactly 'property_details' (matching what this app sends), select recommendedModel (or an equivalent), then copy the published workflow_id into WORKFLOW_ID_REAL_ESTATE_ANALYSIS in apps/web/.env."
}
```
**Verify:** `pnpm --filter web exec vitest run tests/unit/real-estate-analysis-page.test.tsx` passes; `tsc --noEmit` clean for this file's own scope.

## Task 7 (Level 2b, depends on 1, 3, 4): Google Ads Campaign Analysis page
**Files:** `apps/web/app/(dashboard)/dashboard/workflows/google-ads-analysis/page.tsx` (new — same `(dashboard)` route-group note as Task 6), its test file, `workflow-templates/google-ads-analysis.json` (new). Reuse `WorkflowResultDisplay.tsx` from Task 6 if already present in the shared worktree by the time this runs; if not yet present, create it (identical content either way) but do NOT overwrite a version that already exists and differs — check first.
**Single variable:** `campaign_data`.
**Page UI:** same pattern as Task 6, `workflowKey: 'google-ads-analysis'`, `variables: { campaign_data }`, label "Campaign performance data", `WorkflowHistoryDrawer workflowKey="google-ads-analysis"` with click-to-restore, `<WorkflowResultDisplay title="Campaign Analysis" .../>`.
**JSON spec content (use verbatim):**
```json
{
  "name": "Google Ads Campaign Analysis",
  "slug": "google-ads-analysis",
  "category": "Business",
  "description": "Analyzes Google Ads campaign performance data and returns prioritized optimization recommendations.",
  "recommendedModel": "GPT-5 (or an equivalent reasoning-capable model)",
  "inputVariables": ["campaign_data"],
  "systemInstructions": "You are a senior paid-search analyst who audits Google Ads campaign performance and gives specific, prioritized optimization recommendations.",
  "userPromptTemplate": "Analyze the following Google Ads campaign performance data:\n\n{{campaign_data}}\n\nProvide your analysis as markdown with these sections:\n## Performance Summary\nKey metrics interpreted (CTR, CPC, conversion rate, ROAS/CPA if computable).\n## What's Working\nBulleted list.\n## What's Underperforming\nBulleted list, with the likely root cause for each.\n## Recommended Actions\nA prioritized, numbered list of concrete changes (bids, keywords, ad copy, targeting, budget shifts).\n## Suggested Next Test\nOne specific A/B test to run next.",
  "settings": { "temperature": 0.3, "maxOutputTokens": 2000 },
  "sampleInput": { "campaign_data": "Campaign: 'Brand - Search'. Last 30 days: Impressions 42,300, Clicks 1,890 (CTR 4.5%), Avg CPC $1.85, Spend $3,496.50, Conversions 58 (Conv. rate 3.07%), Conversion value $8,700. Top keyword 'acme software pricing' has 210 clicks, 2 conversions." },
  "setupNote": "AI Tutor API's built-in template gallery doesn't include this one - create a new workflow in its dashboard, paste systemInstructions into the System Instructions field and userPromptTemplate into the User Prompt Template field, add an input variable named exactly 'campaign_data' (matching what this app sends), select recommendedModel (or an equivalent), then copy the published workflow_id into WORKFLOW_ID_GOOGLE_ADS_ANALYSIS in apps/web/.env."
}
```
**Verify:** `pnpm --filter web exec vitest run tests/unit/google-ads-analysis-page.test.tsx` passes; `tsc --noEmit` clean for this file's own scope.

## Task 8 (Level 2b, depends on 1, 3, 4): Resume & Candidate Fit Analysis page
**Files:** `apps/web/app/(dashboard)/dashboard/workflows/resume-screening/page.tsx` (new — same `(dashboard)` route-group note as Task 6), its test file, `workflow-templates/resume-screening.json` (new). Same `WorkflowResultDisplay.tsx` note as Task 7.
**Two variables:** `job_description`, `resume` — this page has TWO Textareas, one per variable, unlike Tasks 6/7's single field.
**Page UI:** same overall pattern, `workflowKey: 'resume-screening'`, `variables: { job_description, resume }` (both required — disable submit until both are non-empty), `WorkflowHistoryDrawer workflowKey="resume-screening"` (history entries show the joined `job_description`/`resume` summary; click-to-restore may populate both fields from the joined string if straightforward, otherwise it's fine for this page's drawer to be read-only/informational without restore-to-form wiring — do not over-engineer a fragile parse of the joined string), `<WorkflowResultDisplay title="Candidate Fit Analysis" .../>`.
**JSON spec content (use verbatim):**
```json
{
  "name": "Resume & Candidate Fit Analysis",
  "slug": "resume-screening",
  "category": "Business",
  "description": "Evaluates a candidate's resume against a job description and returns a fit score with interview questions.",
  "recommendedModel": "GPT-5 (or an equivalent reasoning-capable model)",
  "inputVariables": ["job_description", "resume"],
  "systemInstructions": "You are a technical recruiter who screens resumes against a specific job description objectively and without bias toward school prestige, employer brand names, or demographic signals. Focus only on demonstrated skills and experience relevant to the role.",
  "userPromptTemplate": "Job Description:\n{{job_description}}\n\nResume:\n{{resume}}\n\nEvaluate the candidate's fit for the role above. Provide your analysis as markdown with these sections:\n## Fit Score\nA score from 1-10 with one sentence justifying it.\n## Matching Strengths\nBulleted list of specific resume experience that matches the job requirements.\n## Gaps or Concerns\nBulleted list of missing or unclear qualifications.\n## Suggested Interview Questions\n3-5 targeted questions to probe the gaps above.\n## Recommendation\nAdvance, Maybe (with what to clarify), or Pass, with a one-sentence reason.",
  "settings": { "temperature": 0.4, "maxOutputTokens": 2000 },
  "sampleInput": {
    "job_description": "Senior Backend Engineer, needs 5+ years Node.js/TypeScript, Postgres, AWS, and experience leading a small team.",
    "resume": "Jane Doe - 6 years experience. 4 years Python/Django at a fintech startup, 2 years Node.js/TypeScript at current role building REST APIs on AWS Lambda with Postgres (RDS). Mentored 2 junior engineers informally. No formal team-lead title."
  },
  "setupNote": "AI Tutor API's built-in template gallery doesn't include this one - create a new workflow in its dashboard, paste systemInstructions into the System Instructions field and userPromptTemplate into the User Prompt Template field, add TWO input variables named exactly 'job_description' and 'resume' (matching what this app sends), select recommendedModel (or an equivalent), then copy the published workflow_id into WORKFLOW_ID_RESUME_SCREENING in apps/web/.env."
}
```
**Verify:** `pnpm --filter web exec vitest run tests/unit/resume-screening-page.test.tsx` passes; `tsc --noEmit` clean for this file's own scope.

## Task 9 (Level 3, depends on 6, 7, 8): Nav entries
**Files:** `apps/web/lib/navigation/dashboard-nav-items.ts`, its test.
**Changes:** rename the existing `"Workflow"` entry's title to `"Custom Workflow"` (URL/icon unchanged). Add 3 new entries after it: `"Real Estate Analysis"` → `/dashboard/workflows/real-estate-analysis` (icon `Building2`), `"Google Ads Analysis"` → `/dashboard/workflows/google-ads-analysis` (icon `TrendingUp`), `"Resume Screening"` → `/dashboard/workflows/resume-screening` (icon `FileSearch`).
**Verify:** nav test passes; `pnpm --filter web exec tsc --noEmit` clean.

## Task 10 (Level 4, depends on 9): Env docs + workflow-templates README + final full-repo verification
**Files:** `apps/web/.env.example` (add the 3 new `WORKFLOW_ID_*` vars after the existing `WORKFLOW_ID`), `README.md` (document the 3 example workflows and point at `workflow-templates/`), `workflow-templates/README.md` (new — explain up front how AI Tutor API workflows actually work: pick from their built-in gallery OR hand-enter a custom one with a Recommended Model + Input Variables + System Instructions + User Prompt Template; these 3 files are specs formatted to match that real structure for fast manual entry, not a one-click upload; list the 3 files with the env var and variable name(s) each maps to).
**Verify (whole repo):** `pnpm install && pnpm --filter web exec tsc --noEmit && pnpm --filter @repo/ui exec tsc --noEmit && pnpm --filter @repo/db exec tsc --noEmit` all clean; `pnpm --filter web exec vitest run` full suite green; `pnpm --filter web build` succeeds with `/dashboard/workflows/real-estate-analysis`, `/dashboard/workflows/google-ads-analysis`, `/dashboard/workflows/resume-screening` all in the route list.
