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

const FIELD_LABELS: Record<string, RegExp> = {
  campaign_name: /^campaign name$/i,
  impressions: /^impressions$/i,
  clicks: /^clicks$/i,
  spend: /^spend$/i,
  conversions: /^conversions$/i,
  conversion_value: /^conversion value$/i,
  top_keyword_data: /top keyword performance/i,
};

const SAMPLE_VALID_RESULT = {
  performanceSummary: 'The campaign performed solidly with healthy ROAS and stable CTR.',
  ctr: '5.25%',
  cpc: '$1.80',
  conversionRate: '4.78%',
  roas: '4.26x',
  workingWell: ['Strong CTR on non-brand terms', 'Conversion value trending up'],
  underperforming: [
    { issue: 'High CPC on mobile', rootCause: 'Weak mobile-specific ad copy' },
  ],
  recommendedActions: ['1. Add mobile-preferred ad copy', '2. Pause low-QS keywords'],
  nextTest: 'Test a mobile-specific headline variant against the current control.',
};

function fillAllFields(overrides: Partial<Record<string, string>> = {}) {
  const values: Record<string, string> = {
    campaign_name: 'Search - Non-Brand',
    impressions: '48200',
    clicks: '2532',
    spend: '4545.24',
    conversions: '121',
    conversion_value: '19360.00',
    top_keyword_data: "'project management software' - 640 clicks, 41 conversions",
    ...overrides,
  };
  for (const [name, regex] of Object.entries(FIELD_LABELS)) {
    fireEvent.change(screen.getByLabelText(regex), { target: { value: values[name] } });
  }
  return values;
}

describe('Google Ads Campaign Analysis page', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    delete historyHandlers.onSelectHistory;
    mockWorkflowResultDisplay.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders all 7 fields with correct labels', () => {
    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    for (const regex of Object.values(FIELD_LABELS)) {
      expect(screen.getByLabelText(regex)).toBeTruthy();
    }
  });

  it('passes workflowKey="google-ads-analysis" to the history drawer', () => {
    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    expect(screen.getByTestId('history-drawer-stub').getAttribute('data-workflow-key')).toBe(
      'google-ads-analysis'
    );
  });

  it('disables submit until all 7 fields are filled', () => {
    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    const submitButton = screen.getByRole('button', { name: /analyze campaign/i }) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(FIELD_LABELS.campaign_name), {
      target: { value: 'Search - Non-Brand' },
    });
    expect(submitButton.disabled).toBe(true);

    fillAllFields();
    expect(submitButton.disabled).toBe(false);
  });

  it('loads all 7 sample values when "Load sample" is clicked', () => {
    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    fireEvent.click(screen.getByRole('button', { name: /load sample/i }));

    expect((screen.getByLabelText(FIELD_LABELS.campaign_name) as HTMLInputElement).value).not.toBe('');
    expect((screen.getByLabelText(FIELD_LABELS.impressions) as HTMLInputElement).value).not.toBe('');
    expect((screen.getByLabelText(FIELD_LABELS.clicks) as HTMLInputElement).value).not.toBe('');
    expect((screen.getByLabelText(FIELD_LABELS.spend) as HTMLInputElement).value).not.toBe('');
    expect((screen.getByLabelText(FIELD_LABELS.conversions) as HTMLInputElement).value).not.toBe('');
    expect((screen.getByLabelText(FIELD_LABELS.conversion_value) as HTMLInputElement).value).not.toBe('');
    expect((screen.getByLabelText(FIELD_LABELS.top_keyword_data) as HTMLTextAreaElement).value).not.toBe('');

    expect((screen.getByRole('button', { name: /analyze campaign/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('submits { workflowKey, variables } with all 7 keys to /api/run', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: JSON.stringify(SAMPLE_VALID_RESULT) }),
    });

    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    const values = fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze campaign/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/run',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          workflowKey: 'google-ads-analysis',
          variables: values,
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
    fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze campaign/i }));

    await waitFor(() => {
      expect(screen.getByText(SAMPLE_VALID_RESULT.performanceSummary)).toBeTruthy();
    });

    expect(screen.getByText('5.25%')).toBeTruthy();
    expect(screen.getByText('$1.80')).toBeTruthy();
    expect(screen.getByText('4.78%')).toBeTruthy();
    expect(screen.getByText('4.26x')).toBeTruthy();
    expect(screen.getByText('Strong CTR on non-brand terms')).toBeTruthy();
    expect(screen.getByText('High CPC on mobile')).toBeTruthy();
    expect(screen.getByText('Weak mobile-specific ad copy')).toBeTruthy();
    expect(screen.getByText('1. Add mobile-preferred ad copy')).toBeTruthy();
    expect(screen.getByText(SAMPLE_VALID_RESULT.nextTest)).toBeTruthy();

    expect(mockWorkflowResultDisplay).not.toHaveBeenCalled();
    expect(screen.queryByTestId('workflow-result-fallback')).toBeNull();
  });

  it('falls back to WorkflowResultDisplay when result.result is not valid JSON', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: '## Performance Summary\nSome markdown text.' }),
    });

    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze campaign/i }));

    await waitFor(() => {
      expect(screen.getByTestId('workflow-result-fallback')).toBeTruthy();
    });

    expect(mockWorkflowResultDisplay).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Campaign Analysis' })
    );
  });

  it('falls back to WorkflowResultDisplay when JSON is valid but missing required keys', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: JSON.stringify({ foo: 'bar' }) }),
    });

    renderWithQueryClient(<GoogleAdsAnalysisPage />);
    fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze campaign/i }));

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
    fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze campaign/i }));

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
    fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze campaign/i }));

    await waitFor(() => {
      expect(screen.getByText(/temporarily unavailable/i)).toBeTruthy();
    });
  });

  it('renders a past history item\'s structured output without refilling the form fields', () => {
    renderWithQueryClient(<GoogleAdsAnalysisPage />);

    act(() => {
      historyHandlers.onSelectHistory?.(
        'campaign_name: Old Campaign\nimpressions: 1000',
        JSON.stringify(SAMPLE_VALID_RESULT)
      );
    });

    expect(screen.getByText(SAMPLE_VALID_RESULT.performanceSummary)).toBeTruthy();
    expect((screen.getByLabelText(FIELD_LABELS.campaign_name) as HTMLInputElement).value).toBe('');
  });
});
