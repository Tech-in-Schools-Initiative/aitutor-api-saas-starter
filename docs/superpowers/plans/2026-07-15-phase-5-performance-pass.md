# Phase 5: Performance/Scalability Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `@tanstack/react-query` to `apps/web` and convert every hand-rolled fetch/poll/mutation in the dashboard (the subscription-status sidebar badge, the workflow-history drawer, story generation, and token request) to `useQuery`/`useMutation`, so the sidebar badge and history drawer share one cached, invalidatable request instead of polling independently and going stale for up to 20s after a mutation. In parallel, trim the query layer (`packages/db/src/queries.ts`, `packages/db/src/utils.ts`) so the hot paths (`/api/team/limit`, `/api/run`, `/api/workflow/history`) stop paying for `getTeamForUser`'s 4-level member-roster join when they only ever need the scalar team row.

**Architecture:** A single `QueryClientProvider` wraps `apps/web/app/(dashboard)/dashboard/layout.tsx` (Task 1). Every subsequent React Query task converts one call site to `useQuery`/`useMutation` against that shared client, using two cache keys — `['team-limit']` and `['workflow-history']` — with no `teamId` segment (see User decisions below). `/api/run`'s mutation invalidates both keys on success, which is the actual scalability win: today the sidebar badge only reflects a just-consumed message up to 20s later, on the next poll tick. Independently, Tasks 6-8 add a lean `getTeamCore(userId)` query and swap it in at the three hot call sites in place of the heavier `getTeamForUser`, and trim `checkMessageLimit` to accept an already-fetched `Team` row instead of re-querying by id — collapsing what was a double team-fetch per request into one. `getTeamForUser`'s full roster join is untouched and still used by the team/settings page, which genuinely needs the member list. Task 9 is a manual Network-tab verification pass with no automated signal.

**Tech Stack:** Next.js App Router, React 19, TypeScript, `@tanstack/react-query` v5 (new dependency), Drizzle ORM + Postgres, Vitest + Testing Library, pnpm + Turborepo (`apps/web`, `packages/db`).

**User decisions (already made):**
- **Query keys omit `teamId`.** The design doc's Phase 5 prose illustrates `['team-limit', teamId]` / `['workflow-history', teamId]`, but this plan uses plain `['team-limit']` / `['workflow-history']`. `SubscriptionStatus` and `WorkflowHistoryDrawer` take no `teamId` prop today (confirmed by reading the current files) and the API routes resolve team server-side from the session cookie — there is only ever one team-scoped instance of each query per signed-in session in this codebase, so a `teamId` cache-key segment would add prop-plumbing with no caching benefit. Revisit this if the app ever supports viewing another team's data client-side.
- **Streaming chat is untouched, confirmed.** Per the design doc's "Streaming left alone" note, `/api/chat` and `apps/web/components/ai-tutor-api/StreamingChat.tsx` are explicitly out of scope for this phase. This plan's source draft was checked and makes zero references to `StreamingChat`, `ai/react`, `@ai-sdk/react`, or `useChat` — the React Query boundary is respected. Note for whoever picks up a future phase: Phase 1 left the `ai` package frozen at `4.3.19` (the v4→v7 upgrade gate was unverifiable — no real AI Tutor API credentials were available to run the compatibility check; see `docs/superpowers/specs/2026-07-15-ai-sdk-v4-freeze.md`), so `StreamingChat.tsx` still uses the **legacy** `ai/react` `useChat` contract (`input`/`handleInputChange`/`handleSubmit`, `message.content` as a plain string) — **not** `@ai-sdk/react` v7's `transport`/`parts`/`status`/`sendMessage` contract. Nothing in this plan touches that file, but any future work near the chat UI's loading state must target the legacy contract, not v7's.
- **`/api/run` stays a blocking `fetch` wrapped in `useMutation`**, not converted to SSE/streaming — the design doc flags streaming `/api/run` as a possible bigger future UX win but explicitly separate from this phase's React Query adoption.
- **Task 6 adds a new `getTeamCore(userId)` rather than reusing `getUserWithTeam` everywhere.** `getUserWithTeam` (already present, currently unused by these call sites) returns `{ user, teamId }` — enough for Task 8's history route, which only needs the id. But `/api/team/limit` and `/api/run` need the full scalar `Team` row (`stripeSubscriptionId`, `stripeProductId`, `currentMessages`) to call `checkMessageLimit`, which `getUserWithTeam` doesn't provide. Task 8 uses `getUserWithTeam`; Tasks 6-7 use the new `getTeamCore`.

---

## Operational note for Tasks 6 and 7

Tasks 6 and 7 add integration tests that hit a real Postgres database via `@repo/db/client` — the same requirement Phase 1's `tests/unit/tiers-limit.test.ts` already has (`POSTGRES_URL` pointed at a reachable database). Tasks 1-5 and 8 are pure component/unit tests against a mocked `fetch` and an in-memory `QueryClient` and need no database.

---

### Task 1: React Query provider wiring

**Goal:** Add `@tanstack/react-query` as an `apps/web`-only dependency and wrap the dashboard route group in a `QueryClientProvider` so every later task in this phase has a client to call `useQuery`/`useMutation` against.

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/web/app/(dashboard)/dashboard/layout.tsx`
- Test: `apps/web/tests/unit/dashboard-query-client-provider.test.tsx`

**Acceptance Criteria:**
- [ ] `@tanstack/react-query` appears in `apps/web/package.json`'s `dependencies`
- [ ] A descendant of `DashboardLayout` can call `useQuery` without throwing "No QueryClient set, use QueryClientProvider to set one"
- [ ] The `QueryClient` instance is created once per mount (via `useState`), not re-created on every render

**Verify:** `pnpm --filter web test -- tests/unit/dashboard-query-client-provider.test.tsx` -> `1 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/dashboard-query-client-provider.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/app/(dashboard)/dashboard/layout';

vi.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => <div data-testid="app-sidebar-stub" />,
}));

function QueryProbe() {
  const { data } = useQuery({
    queryKey: ['probe'],
    queryFn: async () => 'query-client-is-wired',
  });
  return <div data-testid="probe">{data ?? 'loading'}</div>;
}

describe('DashboardLayout QueryClientProvider wiring', () => {
  it('provides a QueryClient to descendants without throwing', async () => {
    render(
      <DashboardLayout>
        <QueryProbe />
      </DashboardLayout>
    );

    await waitFor(() => {
      expect(screen.getByTestId('probe').textContent).toBe('query-client-is-wired');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/dashboard-query-client-provider.test.tsx`
Expected: FAIL — `@tanstack/react-query` has never been installed anywhere in this repo, so Vitest/Vite cannot resolve the import in the test file (or in `DashboardLayout` once Step 3 touches it): `Error: Failed to resolve import "@tanstack/react-query"` (a module-resolution error), not a runtime "No QueryClient set" error. Step 3 installs the package and adds the provider in the same step, so this import-resolution failure is the actual red state you'll observe before it.

- [ ] **Step 3: Write minimal implementation**
```bash
pnpm --filter web add @tanstack/react-query
```
```tsx
// apps/web/app/(dashboard)/dashboard/layout.tsx
'use client';

import * as React from "react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@repo/ui/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider className="bg-gradient-to-br from-pink-100 via-purple-100 to-indigo-100">
        <AppSidebar variant="floating" collapsible="icon" />
        <SidebarInset>
          <div className="bg-gradient-to-br from-pink-100 via-purple-100 to-indigo-100 min-h-[calc(100dvh)]">
          <div className="flex flex-col max-w-7xl mx-auto w-full">
            {children}
          </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/dashboard-query-client-provider.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/app/\(dashboard\)/dashboard/layout.tsx apps/web/tests/unit/dashboard-query-client-provider.test.tsx
git commit -m "Add @tanstack/react-query and wrap dashboard layout in a QueryClientProvider"
```

---

### Task 2: Convert `SubscriptionStatus` polling to `useQuery`

**Goal:** Replace `subscription-status.tsx`'s three `useState`s and two `useEffect`s (initial fetch + a `setInterval(fetchMessageData, 20000)` whose comment incorrectly says "every 10 seconds") with a single `useQuery` that polls every 20s and refetches on window focus.

**Files:**
- Modify: `apps/web/components/subscription-status.tsx`
- Test: `apps/web/tests/unit/subscription-status.test.tsx`

**Acceptance Criteria:**
- [ ] The badge shows "Loading...", then the resolved tier name and remaining-message text, matching current wording exactly
- [ ] The query is registered under `queryKey: ['team-limit']` with `refetchInterval: 20000` and `refetchOnWindowFocus: true`
- [ ] A failed fetch renders "Error loading message count" instead of throwing
- [ ] No component-owned `useState`/`useEffect`/`setInterval` remains in the file

**Verify:** `pnpm --filter web test -- tests/unit/subscription-status.test.tsx` -> `3 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/subscription-status.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SidebarProvider } from '@repo/ui/components/sidebar';
import { SubscriptionStatus } from '@/components/subscription-status';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>{ui}</SidebarProvider>
      </QueryClientProvider>
    ),
  };
}

describe('SubscriptionStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the remaining-message badge once the query resolves', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ unlimited: false, remainingMessages: 3, subscriptionTier: 'Starter' }),
    });

    renderWithProviders(<SubscriptionStatus />);

    expect(screen.getByText('Loading...')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Messages: 3 left')).toBeTruthy();
    });
    expect(screen.getByText('Starter')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith('/api/team/limit');
  });

  it('shows an error badge when the request fails', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'nope' }),
    });

    renderWithProviders(<SubscriptionStatus />);

    await waitFor(() => {
      expect(screen.getByText('Error loading message count')).toBeTruthy();
    });
  });

  it('configures the query to poll every 20 seconds and refetch on window focus', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ unlimited: true, subscriptionTier: 'Pro' }),
    });

    const { queryClient } = renderWithProviders(<SubscriptionStatus />);

    await waitFor(() => {
      expect(screen.getByText('Messages: Unlimited')).toBeTruthy();
    });

    const query = queryClient.getQueryCache().find({ queryKey: ['team-limit'] });
    expect(query?.options.refetchInterval).toBe(20000);
    expect(query?.options.refetchOnWindowFocus).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/subscription-status.test.tsx`
Expected: The first two tests already pass unchanged (the current `useState`/`useEffect` implementation renders identical "Loading..." → resolved-badge and error-badge text). The third test genuinely FAILS: the current component never touches the `QueryClient`'s cache, so `queryClient.getQueryCache().find({ queryKey: ['team-limit'] })` returns `undefined`, and `query?.options.refetchInterval` is `undefined`, not `20000`.

- [ ] **Step 3: Write minimal implementation**
```tsx
// apps/web/components/subscription-status.tsx
'use client';

import * as React from "react";
import { useQuery } from '@tanstack/react-query';
import { useSidebar } from "@repo/ui/components/sidebar";

interface MessageData {
  unlimited?: boolean;
  remainingMessages?: number;
  subscriptionTier?: string;
}

async function fetchMessageData(): Promise<MessageData> {
  const res = await fetch('/api/team/limit');
  if (!res.ok) {
    throw new Error('Error loading message count');
  }
  return res.json();
}

export function SubscriptionStatus() {
  const { state } = useSidebar(); // "expanded" or "collapsed"

  const { data: messageData, isLoading: loading, isError, error } = useQuery({
    queryKey: ['team-limit'],
    queryFn: fetchMessageData,
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
  });

  const tierName =
    messageData && messageData.subscriptionTier && messageData.subscriptionTier.trim() !== ""
      ? messageData.subscriptionTier
      : "Free";

  const subscriptionBadgeText =
    state === "collapsed" ? tierName.charAt(0).toUpperCase() : tierName;

  const messagesBadgeText = React.useMemo(() => {
    if (!messageData) return '';
    const { unlimited, remainingMessages } = messageData;
    if (state === "collapsed") {
      return unlimited ? '∞' : String(remainingMessages);
    } else {
      return unlimited ? "Messages: Unlimited" : `Messages: ${remainingMessages} left`;
    }
  }, [messageData, state]);

  const badgeColorClass = React.useMemo(() => {
    if (!messageData) return '';
    const { unlimited, remainingMessages } = messageData;
    if (unlimited) return 'bg-green-500';
    return (remainingMessages && remainingMessages > 0) ? 'bg-green-500' : 'bg-red-500';
  }, [messageData]);

  return (
    <div className="flex flex-col items-center space-y-2">
      <div>
        <span className="rounded-full px-2 py-1 text-xs font-semibold text-white bg-blue-500">
          {subscriptionBadgeText}
        </span>
      </div>
      <div>
        {loading ? (
          <span className="text-xs text-neutral-500">Loading...</span>
        ) : isError ? (
          <span className="text-xs text-neutral-500">
            {error instanceof Error ? error.message : 'Error loading message count'}
          </span>
        ) : (
          <span className={`rounded-full px-2 py-1 text-xs font-semibold text-white ${badgeColorClass}`}>
            {messagesBadgeText}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/subscription-status.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/web/components/subscription-status.tsx apps/web/tests/unit/subscription-status.test.tsx
git commit -m "Convert SubscriptionStatus polling from setInterval to useQuery"
```

---

### Task 3: Convert `WorkflowHistoryDrawer`'s open-gated fetch to `useQuery`

**Goal:** Replace `WorkflowHistoryDrawer.tsx`'s `open`-gated `useEffect`/`fetch` with `useQuery({ queryKey: ['workflow-history'], enabled: open })` so history is fetched exactly once per open, cached, and shareable with the invalidation added in Task 4.

**Files:**
- Modify: `apps/web/components/workflow/WorkflowHistoryDrawer.tsx`
- Test: `apps/web/tests/unit/workflow-history-drawer.test.tsx`

**Acceptance Criteria:**
- [ ] No fetch occurs before the drawer is opened
- [ ] Opening the drawer triggers exactly one fetch to `/api/workflow/history`
- [ ] Selecting a history item still calls `onSelectHistory(input, output)` and closes the drawer
- [ ] The query is registered under `queryKey: ['workflow-history']`

**Verify:** `pnpm --filter web test -- tests/unit/workflow-history-drawer.test.tsx` -> `3 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/workflow-history-drawer.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkflowHistoryDrawer } from '@/components/workflow/WorkflowHistoryDrawer';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { queryClient, ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>) };
}

describe('WorkflowHistoryDrawer', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not fetch history until the drawer is opened', () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => [] });

    renderWithQueryClient(<WorkflowHistoryDrawer onSelectHistory={vi.fn()} />);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches and renders history once opened, registered under the workflow-history query key', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 1, input: 'A magical forest', output: 'Once upon a time...', createdAt: new Date().toISOString() },
      ],
    });

    const { queryClient } = renderWithQueryClient(<WorkflowHistoryDrawer onSelectHistory={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('A magical forest')).toBeTruthy();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/workflow/history');
    expect(queryClient.getQueryCache().find({ queryKey: ['workflow-history'] })).toBeDefined();
  });

  it('calls onSelectHistory and closes the drawer when a history item is clicked', async () => {
    const onSelectHistory = vi.fn();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 1, input: 'A magical forest', output: 'Once upon a time...', createdAt: new Date().toISOString() },
      ],
    });

    renderWithQueryClient(<WorkflowHistoryDrawer onSelectHistory={onSelectHistory} />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => screen.getByText('A magical forest'));
    fireEvent.click(screen.getByText('A magical forest'));

    expect(onSelectHistory).toHaveBeenCalledWith('A magical forest', 'Once upon a time...');
    await waitFor(() => {
      expect(screen.queryByText('A magical forest')).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/workflow-history-drawer.test.tsx`
Expected: Tests 1 and 3 already pass unchanged — the current `open`-gated `useEffect` produces the same observable behavior (no fetch before open; select-and-close works). This is expected for a pure internal refactor: there's no external behavior change to lock in with those two assertions. Test 2 genuinely FAILS on its added assertion: `queryClient.getQueryCache().find({ queryKey: ['workflow-history'] })` returns `undefined`, since the current implementation never touches the `QueryClient` at all. That's the real red signal for this task — proceed to Step 3 regardless of tests 1/3 already being green; this task's job is giving `workflow-history` a shared, invalidatable cache entry for Task 4 to target, not changing what the drawer looks like.

- [ ] **Step 3: Write minimal implementation**
```tsx
// apps/web/components/workflow/WorkflowHistoryDrawer.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@repo/ui/components/sheet';
import { Button } from '@repo/ui/components/button';
import { HistoryIcon, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface HistoryItem {
  id: number;
  input: string;
  output: string;
  createdAt: string;
}

interface WorkflowHistoryDrawerProps {
  onSelectHistory: (input: string, output: string) => void;
}

async function fetchWorkflowHistory(): Promise<HistoryItem[]> {
  const response = await fetch('/api/workflow/history');
  if (!response.ok) {
    throw new Error('Failed to load workflow history');
  }
  return response.json();
}

export function WorkflowHistoryDrawer({ onSelectHistory }: WorkflowHistoryDrawerProps) {
  const [open, setOpen] = useState(false);

  const { data: history = [], isLoading: loading } = useQuery({
    queryKey: ['workflow-history'],
    queryFn: fetchWorkflowHistory,
    enabled: open,
  });

  const handleSelectHistory = (item: HistoryItem) => {
    onSelectHistory(item.input, item.output);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="ml-2">
          <HistoryIcon className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Workflow History</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No history found</p>
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleSelectHistory(item)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900 truncate max-w-[80%]">{item.input}</h3>
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-2">{item.output}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/workflow-history-drawer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/web/components/workflow/WorkflowHistoryDrawer.tsx apps/web/tests/unit/workflow-history-drawer.test.tsx
git commit -m "Convert WorkflowHistoryDrawer's open-gated fetch to useQuery"
```

---

### Task 4: Convert `workflow/page.tsx`'s `/api/run` call to `useMutation` with invalidation

**Goal:** Replace the manual `fetch('/api/run', ...)` call and its `loading`/`result`/`error` `useState`s with `useMutation`, invalidating `['team-limit']` and `['workflow-history']` on success so the sidebar badge and history drawer reflect a just-consumed message immediately instead of waiting up to 20s.

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/workflow/page.tsx`
- Test: `apps/web/tests/unit/workflow-page-mutation.test.tsx`

**Acceptance Criteria:**
- [ ] Submitting a non-empty story POSTs to `/api/run` with the same request shape as before
- [ ] On success, `queryClient.invalidateQueries` is called with `{ queryKey: ['team-limit'] }` and `{ queryKey: ['workflow-history'] }`
- [ ] Submitting an empty story shows "Please enter a story" and makes no network call
- [ ] `StoryDisplay` still renders with the mutation's resolved data

**Verify:** `pnpm --filter web test -- tests/unit/workflow-page-mutation.test.tsx` -> `3 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/workflow-page-mutation.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Workflow from '@/app/(dashboard)/dashboard/workflow/page';

vi.mock('@/components/ai-tutor-api/StoryDisplay', () => ({
  default: ({ result }: { result: any }) => <div data-testid="story-result">{JSON.stringify(result)}</div>,
}));

vi.mock('@/components/workflow/WorkflowHistoryDrawer', () => ({
  WorkflowHistoryDrawer: () => <div data-testid="history-drawer-stub" />,
}));

function renderWithQueryClient(
  ui: React.ReactElement,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  return { queryClient, ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>) };
}

describe('Workflow page /api/run mutation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('submits the story via useMutation and renders the result', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'Once upon a time...' }),
    });

    renderWithQueryClient(<Workflow />);

    fireEvent.change(screen.getByPlaceholderText(/Tell me a story/i), {
      target: { value: 'A magical forest' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Generate Story/i }));

    await waitFor(() => {
      expect(screen.getByTestId('story-result')).toBeTruthy();
    });
    expect(fetch).toHaveBeenCalledWith('/api/run', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ story: 'A magical forest' }),
    }));
  });

  it('invalidates team-limit and workflow-history queries on success', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'Once upon a time...' }),
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderWithQueryClient(<Workflow />, queryClient);

    fireEvent.change(screen.getByPlaceholderText(/Tell me a story/i), {
      target: { value: 'A magical forest' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Generate Story/i }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['team-limit'] });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workflow-history'] });
  });

  it('shows a validation message without calling the API for an empty story', () => {
    renderWithQueryClient(<Workflow />);
    fireEvent.click(screen.getByRole('button', { name: /Generate Story/i }));
    expect(screen.getByText('Please enter a story')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/workflow-page-mutation.test.tsx`
Expected: Tests 1 and 3 already pass unchanged (the current handler POSTs the identical request shape and shows the identical validation message). Test 2 genuinely FAILS cleanly, no thrown error: `invalidateSpy` is never called (the current page never touches `queryClient`), so `await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith(...))` times out with something like "expected spy to be called with arguments: [ {"queryKey": ["team-limit"]} ], Number of calls: 0".

- [ ] **Step 3: Write minimal implementation**
```tsx
// apps/web/app/(dashboard)/dashboard/workflow/page.tsx
"use client";
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import StoryDisplay from '@/components/ai-tutor-api/StoryDisplay';
import { WorkflowHistoryDrawer } from '@/components/workflow/WorkflowHistoryDrawer';

async function runStory(story: string): Promise<any> {
    const response = await fetch('/api/run', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ story }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'An error occurred while fetching the story.');
    }

    return data;
}

export default function Workflow() {
    const [story, setStory] = useState('');
    const [result, setResult] = useState<any>(null);
    const [formError, setFormError] = useState('');
    const queryClient = useQueryClient();

    const runStoryMutation = useMutation({
        mutationFn: runStory,
        onSuccess: (data) => {
            setResult(data);
            queryClient.invalidateQueries({ queryKey: ['team-limit'] });
            queryClient.invalidateQueries({ queryKey: ['workflow-history'] });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!story.trim()) {
            setFormError('Please enter a story');
            return;
        }
        setFormError('');
        setResult(null);
        runStoryMutation.mutate(story);
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

    const loading = runStoryMutation.isPending;
    const displayError = formError || (runStoryMutation.isError
        ? (runStoryMutation.error instanceof Error ? runStoryMutation.error.message : 'An error occurred while fetching the story.')
        : '');

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8 p-8">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-transparent bg-clip-text inline-block"
                        style={{ lineHeight: '1.5', padding: '0.5em 0' }}>
                        AI Story Generator - Workflow
                    </h1>
                </div>

                <div className="glass-morphism p-8 mb-8 rounded-xl shadow-xl backdrop-blur-lg bg-white/30">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label htmlFor="story" className="block text-lg font-medium text-gray-700">
                                    Enter your story prompt:
                                </label>
                                <WorkflowHistoryDrawer onSelectHistory={handleSelectHistory} />
                            </div>
                            <input
                                id="story"
                                type="text"
                                value={story}
                                onChange={(e) => setStory(e.target.value)}
                                placeholder="E.g., Tell me a story about a magical forest..."
                                className="w-full p-4 rounded-lg bg-white/50 border border-purple-200 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent shadow-inner"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 px-6 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Generating...
                                </span>
                            ) : (
                                'Generate Story'
                            )}
                        </button>
                    </form>
                </div>

                {displayError && (
                    <div className="glass-morphism p-4 mb-8 text-red-600 text-center rounded-lg bg-red-50/50">
                        {displayError}
                    </div>
                )}

                {result && <StoryDisplay result={result} />}
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/workflow-page-mutation.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add "apps/web/app/(dashboard)/dashboard/workflow/page.tsx" apps/web/tests/unit/workflow-page-mutation.test.tsx
git commit -m "Convert workflow page's /api/run call to useMutation with sidebar/history invalidation"
```

---

### Task 5: Convert `get-token/page.tsx`'s `/api/token` call to `useMutation`

**Goal:** Replace the manual `fetch('/api/token', ...)` call and its `tokenResponse`/`error`/`tokenLoading` `useState`s with `useMutation`.

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/get-token/page.tsx`
- Test: `apps/web/tests/unit/get-token-page-mutation.test.tsx`

**Acceptance Criteria:**
- [ ] Clicking "Get New Token" POSTs to `/api/token` with no body, same as today
- [ ] The button reads "Getting Token..." while the mutation is pending and is disabled
- [ ] On success, the token and full JSON response render exactly as before
- [ ] On failure, the error message renders in the existing red error box

**Verify:** `pnpm --filter web test -- tests/unit/get-token-page-mutation.test.tsx` -> `2 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/unit/get-token-page-mutation.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Token from '@/app/(dashboard)/dashboard/get-token/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Get Token page /api/token mutation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests a token via useMutation and displays it on success', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, token: 'abc123' }),
    });

    renderWithQueryClient(<Token />);
    fireEvent.click(screen.getByRole('button', { name: 'Get New Token' }));

    expect(screen.getByRole('button', { name: 'Getting Token...' })).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('abc123')).toBeTruthy();
    });
    expect(fetch).toHaveBeenCalledWith('/api/token', { method: 'POST' });
  });

  it('shows the error message when the request fails', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Failed to get token' }),
    });

    renderWithQueryClient(<Token />);
    fireEvent.click(screen.getByRole('button', { name: 'Get New Token' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to get token')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/get-token-page-mutation.test.tsx`
Expected: Both tests already pass unchanged against the current implementation — the existing `handleGetToken` sets its own `tokenLoading`/`tokenResponse`/`error` state with the identical synchronous "Getting Token..." → resolved/error sequence, and this task is a pure internal refactor with no new observable behavior. There is no red state to observe here; that's expected for a behavior-preserving refactor, not a bug in the plan. Proceed straight to Step 3, then use Step 4 to confirm nothing regressed (same two tests, still green) and — separately, by reading the file, not by these tests — confirm the `useState` trio for token/error/loading is gone and replaced by `useMutation`.

- [ ] **Step 3: Write minimal implementation**
```tsx
// apps/web/app/(dashboard)/dashboard/get-token/page.tsx
"use client";
import { useMutation } from '@tanstack/react-query';

interface TokenResponse {
  success: boolean;
  token: string;
}

async function fetchToken(): Promise<TokenResponse> {
    const response = await fetch('/api/token', {
        method: 'POST',
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to get token');
    }
    return data;
}

export default function Token() {
    const tokenMutation = useMutation({
        mutationFn: fetchToken,
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-indigo-100 p-8">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8 p-8">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-transparent bg-clip-text inline-block"
                        style={{ lineHeight: '1.5', padding: '0.5em 0' }}>
                        AI Story Generator - Get Token
                    </h1>
                </div>

                <div className="glass-morphism p-8 mb-8 rounded-xl shadow-xl backdrop-blur-lg bg-white/30">
                    <div className="flex flex-col items-center space-y-6">
                        <button
                            onClick={() => tokenMutation.mutate()}
                            disabled={tokenMutation.isPending}
                            className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {tokenMutation.isPending ? 'Getting Token...' : 'Get New Token'}
                        </button>

                        {tokenMutation.data && (
                            <div className="w-full space-y-4">
                                <div className="p-4 bg-white/50 rounded-lg">
                                    <p className="text-gray-700 font-medium mb-2">Token:</p>
                                    <code className="block p-3 bg-gray-100 rounded border border-gray-200 text-sm overflow-x-auto">
                                        {tokenMutation.data.token}
                                    </code>
                                </div>

                                <div className="p-4 bg-white/50 rounded-lg">
                                    <p className="text-gray-700 font-medium mb-2">Full Response:</p>
                                    <pre className="block p-3 bg-gray-100 rounded border border-gray-200 text-sm overflow-x-auto whitespace-pre-wrap">
                                        {JSON.stringify(tokenMutation.data, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}

                        {tokenMutation.isError && (
                            <div className="w-full p-4 bg-red-50 rounded-lg text-red-600">
                                {tokenMutation.error instanceof Error ? tokenMutation.error.message : 'Failed to get token'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/get-token-page-mutation.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add "apps/web/app/(dashboard)/dashboard/get-token/page.tsx" apps/web/tests/unit/get-token-page-mutation.test.tsx
git commit -m "Convert get-token page's /api/token call to useMutation"
```

---

### Task 6: Add lean `getTeamCore` query to `packages/db`

**Goal:** Add `getTeamCore(userId)` to `packages/db/src/queries.ts` — a single scalar-only join (`users` → `teamMembers` → `teams`) that returns just the team row, with no nested member roster, for call sites that don't need it.

**Files:**
- Modify: `packages/db/src/queries.ts`
- Test: `apps/web/tests/unit/get-team-core.test.ts`

**Acceptance Criteria:**
- [ ] `getTeamCore(userId)` returns the full scalar `Team` row (`id`, `stripeSubscriptionId`, `stripeProductId`, `currentMessages`, etc.) for a user with a team
- [ ] The returned object has no `teamMembers` property (proving it isn't the nested-roster shape `getTeamForUser` returns)
- [ ] `getTeamCore(userId)` returns `null` for a user with no team membership
- [ ] `getTeamForUser` is untouched (still used by the team/settings page)

**Verify:** `pnpm --filter web test -- tests/unit/get-team-core.test.ts` -> `2 passed` (requires `POSTGRES_URL` pointed at a reachable test database, same as the existing `tiers-limit.test.ts`)

**Steps:**

- [ ] **Step 1: Write the failing test**
```ts
// apps/web/tests/unit/get-team-core.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import { teams, users, teamMembers } from '@repo/db/schema';
import { getTeamCore } from '@repo/db/queries';

let userId: number;
let teamId: number;

beforeAll(async () => {
  const [team] = await db
    .insert(teams)
    .values({
      name: 'getTeamCore Fixture Team',
      stripeSubscriptionId: 'sub_test_123',
      stripeProductId: 'prod_test_456',
      currentMessages: 2,
    })
    .returning();
  teamId = team.id;

  const [user] = await db
    .insert(users)
    .values({ name: 'Fixture User', email: `get-team-core-${Date.now()}@example.com`, passwordHash: 'hash' })
    .returning();
  userId = user.id;

  await db.insert(teamMembers).values({ userId, teamId, role: 'owner' });
});

afterAll(async () => {
  await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(teams).where(eq(teams.id, teamId));
});

describe('getTeamCore', () => {
  it('returns the scalar team row for a user without the member roster', async () => {
    const team = await getTeamCore(userId);
    expect(team).not.toBeNull();
    expect(team!.id).toBe(teamId);
    expect(team!.stripeSubscriptionId).toBe('sub_test_123');
    expect(team!.stripeProductId).toBe('prod_test_456');
    expect(team!.currentMessages).toBe(2);
    expect(team).not.toHaveProperty('teamMembers');
  });

  it('returns null for a user with no team', async () => {
    const [orphanUser] = await db
      .insert(users)
      .values({ name: 'Orphan', email: `orphan-${Date.now()}@example.com`, passwordHash: 'hash' })
      .returning();

    const team = await getTeamCore(orphanUser.id);
    expect(team).toBeNull();

    await db.delete(users).where(eq(users.id, orphanUser.id));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/get-team-core.test.ts`
Expected: FAIL with "`@repo/db/queries` has no exported member 'getTeamCore'" (or the equivalent module-resolution/TypeError, since the function doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**
```ts
// packages/db/src/queries.ts
// Add alongside the existing getUserWithTeam / getTeamForUser exports:
import { Team } from './schema'; // add to the existing schema import if not already present

export async function getTeamCore(userId: number): Promise<Team | null> {
  const result = await db
    .select({ team: teams })
    .from(users)
    .innerJoin(teamMembers, eq(users.id, teamMembers.userId))
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0]?.team ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/get-team-core.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add packages/db/src/queries.ts apps/web/tests/unit/get-team-core.test.ts
git commit -m "Add lean getTeamCore query alongside the heavier getTeamForUser"
```

---

### Task 7: Trim `checkMessageLimit`'s signature and update its two heavy call sites

**Goal:** Change `checkMessageLimit(teamId: number)` to `checkMessageLimit(team: Team)`, removing its internal re-fetch of the team row, and switch `/api/team/limit` and `/api/run` to call the new `getTeamCore` + the trimmed `checkMessageLimit`, collapsing what was a double team-fetch (`getTeamForUser`'s 4-level join, then `checkMessageLimit`'s own re-select) into one.

**Files:**
- Modify: `packages/db/src/utils.ts`
- Modify: `apps/web/app/api/team/limit/route.ts`
- Modify: `apps/web/app/api/run/route.ts`
- Test: `apps/web/tests/unit/tiers-limit.test.ts`

**Acceptance Criteria:**
- [ ] `checkMessageLimit` takes a `Team` row, not a `teamId`, and performs no `db` query of its own
- [ ] `/api/team/limit/route.ts` and `/api/run/route.ts` call `getTeamCore(user.id)` instead of `getTeamForUser(user.id)`
- [ ] Both routes pass the fetched `team` directly into `checkMessageLimit(team)`
- [ ] Existing free-tier limit/decrement/exhaustion behavior is unchanged

**Verify:** `pnpm --filter web test -- tests/unit/tiers-limit.test.ts` -> `3 passed` (requires `POSTGRES_URL` pointed at a reachable test database, same as before this change)

**Steps:**

- [ ] **Step 1: Write the failing test**
```ts
// apps/web/tests/unit/tiers-limit.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { db } from '@repo/db/client';
import { teams, Team } from '@repo/db/schema';
import { checkMessageLimit, incrementMessageCount } from '@repo/db/utils';

const require = createRequire(import.meta.url);

function installedVersion(pkgName: string): string {
  const searchPaths = require.resolve.paths(pkgName) ?? [];
  for (const searchPath of searchPaths) {
    const pkgJsonPath = path.join(searchPath, pkgName, 'package.json');
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      return pkg.version;
    } catch {
      continue;
    }
  }
  throw new Error(`Could not resolve installed version for ${pkgName}`);
}

function coreVersion(v: string): number[] {
  return v.split('-')[0].split('.').map(Number);
}
function atLeast(actual: string, min: string): boolean {
  const a = coreVersion(actual);
  const m = coreVersion(min);
  for (let i = 0; i < Math.max(a.length, m.length); i++) {
    const av = a[i] ?? 0;
    const mv = m[i] ?? 0;
    if (av !== mv) return av > mv;
  }
  return true;
}

describe('drizzle-orm / drizzle-kit version pin', () => {
  it('drizzle-orm is at least 0.45.2', () => {
    const version = installedVersion('drizzle-orm');
    expect(atLeast(version, '0.45.2'), `installed drizzle-orm ${version} is older than expected`).toBe(true);
  });

  it('drizzle-kit is at least 0.31.10', () => {
    const version = installedVersion('drizzle-kit');
    expect(atLeast(version, '0.31.10'), `installed drizzle-kit ${version} is older than expected`).toBe(true);
  });
});

let team: Team;

beforeAll(async () => {
  const [insertedTeam] = await db
    .insert(teams)
    .values({
      name: 'Vitest Fixture Team',
      messageLimit: 5,
      currentMessages: 0,
    })
    .returning();
  team = insertedTeam;
});

afterAll(async () => {
  if (team) {
    await db.delete(teams).where(eq(teams.id, team.id));
  }
});

describe('checkMessageLimit / incrementMessageCount', () => {
  it('reports the free-tier limit (5) as remaining when no messages sent', async () => {
    const { withinLimit, remainingMessages } = await checkMessageLimit(team);
    expect(withinLimit).toBe(true);
    expect(remainingMessages).toBe(5);
  });

  it('decrements remaining messages after incrementMessageCount', async () => {
    await incrementMessageCount(team.id, 3);
    const [refreshed] = await db.select().from(teams).where(eq(teams.id, team.id));
    const { withinLimit, remainingMessages } = await checkMessageLimit(refreshed);
    expect(withinLimit).toBe(true);
    expect(remainingMessages).toBe(2);
  });

  it('flips withinLimit to false once the free-tier limit is exhausted', async () => {
    await incrementMessageCount(team.id, 2);
    const [refreshed] = await db.select().from(teams).where(eq(teams.id, team.id));
    const { withinLimit, remainingMessages } = await checkMessageLimit(refreshed);
    expect(withinLimit).toBe(false);
    expect(remainingMessages).toBe(0);
  });
});
```
(The prior "throws for a team id that does not exist" case is intentionally dropped: `checkMessageLimit` no longer resolves a team by id, so a missing team is now the caller's — `getTeamCore`'s — 404 branch to handle, not this function's.)

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/tiers-limit.test.ts`
Expected: FAIL with "Team not found" (or a Drizzle query error) — the current `checkMessageLimit(teamId: number)` receives a `Team` object where it expects a numeric id, so its internal `eq(teams.id, teamId)` lookup no longer matches any row

- [ ] **Step 3: Write minimal implementation**
```ts
// packages/db/src/utils.ts
import { db } from './client';
import { teams, Team } from './schema';
import { eq, sql, desc } from 'drizzle-orm';
import { tiers, Tier } from './tiers';
import { workflowHistory, NewWorkflowHistory } from './schema';

export async function checkMessageLimit(
  team: Team
): Promise<{ withinLimit: boolean; remainingMessages: number }> {
  let messageLimit: number;

  if (team.stripeSubscriptionId && team.stripeProductId) {
    const matchedTier: Tier | undefined = tiers.find(
      (t) => t.productId === team.stripeProductId
    );
    messageLimit = matchedTier ? matchedTier.messageLimit : 5;
  } else {
    messageLimit = 5;
  }

  const currentMessages = team.currentMessages ?? 0;
  const remainingMessages = messageLimit - currentMessages;
  const withinLimit = remainingMessages > 0;

  return { withinLimit, remainingMessages };
}

export async function incrementMessageCount(teamId: number, count: number = 1): Promise<void> {
  await db.update(teams)
    .set({
      currentMessages: sql`${teams.currentMessages} + ${count}`,
      updatedAt: new Date()
    })
    .where(eq(teams.id, teamId));
}

export async function saveWorkflowHistory(
  teamId: number,
  userId: number,
  input: string,
  output: string
): Promise<void> {
  const newHistory: NewWorkflowHistory = {
    teamId,
    userId,
    input,
    output,
    createdAt: new Date(),
  };

  await db.insert(workflowHistory).values(newHistory);
}

export async function getWorkflowHistory(
  teamId: number,
  limit: number = 10
) {
  return db.select({
    id: workflowHistory.id,
    input: workflowHistory.input,
    output: workflowHistory.output,
    createdAt: workflowHistory.createdAt,
    userId: workflowHistory.userId,
  })
  .from(workflowHistory)
  .where(eq(workflowHistory.teamId, teamId))
  .orderBy(desc(workflowHistory.createdAt))
  .limit(limit);
}
```
```ts
// apps/web/app/api/team/limit/route.ts
import { getUser } from '@/lib/db/queries';
import { getTeamCore } from '@repo/db/queries';
import { checkMessageLimit } from '@repo/db/utils';
import { NextResponse } from 'next/server';
import { tiers } from '@repo/db/tiers';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }

  const team = await getTeamCore(user.id);
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const { remainingMessages } = await checkMessageLimit(team);
  const unlimited = remainingMessages === Infinity;

  let subscriptionTier = "Free";
  if (team.stripeSubscriptionId && team.stripeProductId) {
    const matchedTier = tiers.find(t => t.productId === team.stripeProductId);
    if (matchedTier) {
      subscriptionTier = matchedTier.name;
    }
  }

  return NextResponse.json({ unlimited, remainingMessages, subscriptionTier });
}
```
```ts
// apps/web/app/api/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { getTeamCore } from '@repo/db/queries';
import { checkMessageLimit, incrementMessageCount, saveWorkflowHistory } from '@repo/db/utils';

export async function POST(req: NextRequest) {
  try {
    const { story } = await req.json();

    if (!story) {
      return NextResponse.json(
        { error: 'Missing story parameter' },
        { status: 400 }
      );
    }

    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    const team = await getTeamCore(user.id);
    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    const { withinLimit } = await checkMessageLimit(team);
    if (!withinLimit) {
      return NextResponse.json(
        {
          error:
            'Monthly message limit reached. Upgrade your plan for unlimited messages.',
        },
        { status: 403 }
      );
    }

    if (!process.env.WORKFLOW_ID || !process.env.AITUTOR_API_KEY) {
      return NextResponse.json(
        { error: 'Missing environment variables: WORKFLOW_ID or AITUTOR_API_KEY' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://aitutor-api.vercel.app/api/v1/run/${process.env.WORKFLOW_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.AITUTOR_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ story }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Error generating story' },
        { status: response.status }
      );
    }

    await incrementMessageCount(team.id, 1);

    await saveWorkflowHistory(
      team.id,
      user.id,
      story,
      data.result || JSON.stringify(data)
    );

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/tiers-limit.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add packages/db/src/utils.ts apps/web/app/api/team/limit/route.ts apps/web/app/api/run/route.ts apps/web/tests/unit/tiers-limit.test.ts
git commit -m "Trim checkMessageLimit to accept an already-fetched team row, collapsing the double team-fetch in /api/team/limit and /api/run"
```

---

### Task 8: Swap `/api/workflow/history`'s team lookup from `getTeamForUser` to `getUserWithTeam`

**Goal:** `/api/workflow/history/route.ts` only ever needs `teamId` to call `getWorkflowHistory(teamId, limit)` — it doesn't need `getTeamForUser`'s 4-level member-roster join. Switch it to the already-present-but-unused-here `getUserWithTeam`.

**Files:**
- Modify: `apps/web/app/api/workflow/history/route.ts`
- Test: `apps/web/tests/unit/workflow-history-route.test.ts`

**Acceptance Criteria:**
- [ ] The route resolves the team via `getUserWithTeam(user.id)`, not `getTeamForUser(user.id)`
- [ ] `getWorkflowHistory` is called with the resolved `teamId` and the parsed `limit` query param
- [ ] A user with no team membership still gets a 404 `{ error: 'Team not found' }`

**Verify:** `pnpm --filter web test -- tests/unit/workflow-history-route.test.ts` -> `2 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**
```ts
// apps/web/tests/unit/workflow-history-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getUserMock = vi.fn();
const getUserWithTeamMock = vi.fn();
const getTeamForUserMock = vi.fn();
const getWorkflowHistoryMock = vi.fn();

vi.mock('@/lib/db/queries', () => ({
  getUser: getUserMock,
}));

vi.mock('@repo/db/queries', () => ({
  getUserWithTeam: getUserWithTeamMock,
  getTeamForUser: getTeamForUserMock,
}));

vi.mock('@repo/db/utils', () => ({
  getWorkflowHistory: getWorkflowHistoryMock,
}));

import { GET } from '@/app/api/workflow/history/route';

describe('GET /api/workflow/history', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getUserWithTeamMock.mockReset();
    getTeamForUserMock.mockReset();
    getWorkflowHistoryMock.mockReset();
  });

  it('resolves the team via getUserWithTeam, not the heavier getTeamForUser', async () => {
    getUserMock.mockResolvedValue({ id: 42 });
    getUserWithTeamMock.mockResolvedValue({ user: { id: 42 }, teamId: 7 });
    getWorkflowHistoryMock.mockResolvedValue([
      { id: 1, input: 'a', output: 'b', createdAt: new Date().toISOString() },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/workflow/history?limit=5'));
    const body = await response.json();

    expect(getUserWithTeamMock).toHaveBeenCalledWith(42);
    expect(getTeamForUserMock).not.toHaveBeenCalled();
    expect(getWorkflowHistoryMock).toHaveBeenCalledWith(7, 5);
    expect(body).toHaveLength(1);
  });

  it('returns 404 when the user has no team', async () => {
    getUserMock.mockResolvedValue({ id: 42 });
    getUserWithTeamMock.mockResolvedValue({ user: { id: 42 }, teamId: null });

    const response = await GET(new NextRequest('http://localhost/api/workflow/history'));
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/workflow-history-route.test.ts`
Expected: FAIL on the first test — the current route calls `getTeamForUser`, so `getTeamForUserMock` is invoked (violating `.not.toHaveBeenCalled()`) and `getUserWithTeamMock` is never invoked (violating `.toHaveBeenCalledWith(42)`)

- [ ] **Step 3: Write minimal implementation**
```ts
// apps/web/app/api/workflow/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { getUserWithTeam } from '@repo/db/queries';
import { getWorkflowHistory } from '@repo/db/utils';

export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam || !userWithTeam.teamId) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10');
    const history = await getWorkflowHistory(userWithTeam.teamId, limit);

    return NextResponse.json(history);
  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- tests/unit/workflow-history-route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/web/app/api/workflow/history/route.ts apps/web/tests/unit/workflow-history-route.test.ts
git commit -m "Resolve /api/workflow/history's team via lean getUserWithTeam instead of getTeamForUser"
```

---

### Task 9: Manual Network-tab verification of the polling collapse and invalidation

**Goal:** Confirm in a real browser, via DevTools' Network panel, that (a) the sidebar's 20s poll and any concurrent `['team-limit']` consumer share a single in-flight request instead of firing independently, and (b) submitting a story on `/dashboard/workflow` triggers an immediate `/api/team/limit` (and, if the drawer was ever opened this session, `/api/workflow/history`) refetch instead of waiting for the next 20s tick. This step is inherently manual — React Query's request de-duplication and cache invalidation are observed as real HTTP timing/count behavior in a running app, not something a unit test can assert against a mocked `fetch`.

**Files:**
- N/A (no source files change — this task documents a manual verification pass against a running dev server)

**Acceptance Criteria:**
- [ ] With the dashboard open and DevTools Network panel recording, only one `/api/team/limit` request fires per 20s tick even if both the sidebar badge and any other `['team-limit']` consumer are mounted simultaneously
- [ ] Submitting a story on `/dashboard/workflow` shows a `POST /api/run` followed immediately (same tick, not after waiting for the next poll) by a fresh `GET /api/team/limit`
- [ ] If the history drawer was opened earlier in the session, that same story submission also shows a fresh `GET /api/workflow/history`
- [ ] The sidebar badge's remaining-message count visibly decrements right after story submission, not up to 20s later

**Verify:** Manual — no CLI command. Perform the steps below in a real browser against a running `pnpm --filter web dev` instance with a seeded, authenticated session, and confirm each acceptance criterion against the Network panel by eye.

**Steps:**

- [ ] **Step 1: Start the app and open DevTools**
Run: `pnpm --filter web dev`, sign in, navigate to `/dashboard`, open DevTools → Network, filter by `Fetch/XHR`.

- [ ] **Step 2: Observe the polling collapse**
Leave the dashboard open across two 20s ticks. Confirm exactly one `/api/team/limit` request appears per tick (not two, even though `SubscriptionStatus` is the only current mount point — this guards against a future second consumer of `['team-limit']` silently reintroducing duplicate polling once React Query's cache-sharing is in place).

- [ ] **Step 3: Observe invalidation on mutation**
Navigate to `/dashboard/workflow`, submit a story, and watch the Network panel. Confirm `POST /api/run` is immediately followed by a new `GET /api/team/limit`, and that the sidebar badge's remaining-count text updates without waiting for the next poll tick.

- [ ] **Step 4: Observe history invalidation**
Open the history drawer once (to prime the `['workflow-history']` query), close it, submit another story, then reopen the drawer. Confirm the new entry is present without a manual page refresh, and check the Network panel shows the `GET /api/workflow/history` refetch happened at submission time (from `invalidateQueries`), not only when the drawer was reopened.

- [ ] **Step 5: Record the result**
No commit — note the outcome (pass/fail, with a screenshot of the Network panel timeline) in the PR description for the Task 1–8 changes, since this step has no automated signal to attach to CI.
