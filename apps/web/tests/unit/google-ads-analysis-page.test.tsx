// apps/web/tests/unit/google-ads-analysis-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GoogleAdsAnalysisPage from '@/app/(dashboard)/dashboard/workflows/google-ads-analysis/page';

vi.mock('@/components/ai-tutor-api/WorkflowResultDisplay', () => ({
  default: ({ title, result }: { title: string; result: any }) => (
    <div data-testid="workflow-result">{title}: {JSON.stringify(result)}</div>
  ),
}));

const historyHandlers: { onSelectHistory?: (input: string, output: string) => void } = {};

vi.mock('@/components/workflow/WorkflowHistoryDrawer', () => ({
  WorkflowHistoryDrawer: ({ workflowKey, onSelectHistory }: any) => {
    historyHandlers.onSelectHistory = onSelectHistory;
    return <div data-testid="history-drawer-stub" data-workflow-key={workflowKey} />;
  },
}));

function renderWithQueryClient(
  ui: React.ReactElement,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  return { queryClient, ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>) };
}

describe('Google Ads Campaign Analysis page', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    delete historyHandlers.onSelectHistory;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the shared Card/Textarea/Button primitives', () => {
    const { container } = renderWithQueryClient(<GoogleAdsAnalysisPage />);
    expect(container.querySelector('[data-slot="card"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="textarea"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="button"]')).toBeTruthy();
  });

  it('passes workflowKey="google-ads-analysis" to the history drawer', () => {
    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    expect(screen.getByTestId('history-drawer-stub').getAttribute('data-workflow-key')).toBe(
      'google-ads-analysis'
    );
  });

  it('shows a validation message without calling the API for empty campaign data', () => {
    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    fireEvent.click(screen.getByRole('button', { name: /analyze campaign/i }));
    expect(screen.getByText(/please enter campaign performance data/i)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('loads the sample campaign data when "Load sample" is clicked', () => {
    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    fireEvent.click(screen.getByRole('button', { name: /load sample/i }));
    const textarea = screen.getByLabelText(/campaign performance data/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('Brand - Search');
  });

  it('submits { workflowKey, variables: { campaign_data } } to /api/run and renders the result', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: '## Performance Summary\n...' }),
    });

    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    fireEvent.change(screen.getByLabelText(/campaign performance data/i), {
      target: { value: 'Campaign stats here' },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyze campaign/i }));

    await waitFor(() => {
      expect(screen.getByTestId('workflow-result')).toBeTruthy();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/run',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          workflowKey: 'google-ads-analysis',
          variables: { campaign_data: 'Campaign stats here' },
        }),
      })
    );
    expect(screen.getByTestId('workflow-result').textContent).toContain('Campaign Analysis');
  });

  it('invalidates team-limit and the workflow-scoped history query on success', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'analysis' }),
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderWithQueryClient(<GoogleAdsAnalysisPage />, queryClient);
    fireEvent.change(screen.getByLabelText(/campaign performance data/i), {
      target: { value: 'Campaign stats here' },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyze campaign/i }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['team-limit'] });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workflow-history', 'google-ads-analysis'] });
  });

  it('restores the campaign data field and rendered result from a selected history item', () => {
    renderWithQueryClient(<GoogleAdsAnalysisPage />);

    act(() => {
      historyHandlers.onSelectHistory?.(
        'campaign_data: Restored data',
        JSON.stringify({ result: 'Restored analysis' })
      );
    });

    const textarea = screen.getByLabelText(/campaign performance data/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('campaign_data: Restored data');
    expect(screen.getByTestId('workflow-result').textContent).toContain('Restored analysis');
  });

  it('no longer imports the unused next/link module', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const source = readFileSync(
      path.resolve(process.cwd(), 'app/(dashboard)/dashboard/workflows/google-ads-analysis/page.tsx'),
      'utf-8'
    );
    expect(source).not.toMatch(/from ['"]next\/link['"]/);
  });
});
