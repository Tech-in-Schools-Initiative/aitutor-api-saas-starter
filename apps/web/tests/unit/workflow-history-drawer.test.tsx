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
