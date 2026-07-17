// apps/web/tests/unit/real-estate-analysis-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RealEstateAnalysis from '@/app/(dashboard)/dashboard/workflows/real-estate-analysis/page';

const workflowResultMock = vi.hoisted(() => vi.fn());

vi.mock('@/components/ai-tutor-api/WorkflowResultDisplay', () => ({
  default: (props: { title: string; result: any }) => {
    workflowResultMock(props);
    return (
      <div data-testid="workflow-result-fallback">
        <span data-testid="workflow-result-title">{props.title}</span>
        <span data-testid="workflow-result-body">{JSON.stringify(props.result)}</span>
      </div>
    );
  },
}));

vi.mock('@/components/workflow/WorkflowHistoryDrawer', () => ({
  WorkflowHistoryDrawer: ({
    workflowKey,
    onSelectHistory,
  }: {
    workflowKey: string;
    onSelectHistory: (input: string, output: string) => void;
  }) => (
    <div data-testid="history-drawer-stub" data-workflow-key={workflowKey}>
      <button
        type="button"
        onClick={() =>
          onSelectHistory(
            'property_address: 1 Old Ave',
            JSON.stringify({
              estimatedPropertyValue: 275000,
              estimatedMonthlyRent: 1850,
              propertyType: 'Condo',
              verdict: 'Hold',
              verdictSummary: 'A restored, middling deal.',
              capRatePercent: 4.2,
              capRateExplanation: 'Restored explanation.',
              estimatedMonthlyCashFlow: 50,
              cashFlowExplanation: 'Restored cash flow explanation.',
              risks: ['Restored risk one'],
              recommendation: 'Restored recommendation text.',
            })
          )
        }
      >
        restore-from-history
      </button>
      <button
        type="button"
        onClick={() => onSelectHistory('property_address: 1 Old Ave', 'Not JSON, just markdown text.')}
      >
        restore-non-json-from-history
      </button>
    </div>
  ),
}));

const SAMPLE_ADDRESS = '1600 Pennsylvania Avenue NW, Washington, DC 20500';
const CUSTOM_ADDRESS = '742 Evergreen Terrace, Springfield, IL 62704';

const VALID_ANALYSIS_JSON = JSON.stringify({
  estimatedPropertyValue: 412000,
  estimatedMonthlyRent: 2650,
  propertyType: 'Single-family',
  verdict: 'Buy',
  verdictSummary: 'Solid cash-flowing home in a stable rental market.',
  capRatePercent: 6.8,
  capRateExplanation: 'NOI of $21,080 divided by the estimated $412,000 value.',
  estimatedMonthlyCashFlow: 315,
  cashFlowExplanation: 'Rent minus estimated mortgage, taxes, insurance, and maintenance reserve.',
  risks: ['Below-market comps may shift near-term upside', 'Older roof may need replacement within 10 years'],
  recommendation: 'Proceed with an inspection and verify local comps before making an offer.',
});

function renderWithQueryClient(
  ui: React.ReactElement,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  return { queryClient, ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>) };
}

describe('Real Estate Investment Analysis page', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    workflowResultMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a single property address field with the correct label', () => {
    renderWithQueryClient(<RealEstateAnalysis />);
    expect(screen.getByLabelText('Property address')).toBeTruthy();
  });

  it('passes workflowKey="real-estate-analysis" to the history drawer', () => {
    renderWithQueryClient(<RealEstateAnalysis />);
    expect(screen.getByTestId('history-drawer-stub').getAttribute('data-workflow-key')).toBe(
      'real-estate-analysis'
    );
  });

  it('disables submit until the field is filled', () => {
    renderWithQueryClient(<RealEstateAnalysis />);
    const submitButton = screen.getByRole('button', { name: /analyze property/i }) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Property address'), { target: { value: CUSTOM_ADDRESS } });
    expect(submitButton.disabled).toBe(false);
  });

  it('treats whitespace-only input as not filled', () => {
    renderWithQueryClient(<RealEstateAnalysis />);
    fireEvent.change(screen.getByLabelText('Property address'), { target: { value: '   ' } });
    expect((screen.getByRole('button', { name: /analyze property/i }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('fills the field with sample data when "Load sample" is clicked', () => {
    renderWithQueryClient(<RealEstateAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: /load sample/i }));
    const input = screen.getByLabelText('Property address') as HTMLInputElement;
    expect(input.value.trim().length).toBeGreaterThan(0);
    expect(input.value).toBe(SAMPLE_ADDRESS);
    expect((screen.getByRole('button', { name: /analyze property/i }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  it('submits { property_address } as the variables object to /api/run', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: VALID_ANALYSIS_JSON }),
    });

    renderWithQueryClient(<RealEstateAnalysis />);
    fireEvent.change(screen.getByLabelText('Property address'), { target: { value: CUSTOM_ADDRESS } });
    fireEvent.click(screen.getByRole('button', { name: /analyze property/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/run',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          workflowKey: 'real-estate-analysis',
          variables: {
            property_address: CUSTOM_ADDRESS,
          },
        }),
      })
    );
  });

  it('renders the structured result UI (not raw markdown) on a valid schema response', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: VALID_ANALYSIS_JSON }),
    });

    renderWithQueryClient(<RealEstateAnalysis />);
    fireEvent.change(screen.getByLabelText('Property address'), { target: { value: CUSTOM_ADDRESS } });
    fireEvent.click(screen.getByRole('button', { name: /analyze property/i }));

    await waitFor(() => {
      expect(screen.getByTestId('verdict-badge')).toBeTruthy();
    });

    expect(screen.getByText('$412,000')).toBeTruthy();
    expect(screen.getByText('$2,650')).toBeTruthy();
    expect(screen.getByText(/Single-family/)).toBeTruthy();
    expect(screen.getByTestId('verdict-badge').textContent).toBe('Buy');
    expect(screen.getByText('6.8%')).toBeTruthy();
    expect(screen.getByText('$315')).toBeTruthy();
    expect(screen.getByText(/Below-market comps may shift near-term upside/)).toBeTruthy();
    expect(
      screen.getByText(/Proceed with an inspection and verify local comps/)
    ).toBeTruthy();

    // Ensure the fallback markdown display was NOT used.
    expect(screen.queryByTestId('workflow-result-fallback')).toBeNull();
    expect(workflowResultMock).not.toHaveBeenCalled();
  });

  it('falls back to WorkflowResultDisplay when result.result is not valid JSON', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: '## Not JSON\nJust markdown text.' }),
    });

    renderWithQueryClient(<RealEstateAnalysis />);
    fireEvent.change(screen.getByLabelText('Property address'), { target: { value: CUSTOM_ADDRESS } });
    fireEvent.click(screen.getByRole('button', { name: /analyze property/i }));

    await waitFor(() => {
      expect(screen.getByTestId('workflow-result-fallback')).toBeTruthy();
    });

    expect(workflowResultMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Investment Analysis' })
    );
    expect(screen.queryByTestId('verdict-badge')).toBeNull();
  });

  it('falls back to WorkflowResultDisplay when JSON is valid but missing required keys', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: JSON.stringify({ capRatePercent: 5 }) }),
    });

    renderWithQueryClient(<RealEstateAnalysis />);
    fireEvent.change(screen.getByLabelText('Property address'), { target: { value: CUSTOM_ADDRESS } });
    fireEvent.click(screen.getByRole('button', { name: /analyze property/i }));

    await waitFor(() => {
      expect(screen.getByTestId('workflow-result-fallback')).toBeTruthy();
    });
    expect(screen.queryByTestId('verdict-badge')).toBeNull();
  });

  it('invalidates team-limit and the workflow-specific history query on success', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: VALID_ANALYSIS_JSON }),
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderWithQueryClient(<RealEstateAnalysis />, queryClient);
    fireEvent.change(screen.getByLabelText('Property address'), { target: { value: CUSTOM_ADDRESS } });
    fireEvent.click(screen.getByRole('button', { name: /analyze property/i }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['team-limit'] });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workflow-history', 'real-estate-analysis'] });
  });

  it('surfaces an API error message without crashing', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Monthly message limit reached.' }),
    });

    renderWithQueryClient(<RealEstateAnalysis />);
    fireEvent.change(screen.getByLabelText('Property address'), { target: { value: CUSTOM_ADDRESS } });
    fireEvent.click(screen.getByRole('button', { name: /analyze property/i }));

    await waitFor(() => {
      expect(screen.getByText(/Monthly message limit reached/i)).toBeTruthy();
    });
  });

  it('renders a past history entry\'s structured output without refilling the form field', () => {
    renderWithQueryClient(<RealEstateAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: /^restore-from-history$/i }));

    expect(screen.getByTestId('verdict-badge').textContent).toBe('Hold');
    expect(screen.getByText('Restored recommendation text.')).toBeTruthy();

    // The address field is deliberately left untouched (not refilled from history).
    const addressInput = screen.getByLabelText('Property address') as HTMLInputElement;
    expect(addressInput.value).toBe('');
  });

  it('falls back to WorkflowResultDisplay for a non-JSON history entry', () => {
    renderWithQueryClient(<RealEstateAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: /restore-non-json-from-history/i }));

    expect(screen.getByTestId('workflow-result-fallback')).toBeTruthy();
    expect(screen.queryByTestId('verdict-badge')).toBeNull();
  });
});
