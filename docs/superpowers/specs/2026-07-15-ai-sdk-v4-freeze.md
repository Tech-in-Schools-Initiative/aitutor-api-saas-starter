# `ai` SDK frozen at v4.x (2026-07-15)

Phase 1 Task 10 of the modernization plan attempted the `ai` v4->v7 hop-by-hop
upgrade, per the user's explicit decision to attempt the full upgrade rather
than default to a freeze. The mandatory gate check (Step 1: inspecting the
real response from the external `https://aitutor-api.vercel.app/api/v1/chat/{token}/stream`
proxy) **could not be performed** -- this environment has no real
AITUTOR_API_KEY/WORKFLOW_ID/NEXT_PUBLIC_AITUTOR_TOKEN credentials configured.

This is an **unverified unknown, not a confirmed incompatibility**. The
upstream service may well be compatible with @ai-sdk/react v5+'s UI Message
Stream protocol -- nobody has checked.

`ai` is pinned at the latest 4.x patch (4.3.19) instead, as the safe
default when the gate check can't run. `StreamingChat.tsx` continues to use
`ai/react`'s legacy `useChat`; `app/api/chat/route.ts`'s proxy is unchanged.

**To actually resolve this**, whoever has real AI Tutor API credentials should:
1. Set real values for AITUTOR_API_KEY/WORKFLOW_ID/NEXT_PUBLIC_AITUTOR_TOKEN in .env
2. Run the gate check: `curl -N -X POST "https://aitutor-api.vercel.app/api/v1/chat/${NEXT_PUBLIC_AITUTOR_TOKEN}/stream" -H "Content-Type: application/json" -H "Authorization: Bearer ${AITUTOR_API_KEY}" -d '{"messages":[{"role":"user","content":"hello"}]}'`
3. If the response is SSE `data: {"type":...}` lines (a type-discriminated JSON envelope), it's likely compatible -- proceed with the hop-by-hop upgrade described in the Phase 1 plan doc's Task 10 section (docs/superpowers/plans/2026-07-15-phase-1-dependency-upgrade.md).
4. If it's plain text/NDJSON/the old `0:"..."` data-stream-protocol format, it's genuinely incompatible without a translation layer -- the freeze should stay.
