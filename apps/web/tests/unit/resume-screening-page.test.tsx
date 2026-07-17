// apps/web/tests/unit/resume-screening-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ResumeScreening from '@/app/(dashboard)/dashboard/workflows/resume-screening/page';

const mockWorkflowResultDisplay = vi.hoisted(() => vi.fn());

vi.mock('@/components/ai-tutor-api/WorkflowResultDisplay', () => ({
  default: (props: { title: string; result: any }) => {
    mockWorkflowResultDisplay(props);
    return (
      <div data-testid="workflow-result-fallback">
        <span data-testid="workflow-result-fallback-title">{props.title}</span>
        <span data-testid="workflow-result-fallback-body">{JSON.stringify(props.result)}</span>
      </div>
    );
  },
}));

vi.mock('@/components/workflow/WorkflowHistoryDrawer', () => ({
  WorkflowHistoryDrawer: ({ workflowKey }: { workflowKey: string }) => (
    <div data-testid="history-drawer-stub" data-workflow-key={workflowKey} />
  ),
}));

const VALID_STRUCTURED_RESULT = {
  matchScore: 6,
  overallAssessment:
    'Solid backend fundamentals overall, but the resume undersells distributed-systems experience at scale and lacks a couple of keywords from the listing.',
  missingKeywords: ['distributed systems', 'high-throughput', 'Kubernetes'],
  suggestedImprovements: [
    { section: 'Experience', suggestion: 'Quantify the transaction volume your Node.js/TypeScript APIs handled to mirror the listing\'s scale requirements.' },
    { section: 'Skills', suggestion: 'Call out any container orchestration exposure, even informal, since the listing emphasizes Kubernetes.' },
  ],
  topPriorityFix: 'Add concrete scale/throughput numbers to your most recent role so it matches the listing\'s "millions of transactions per day" language.',
};

function renderWithQueryClient(
  ui: React.ReactElement,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  return { queryClient, ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>) };
}

function fillAllFields() {
  fireEvent.change(screen.getByLabelText('Job listing URL'), { target: { value: 'https://example.com/jobs/123' } });
  fireEvent.change(screen.getByLabelText('Resume'), { target: { value: 'Jane Doe, 6 years experience.' } });
}

describe('Resume Improvement Analysis page', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    mockWorkflowResultDisplay.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders both fields with correct labels', () => {
    const { container } = renderWithQueryClient(<ResumeScreening />);
    expect(container.querySelector('[data-slot="card"]')).toBeTruthy();
    expect(screen.getByLabelText('Job listing URL')).toBeTruthy();
    expect(screen.getByLabelText('Resume')).toBeTruthy();
  });

  it('renders the job listing URL input with type="url"', () => {
    renderWithQueryClient(<ResumeScreening />);
    expect(screen.getByLabelText('Job listing URL').getAttribute('type')).toBe('url');
  });

  it('passes workflowKey="resume-screening" to the history drawer', () => {
    renderWithQueryClient(<ResumeScreening />);
    expect(screen.getByTestId('history-drawer-stub').getAttribute('data-workflow-key')).toBe(
      'resume-screening'
    );
  });

  it('disables the submit button until both fields are filled', () => {
    renderWithQueryClient(<ResumeScreening />);
    const submit = screen.getByRole('button', { name: /analyze resume/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Job listing URL'), { target: { value: 'https://example.com/jobs/123' } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Resume'), { target: { value: 'Jane Doe, 6 years experience.' } });
    expect(submit.disabled).toBe(false);
  });

  it('does not call the API when the submit button is disabled', () => {
    renderWithQueryClient(<ResumeScreening />);
    const submit = screen.getByRole('button', { name: /analyze resume/i });
    fireEvent.click(submit);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('"Load sample" fills both fields', () => {
    renderWithQueryClient(<ResumeScreening />);
    fireEvent.click(screen.getByRole('button', { name: /load sample/i }));

    expect((screen.getByLabelText('Job listing URL') as HTMLInputElement).value.length).toBeGreaterThan(0);
    expect((screen.getByLabelText('Resume') as HTMLTextAreaElement).value).toMatch(/Jane Doe/);

    const submit = screen.getByRole('button', { name: /analyze resume/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });

  it('submits job_listing_url and resume to /api/run with workflowKey', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: JSON.stringify(VALID_STRUCTURED_RESULT) }),
    });

    renderWithQueryClient(<ResumeScreening />);
    fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze resume/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/run',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          workflowKey: 'resume-screening',
          variables: {
            job_listing_url: 'https://example.com/jobs/123',
            resume: 'Jane Doe, 6 years experience.',
          },
        }),
      })
    );
  });

  it('renders a structured coaching UI (not raw markdown) when the result is valid JSON matching the schema', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: JSON.stringify(VALID_STRUCTURED_RESULT) }),
    });

    renderWithQueryClient(<ResumeScreening />);
    fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze resume/i }));

    await waitFor(() => {
      expect(screen.getByTestId('match-score')).toBeTruthy();
    });

    expect(screen.getByTestId('match-score').textContent).toBe('6/10');
    expect(screen.getByTestId('overall-assessment').textContent).toBe(VALID_STRUCTURED_RESULT.overallAssessment);
    expect(screen.getByText(VALID_STRUCTURED_RESULT.missingKeywords[0])).toBeTruthy();
    expect(screen.getByText(VALID_STRUCTURED_RESULT.suggestedImprovements[0].section)).toBeTruthy();
    expect(screen.getByText(VALID_STRUCTURED_RESULT.suggestedImprovements[0].suggestion)).toBeTruthy();
    expect(screen.getByTestId('top-priority-fix').textContent).toBe(VALID_STRUCTURED_RESULT.topPriorityFix);

    // No recommendation-badge / fit-score UI from the old recruiter-facing concept.
    expect(screen.queryByTestId('recommendation-badge')).toBeNull();
    expect(screen.queryByTestId('fit-score')).toBeNull();

    // The fallback markdown renderer must not be used for a valid structured result.
    expect(mockWorkflowResultDisplay).not.toHaveBeenCalled();
    expect(screen.queryByTestId('workflow-result-fallback')).toBeNull();
  });

  it('falls back to WorkflowResultDisplay when result.result is not valid JSON', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: '## Match Score\n8/10 - looks like a strong match.' }),
    });

    renderWithQueryClient(<ResumeScreening />);
    fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze resume/i }));

    await waitFor(() => {
      expect(screen.getByTestId('workflow-result-fallback')).toBeTruthy();
    });

    expect(mockWorkflowResultDisplay).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Resume Improvement Analysis' })
    );
    expect(screen.getByTestId('workflow-result-fallback-title').textContent).toBe('Resume Improvement Analysis');
    expect(screen.queryByTestId('match-score')).toBeNull();
  });

  it('falls back to WorkflowResultDisplay when result.result is valid JSON but lacks required keys', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: JSON.stringify({ someOtherField: 'oops' }) }),
    });

    renderWithQueryClient(<ResumeScreening />);
    fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze resume/i }));

    await waitFor(() => {
      expect(screen.getByTestId('workflow-result-fallback')).toBeTruthy();
    });

    expect(mockWorkflowResultDisplay).toHaveBeenCalled();
    expect(screen.queryByTestId('match-score')).toBeNull();
  });

  it('invalidates team-limit and resume-screening workflow-history queries on success', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: JSON.stringify(VALID_STRUCTURED_RESULT) }),
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderWithQueryClient(<ResumeScreening />, queryClient);
    fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze resume/i }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['team-limit'] });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workflow-history', 'resume-screening'] });
  });

  it('surfaces an API error message without crashing', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Monthly message limit reached.' }),
    });

    renderWithQueryClient(<ResumeScreening />);
    fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze resume/i }));

    await waitFor(() => {
      expect(screen.getByText(/Monthly message limit reached/i)).toBeTruthy();
    });
  });
});
