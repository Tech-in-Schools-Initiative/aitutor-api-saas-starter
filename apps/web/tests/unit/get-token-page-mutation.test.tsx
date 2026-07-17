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
    // Use a manually-resolved promise (instead of mockResolvedValue) so the
    // mutation stays "pending" long enough to observe. @tanstack/react-query's
    // notifyManager defers mutation-observer notifications through a
    // setTimeout(0) macrotask (see notifyManager.batchCalls in query-core),
    // so the "pending" status is never visible synchronously right after
    // fireEvent.click() — it must be awaited like any other state update
    // from the mutation. With an instantly-resolving mock, the mutation can
    // race past "pending" straight to "success" before a waitFor() gets a
    // chance to observe the intermediate state.
    let resolveFetch!: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    (fetch as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fetchPromise);

    renderWithQueryClient(<Token />);
    fireEvent.click(screen.getByRole('button', { name: 'Get New Token' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Getting Token...' })).toBeTruthy();
    });

    resolveFetch({
      ok: true,
      json: async () => ({ success: true, token: 'abc123' }),
    });

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
