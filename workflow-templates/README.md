# Workflow Templates

This directory contains **specs**, not upload-and-done templates, for the 3 example workflow pages shipped in this starter (Real Estate Investment Analysis, Google Ads Campaign Analysis, Resume & Candidate Fit Analysis). Read this before you try to "import" one.

## How AI Tutor API workflows actually work

AI Tutor API's own "Create workflow" flow is a six-step process: **Create workflow → use the visual builder or import a template.** "Import a template" means picking one of AI Tutor API's own **built-in** gallery templates (Blog Post Generator, Code Review Assistant, Smart Email Composer, Document Data Extractor, Adaptive Tutor Engine, Research Analyst) — selecting one pre-fills a new workflow for you. Each built-in template (and every custom workflow you create by hand) is defined by the same shape:

- **Category** – a short grouping label (e.g. "Business").
- **Description** – a one-line summary of what the workflow does.
- **Recommended model** – the model AI Tutor API suggests running the workflow with.
- **Input Variables** – a list of `{{variable}}` names the prompt template references. AI Tutor API's own guidance is to prefer descriptive names (`{{topic}}`, `{{tone}}`) over a single generic `{{input}}`.
- **System Instructions** – the system prompt.
- **User Prompt Template** – the user-facing prompt, referencing the input variables with `{{double-brace}}` syntax. The System Instructions and User Prompt Template fields each have a "Copy" button in AI Tutor API's UI for pasting into a workflow you're building.

There is **no confirmed way to bulk-upload a brand-new custom template as a file** — real estate analysis, Google Ads analysis, and resume screening aren't in AI Tutor API's built-in gallery, and no export/import affordance for custom templates was found beyond the two field-level Copy buttons on an existing workflow's detail view.

## What's in this directory

The 3 JSON files below are **specs formatted to match AI Tutor API's own real template field structure** (same field names/shape as their built-in templates), so you can quickly hand-enter each one as a new custom workflow in the AI Tutor API dashboard. Each file's own `setupNote` field repeats these steps for that specific workflow. To set one up:

1. In the AI Tutor API dashboard, choose **Create workflow → use the visual builder** (not "import a template" — these 3 aren't in the built-in gallery).
2. Copy the file's `systemInstructions` value into the **System Instructions** field.
3. Copy the file's `userPromptTemplate` value into the **User Prompt Template** field.
4. Add the input variable(s) listed in `inputVariables`, spelled exactly as shown — the app sends these as JSON keys, so the names must match exactly.
5. Select the model named in `recommendedModel`, or an equivalent reasoning-capable model.
6. Publish the workflow and copy its `workflow_id` into the matching environment variable below, in `apps/web/.env`.

| File | Workflow page | Env var | Variable name(s) sent by the app |
| --- | --- | --- | --- |
| [`real-estate-analysis.json`](./real-estate-analysis.json) | Real Estate Investment Analysis (`/dashboard/workflows/real-estate-analysis`) | `WORKFLOW_ID_REAL_ESTATE_ANALYSIS` | `property_details` |
| [`google-ads-analysis.json`](./google-ads-analysis.json) | Google Ads Campaign Analysis (`/dashboard/workflows/google-ads-analysis`) | `WORKFLOW_ID_GOOGLE_ADS_ANALYSIS` | `campaign_data` |
| [`resume-screening.json`](./resume-screening.json) | Resume & Candidate Fit Analysis (`/dashboard/workflows/resume-screening`) | `WORKFLOW_ID_RESUME_SCREENING` | `job_description`, `resume` |

Each file also includes a `sampleInput` value matching its variable name(s) — this is the same sample text the page's "Load sample" button fills into the form, useful for a quick end-to-end test once the workflow ID is wired up.
