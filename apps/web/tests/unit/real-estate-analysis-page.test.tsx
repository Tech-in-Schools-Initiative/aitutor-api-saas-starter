// apps/web/tests/unit/real-estate-analysis-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RealEstateAnalysis from '@/app/(dashboard)/dashboard/workflows/real-estate-analysis/page';

const SAMPLE_PROPERTY_DETAILS =
  '3-bed/2-bath single-family home in Austin, TX. Asking price $415,000. Estimated market rent $2,600/mo. Property taxes ~2.1%/yr. Built 1998, roof replaced 2019. HOA: none.';

vi.mock('@/components/ai-tutor-api/WorkflowResultDisplay', () => ({
  default: ({ title, result }: { title: string; result: any }) => (
    <div data-testid="workflow-result">
      <span data-testid="workflow-result-title">{title}</span>
      <span data-testid="workflow-result-body">{JSON.stringify(result)}</span>
    </div>
  ),
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
        onClick={() => onSelectHistory('A restored property', '{"result":"Restored analysis"}')}
      >
        restore-from-history
      </button>
    </div>
  ),
}));

function renderWithQueryClient(
  ui: React.ReactElement,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  return { queryClient, ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>) };
}

describe('Real Estate Investment Analysis page', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the shared Card/Textarea/Button primitives', () => {
    const { container } = renderWithQueryClient(<RealEstateAnalysis />);
    expect(container.querySelector('[data-slot="card"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="textarea"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="button"]')).toBeTruthy();
    expect(screen.getByLabelText('Property details')).toBeTruthy();
  });

  it('passes workflowKey="real-estate-analysis" to the history drawer', () => {
    renderWithQueryClient(<RealEstateAnalysis />);
    expect(screen.getByTestId('history-drawer-stub').getAttribute('data-workflow-key')).toBe(
      'real-estate-analysis'
    );
  });

  it('fills the textarea with the sample input when "Load sample" is clicked', () => {
    renderWithQueryClient(<RealEstateAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: /load sample/i }));
    const textarea = screen.getByLabelText('Property details') as HTMLTextAreaElement;
    expect(textarea.value).toBe(SAMPLE_PROPERTY_DETAILS);
  });

  it('shows a validation message without calling the API for empty property details', () => {
    renderWithQueryClient(<RealEstateAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: /analyze property/i }));
    expect(screen.getByText('Please enter property details')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('submits { workflowKey, variables: { property_details } } to /api/run and renders the result', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: '## Summary\nSolid deal.' }),
    });

    renderWithQueryClient(<RealEstateAnalysis />);
    fireEvent.change(screen.getByLabelText('Property details'), {
      target: { value: 'A 3-bed condo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyze property/i }));

    await waitFor(() => {
      expect(screen.getByTestId('workflow-result')).toBeTruthy();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/run',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          workflowKey: 'real-estate-analysis',
          variables: { property_details: 'A 3-bed condo' },
        }),
      })
    );
    expect(screen.getByTestId('workflow-result-title').textContent).toBe('Investment Analysis');
  });

  it('invalidates team-limit and the workflow-specific history query on success', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'Analysis complete.' }),
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderWithQueryClient(<RealEstateAnalysis />, queryClient);
    fireEvent.change(screen.getByLabelText('Property details'), {
      target: { value: 'A 3-bed condo' },
    });
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
    fireEvent.change(screen.getByLabelText('Property details'), {
      target: { value: 'A 3-bed condo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyze property/i }));

    await waitFor(() => {
      expect(screen.getByText(/Monthly message limit reached/i)).toBeTruthy();
    });
  });

  it('restores the property details field and result from a selected history entry', () => {
    renderWithQueryClient(<RealEstateAnalysis />);
    fireEvent.click(screen.getByRole('button', { name: /restore-from-history/i }));

    const textarea = screen.getByLabelText('Property details') as HTMLTextAreaElement;
    expect(textarea.value).toBe('A restored property');
    expect(screen.getByTestId('workflow-result-body').textContent).toBe(
      JSON.stringify({ result: 'Restored analysis' })
    );
  });
});
