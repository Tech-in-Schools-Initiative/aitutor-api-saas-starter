// apps/web/tests/unit/google-ads-analysis-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GoogleAdsAnalysisPage from '@/app/(dashboard)/dashboard/workflows/google-ads-analysis/page';

const mockWorkflowResultDisplay = vi.hoisted(() => vi.fn());

vi.mock('@/components/ai-tutor-api/WorkflowResultDisplay', () => ({
  default: (props: { title: string; result: any }) => {
    mockWorkflowResultDisplay(props);
    return (
      <div data-testid="workflow-result-fallback">
        {props.title}: {JSON.stringify(props.result)}
      </div>
    );
  },
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

const SAMPLE_VALID_RESULT = {
  companyName: 'Notion Labs, Inc.',
  industry: 'Productivity Software',
  targetAudience: 'Small business owners and remote teams seeking an all-in-one workspace',
  suggestedDailyBudget: '$75/day',
  keywords: ['project management software', 'team wiki tool', 'all-in-one workspace'],
  adVariations: [
    {
      headline: 'One Workspace. Every Team.',
      description: 'Docs, projects, and wikis together. Try Notion free today.',
    },
    {
      headline: 'Organize Your Team in Notion',
      description: 'Replace scattered tools with one connected workspace.',
    },
  ],
};

function fillUrl(value = 'https://www.notion.com') {
  fireEvent.change(screen.getByLabelText(/^website url$/i), { target: { value } });
  return value;
}

describe('Google Ads Campaign Proposal page', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    delete historyHandlers.onSelectHistory;
    mockWorkflowResultDisplay.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the single Website URL field with correct label', () => {
    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    expect(screen.getByLabelText(/^website url$/i)).toBeTruthy();
  });

  it('passes workflowKey="google-ads-analysis" to the history drawer', () => {
    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    expect(screen.getByTestId('history-drawer-stub').getAttribute('data-workflow-key')).toBe(
      'google-ads-analysis'
    );
  });

  it('disables submit until the field is filled', () => {
    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    const submitButton = screen.getByRole('button', { name: /propose campaign/i }) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);

    fillUrl();
    expect(submitButton.disabled).toBe(false);
  });

  it('keeps submit disabled for whitespace-only input', () => {
    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    const submitButton = screen.getByRole('button', { name: /propose campaign/i }) as HTMLButtonElement;
    fillUrl('   ');
    expect(submitButton.disabled).toBe(true);
  });

  it('fills the field when "Load sample" is clicked', () => {
    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    fireEvent.click(screen.getByRole('button', { name: /load sample/i }));

    const input = screen.getByLabelText(/^website url$/i) as HTMLInputElement;
    expect(input.value).not.toBe('');
    expect(input.value.trim().length).toBeGreaterThan(0);
    expect((screen.getByRole('button', { name: /propose campaign/i }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  it('submits { workflowKey, variables: { website_url } } to /api/run', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: JSON.stringify(SAMPLE_VALID_RESULT) }),
    });

    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    const value = fillUrl();
    fireEvent.click(screen.getByRole('button', { name: /propose campaign/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/run',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          workflowKey: 'google-ads-analysis',
          variables: { website_url: value },
        }),
      })
    );
  });

  it('renders a structured result UI (not raw markdown) when the response is valid JSON matching the schema', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: JSON.stringify(SAMPLE_VALID_RESULT) }),
    });

    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    fillUrl();
    fireEvent.click(screen.getByRole('button', { name: /propose campaign/i }));

    await waitFor(() => {
      expect(screen.getByText(SAMPLE_VALID_RESULT.companyName)).toBeTruthy();
    });

    expect(screen.getByText(SAMPLE_VALID_RESULT.industry)).toBeTruthy();
    expect(screen.getByText(SAMPLE_VALID_RESULT.targetAudience)).toBeTruthy();
    expect(screen.getByText(SAMPLE_VALID_RESULT.suggestedDailyBudget)).toBeTruthy();
    expect(screen.getByText(SAMPLE_VALID_RESULT.keywords[0])).toBeTruthy();
    expect(screen.getByText(SAMPLE_VALID_RESULT.adVariations[0].headline)).toBeTruthy();
    expect(screen.getByText(SAMPLE_VALID_RESULT.adVariations[0].description)).toBeTruthy();
    expect(screen.getByText(SAMPLE_VALID_RESULT.adVariations[1].headline)).toBeTruthy();

    expect(mockWorkflowResultDisplay).not.toHaveBeenCalled();
    expect(screen.queryByTestId('workflow-result-fallback')).toBeNull();
  });

  it('falls back to WorkflowResultDisplay when result.result is not valid JSON', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: '## Campaign Proposal\nSome markdown text.' }),
    });

    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    fillUrl();
    fireEvent.click(screen.getByRole('button', { name: /propose campaign/i }));

    await waitFor(() => {
      expect(screen.getByTestId('workflow-result-fallback')).toBeTruthy();
    });

    expect(mockWorkflowResultDisplay).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Campaign Proposal' })
    );
  });

  it('falls back to WorkflowResultDisplay when JSON is valid but missing required keys', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: JSON.stringify({ foo: 'bar' }) }),
    });

    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    fillUrl();
    fireEvent.click(screen.getByRole('button', { name: /propose campaign/i }));

    await waitFor(() => {
      expect(screen.getByTestId('workflow-result-fallback')).toBeTruthy();
    });
    expect(mockWorkflowResultDisplay).toHaveBeenCalled();
  });

  it('falls back to WorkflowResultDisplay when adVariations is an empty array', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: JSON.stringify({ ...SAMPLE_VALID_RESULT, adVariations: [] }),
      }),
    });

    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    fillUrl();
    fireEvent.click(screen.getByRole('button', { name: /propose campaign/i }));

    await waitFor(() => {
      expect(screen.getByTestId('workflow-result-fallback')).toBeTruthy();
    });
    expect(mockWorkflowResultDisplay).toHaveBeenCalled();
  });

  it('invalidates team-limit and the workflow-scoped history query on success', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: JSON.stringify(SAMPLE_VALID_RESULT) }),
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderWithQueryClient(<GoogleAdsAnalysisPage />, queryClient);
    fillUrl();
    fireEvent.click(screen.getByRole('button', { name: /propose campaign/i }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['team-limit'] });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workflow-history', 'google-ads-analysis'] });
  });

  it('surfaces an API error message', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'The AI Tutor API is temporarily unavailable.' }),
    });

    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    fillUrl();
    fireEvent.click(screen.getByRole('button', { name: /propose campaign/i }));

    await waitFor(() => {
      expect(screen.getByText(/temporarily unavailable/i)).toBeTruthy();
    });
  });

  it("renders a past history item's structured output without refilling the URL field", () => {
    renderWithQueryClient(<GoogleAdsAnalysisPage />);

    act(() => {
      historyHandlers.onSelectHistory?.(
        'website_url: https://old-example.com',
        JSON.stringify(SAMPLE_VALID_RESULT)
      );
    });

    expect(screen.getByText(SAMPLE_VALID_RESULT.companyName)).toBeTruthy();
    expect((screen.getByLabelText(/^website url$/i) as HTMLInputElement).value).toBe('');
  });
});
