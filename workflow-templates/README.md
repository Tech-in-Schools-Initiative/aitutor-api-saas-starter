# Workflow Templates

This directory contains **directly importable** JSON files for the 3 example workflow pages shipped in this starter (Real Estate Investment Analysis, Google Ads Campaign Analysis, Resume & Candidate Fit Analysis).

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
  "model": "gpt-4o",
  "template": "...prompt text with {{variable}} placeholders...",
  "inputs": [{ "name": "variable_name", "label": "Human-readable label" }],
  "modelSettings": "{}"
}
```

Notes:
- `id` is omitted from the 3 files below — leave it out when importing a *new* workflow; AI Tutor API assigns a fresh one.
- There is no separate system-instructions field — `template` is the entire prompt (system framing + task instructions + `{{variables}}`) as one string.
- `inputs` can list one or more variables. The variable `name`s must exactly match the JSON keys this app sends in its `/api/run` request body (see the table below).
- `modelSettings` is a JSON string (not a nested object) — `"{}"` uses the model's defaults.
- `model` must be a real model ID your account has access to. `gpt-4o` is used here since it's a confirmed-valid ID; swap it for another supported model if you prefer.

## Files

| File | Workflow page | Env var | Variable name(s) sent by the app |
| --- | --- | --- | --- |
| [`real-estate-analysis.json`](./real-estate-analysis.json) | Real Estate Investment Analysis (`/dashboard/workflows/real-estate-analysis`) | `WORKFLOW_ID_REAL_ESTATE_ANALYSIS` | `property_details` |
| [`google-ads-analysis.json`](./google-ads-analysis.json) | Google Ads Campaign Analysis (`/dashboard/workflows/google-ads-analysis`) | `WORKFLOW_ID_GOOGLE_ADS_ANALYSIS` | `campaign_data` |
| [`resume-screening.json`](./resume-screening.json) | Resume & Candidate Fit Analysis (`/dashboard/workflows/resume-screening`) | `WORKFLOW_ID_RESUME_SCREENING` | `job_description`, `resume` |

Each corresponding workflow page has a "Load sample" button that fills the form with realistic example text for a quick end-to-end test once the workflow ID is wired up.
