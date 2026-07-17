# Workflow Templates

This directory contains **directly importable** JSON files for the 3 example workflow pages shipped in this starter (Real Estate Investment Analysis, Google Ads Campaign Proposal, Resume Improvement Analysis). Each is designed to need as little manual input as possible — an address, a URL, a resume — and leans on AI Tutor API's native **web search**, **URL content fetching**, and **structured output** features to do the research and return a JSON object the page can render into real UI (stat blocks, badges, lists) instead of a text blob.

## How to import a workflow into AI Tutor API

AI Tutor API's Workflows page (`https://aitutor-api.vercel.app/workflows`, once signed in) has a real **Import** button next to **New**, which opens an "Import Workflow from JSON" dialog — select or drag-and-drop one of the files below.

1. Go to `https://aitutor-api.vercel.app/workflows` and sign in.
2. Click **Import**, then select one of the 3 `.json` files in this directory.
3. The workflow is created immediately with the file's name, model, prompt template, input variables, web search setting, and structured-output schema already filled in.
4. Open the new workflow and copy its **workflow_id** (the `wf_...` string — visible under the API tab, or by exporting the workflow again and reading its `id` field).
5. Paste that `workflow_id` into the matching environment variable below, in `apps/web/.env`.

## The real import JSON schema

Confirmed directly by exporting an existing workflow from a live account (`Workflows → open a workflow → Export`):

```json
{
  "id": "wf_...",
  "name": "...",
  "model": "gpt-5.6-luna",
  "template": "...prompt text with {{variable}} placeholders...",
  "inputs": [{ "name": "variable_name", "label": "Human-readable label", "type": "text | textarea | number | url | image" }],
  "modelSettings": "{\"enableWebSearch\":true,\"maxTokens\":2500,\"temperature\":0.4,\"structuredOutputSchema\":\"{...a JSON Schema string...}\"}"
}
```

Notes:
- `id` is omitted from the 3 files below — leave it out when importing a *new* workflow; AI Tutor API assigns a fresh one.
- There is no separate system-instructions field — `template` is the entire prompt (framing + task + `{{variables}}`) as one string.
- `inputs[].type` defaults to `"text"` when omitted. `"url"` is special: AI Tutor API fetches and extracts that URL's page content server-side automatically before running the model, so this app just sends the raw URL string — no scraping needed. `"textarea"` is a multi-line field (used for the resume).
- `modelSettings` is a JSON **string**, not a nested object. `enableWebSearch: true` grounds the model in real-time web search (used for real estate and Google Ads, where the model needs to look things up itself rather than being told the answer). `structuredOutputSchema` is itself a JSON-Schema-formatted string (double-stringified) that AI Tutor API enforces server-side — the model's response is guaranteed to match that shape, so this app can `JSON.parse()` it directly instead of hoping the model followed formatting instructions in the prompt.
- `model` is `gpt-5.6-luna` for all 3, confirmed as a real, valid model ID for this account — swap it for another supported model if you prefer.

## Files

| File | Workflow page | Env var | Input(s) | Web search | Notes |
| --- | --- | --- | --- | --- | --- |
| [`real-estate-analysis.json`](./real-estate-analysis.json) | Real Estate Investment Analysis (`/dashboard/workflows/real-estate-analysis`) | `WORKFLOW_ID_REAL_ESTATE_ANALYSIS` | `property_address` | Yes | Just an address — the model searches for the property's market value, rent estimate, and property type itself, then computes cap rate and cash flow. |
| [`google-ads-analysis.json`](./google-ads-analysis.json) | Google Ads Campaign Proposal (`/dashboard/workflows/google-ads-analysis`) | `WORKFLOW_ID_GOOGLE_ADS_ANALYSIS` | `website_url` (type `url`) | Yes | Just a website link — AI Tutor API fetches the page content and the model proposes a ready-to-launch campaign (audience, budget, keywords, ad variations). |
| [`resume-screening.json`](./resume-screening.json) | Resume Improvement Analysis (`/dashboard/workflows/resume-screening`) | `WORKFLOW_ID_RESUME_SCREENING` | `job_listing_url` (type `url`), `resume` (type `textarea`) | No | A listing link (fetched automatically) plus the resume text — the model gives the *candidate* specific advice on improving their resume for that role. |

Each page has a "Load sample" button that fills the field(s) with realistic example input for a quick end-to-end test once the workflow ID is wired up, and renders the model's structured JSON response into a bespoke result view — falling back to a plain markdown display if a particular run's response doesn't parse cleanly.
