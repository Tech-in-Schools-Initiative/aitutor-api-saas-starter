# Workflow Templates

This directory contains **directly importable** JSON files for the 3 example workflow pages shipped in this starter (Real Estate Investment Analysis, Google Ads Campaign Analysis, Resume & Candidate Fit Analysis). Each defines several distinct, descriptively-named input variables and instructs the model to respond with a single structured JSON object (not markdown), so the corresponding page can render real UI elements — a verdict pill, stat blocks, lists — instead of a text blob.

## How to import a workflow into AI Tutor API

AI Tutor API's Workflows page (`https://aitutor-api.vercel.app/workflows`, once signed in) has a real **Import** button next to **New**, which opens an "Import Workflow from JSON" dialog — select or drag-and-drop one of the files below.

1. Go to `https://aitutor-api.vercel.app/workflows` and sign in.
2. Click **Import**, then select one of the 3 `.json` files in this directory.
3. The workflow is created immediately with the file's name, model, prompt template, and input variables already filled in.
4. Open the new workflow and copy its **workflow_id** (the `wf_...` string — visible under the API tab, or by exporting the workflow again and reading its `id` field).
5. Paste that `workflow_id` into the matching environment variable below, in `apps/web/.env`.

## The real import JSON schema

Confirmed directly by exporting an existing workflow from a live account (`Workflows → open a workflow → Export`):

```json
{
  "id": "wf_...",
  "name": "...",
  "model": "gpt-5.6-luna",
  "template": "...prompt text with {{variable}} placeholders, instructing the model to respond with structured JSON...",
  "inputs": [{ "name": "variable_name", "label": "Human-readable label" }],
  "modelSettings": "{}"
}
```

Notes:
- `id` is omitted from the 3 files below — leave it out when importing a *new* workflow; AI Tutor API assigns a fresh one.
- There is no separate system-instructions field — `template` is the entire prompt (system framing + task instructions + `{{variables}}` + the structured-output instructions) as one string.
- `inputs` lists several variables per workflow (5-7). The variable `name`s must exactly match the JSON keys this app sends in its `/api/run` request body (see the table below) — each one becomes its own labeled field on the workflow's page.
- Each `template` ends with an explicit instruction to respond with ONLY a single JSON object matching a fixed schema (no markdown fences, no commentary). This app's pages `JSON.parse()` the model's response and render it into real structured UI; if parsing fails or required keys are missing, the page falls back to a plain markdown display instead of breaking.
- `modelSettings` is a JSON string (not a nested object) — `"{}"` uses the model's defaults.
- `model` is `gpt-5.6-luna` for all 3, confirmed as a real, valid model ID for this account — swap it for another supported model if you prefer.

## Files

| File | Workflow page | Env var | Variables (all sent under `variables: {...}`) |
| --- | --- | --- | --- |
| [`real-estate-analysis.json`](./real-estate-analysis.json) | Real Estate Investment Analysis (`/dashboard/workflows/real-estate-analysis`) | `WORKFLOW_ID_REAL_ESTATE_ANALYSIS` | `property_address`, `property_type`, `asking_price`, `estimated_monthly_rent`, `annual_property_taxes`, `monthly_hoa`, `notable_features` |
| [`google-ads-analysis.json`](./google-ads-analysis.json) | Google Ads Campaign Analysis (`/dashboard/workflows/google-ads-analysis`) | `WORKFLOW_ID_GOOGLE_ADS_ANALYSIS` | `campaign_name`, `impressions`, `clicks`, `spend`, `conversions`, `conversion_value`, `top_keyword_data` |
| [`resume-screening.json`](./resume-screening.json) | Resume & Candidate Fit Analysis (`/dashboard/workflows/resume-screening`) | `WORKFLOW_ID_RESUME_SCREENING` | `job_title`, `must_have_skills`, `years_experience_required`, `job_description`, `resume` |

Each corresponding workflow page has a "Load sample" button that fills every field with realistic example text for a quick end-to-end test once the workflow ID is wired up. Each page also renders a structured result view (verdict/score badges, stat blocks, bulleted lists) built from the model's JSON response — with a plain-text fallback if a particular run's response doesn't parse cleanly.
