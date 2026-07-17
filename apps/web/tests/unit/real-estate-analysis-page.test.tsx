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
            'property_address: 1 Old Ave\nproperty_type: condo',
            JSON.stringify({
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

const FIELDS: Array<{ id: string; label: string; sample: string }> = [
  { id: 'property_address', label: 'Property address', sample: '482 Maple Street, Columbus, OH 43215' },
  {
    id: 'property_type',
    label: 'Property type (e.g. single-family, duplex, condo)',
    sample: 'Duplex (2 units, side-by-side)',
  },
  { id: 'asking_price', label: 'Asking price', sample: '$310,000' },
  { id: 'estimated_monthly_rent', label: 'Estimated monthly rent', sample: '$2,400 combined ($1,200/unit)' },
  { id: 'annual_property_taxes', label: 'Annual property taxes', sample: '$4,650' },
  { id: 'monthly_hoa', label: 'Monthly HOA fee (0 if none)', sample: '0' },
  { id: 'notable_features', label: 'Notable features / condition notes', sample: 'Renovated in 2021.' },
];

const VALID_ANALYSIS_JSON = JSON.stringify({
  verdict: 'Buy',
  verdictSummary: 'Solid cash-flowing duplex in a stable rental market.',
  capRatePercent: 6.8,
  capRateExplanation: 'NOI of $21,080 divided by the $310,000 asking price.',
  estimatedMonthlyCashFlow: 315,
  cashFlowExplanation: 'Rent minus estimated mortgage, taxes, insurance, and maintenance reserve.',
  risks: ['Below-market Unit A lease caps near-term upside', 'Older roof may need replacement within 10 years'],
  recommendation: 'Proceed with an inspection and verify Unit A lease terms before making an offer.',
});

function renderWithQueryClient(
  ui: React.ReactElement,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  return { queryClient, ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>) };
}

function fillAllFields() {
  for (const field of FIELDS) {
    fireEvent.change(screen.getByLabelText(field.label), { target: { value: field.sample } });
  }
}

describe('Real Estate Investment Analysis page', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    workflowResultMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders all 7 input fields with the correct labels', () => {
    renderWithQueryClient(<RealEstateAnalysis />);
    for (const field of FIELDS) {
      expect(screen.getByLabelText(field.label)).toBeTruthy();
    }
  });

  it('passes workflowKey="real-estate-analysis" to the history drawer', () => {
    renderWithQueryClient(<RealEstateAnalysis />);
    expect(screen.getByTestId('history-drawer-stub').getAttribute('data-workflow-key')).toBe(
      'real-estate-analysis'
    );
  });

  it('disables submit until all 7 fields are filled', () => {
    renderWithQueryClient(<RealEstateAnalysis />);
    const submitButton = screen.getByRole('button', { name: /analyze property/i }) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);

    for (let i = 0; i < FIELDS.length - 1; i++) {
      fireEvent.change(screen.getByLabelText(FIELDS[i].label), { target: { value: FIELDS[i].sample } });
    }
    expect(submitButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(FIELDS[FIELDS.length - 1].label), {
      target: { value: FIELDS[FIELDS.length - 1].sample },
    });
    expect(submitButton.disabled).toBe(false);
  });

  it('treats whitespace-only input as not filled', () => {
    renderWithQueryClient(<RealEstateAnalysis />);
    for (const field of FIELDS) {
      fireEvent.change(screen.getByLabelText(field.label), { target: { value: '   ' } });
    }
    expect((screen.getByRole('button', { name: /analyze property/i }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('fills all 7 fields with the sample data when "Load sample" is clicked', () => {
    renderWithQueryClient(<RealEstateAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: /load sample/i }));
    for (const field of FIELDS) {
      const input = screen.getByLabelText(field.label) as HTMLInputElement | HTMLTextAreaElement;
      expect(input.value.trim().length).toBeGreaterThan(0);
    }
    expect((screen.getByRole('button', { name: /analyze property/i }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  it('submits the correct variables object with all 7 keys to /api/run', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: VALID_ANALYSIS_JSON }),
    });

    renderWithQueryClient(<RealEstateAnalysis />);
    fillAllFields();
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
            property_address: FIELDS[0].sample,
            property_type: FIELDS[1].sample,
            asking_price: FIELDS[2].sample,
            estimated_monthly_rent: FIELDS[3].sample,
            annual_property_taxes: FIELDS[4].sample,
            monthly_hoa: FIELDS[5].sample,
            notable_features: FIELDS[6].sample,
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
    fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze property/i }));

    await waitFor(() => {
      expect(screen.getByTestId('verdict-badge')).toBeTruthy();
    });

    expect(screen.getByTestId('verdict-badge').textContent).toBe('Buy');
    expect(screen.getByText('6.8%')).toBeTruthy();
    expect(screen.getByText('$315')).toBeTruthy();
    expect(screen.getByText(/Below-market Unit A lease caps near-term upside/)).toBeTruthy();
    expect(
      screen.getByText(/Proceed with an inspection and verify Unit A lease terms/)
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
    fillAllFields();
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
    fillAllFields();
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
    fillAllFields();
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
    fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze property/i }));

    await waitFor(() => {
      expect(screen.getByText(/Monthly message limit reached/i)).toBeTruthy();
    });
  });

  it('renders a past history entry\'s structured output without refilling the form fields', () => {
    renderWithQueryClient(<RealEstateAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: /^restore-from-history$/i }));

    expect(screen.getByTestId('verdict-badge').textContent).toBe('Hold');
    expect(screen.getByText('Restored recommendation text.')).toBeTruthy();

    // Form fields are deliberately left untouched (not refilled from history).
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
