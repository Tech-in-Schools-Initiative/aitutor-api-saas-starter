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
  fitScore: 7,
  fitScoreReason: 'Strong backend fundamentals but limited Node.js/TypeScript tenure and no formal lead title.',
  matchingStrengths: ['6 years of overall backend engineering experience', '2 years of hands-on Node.js/TypeScript and AWS Lambda work'],
  gaps: ['Only 2 years of Node.js/TypeScript versus the 5+ years required', 'No formal team-lead title, only informal mentorship'],
  interviewQuestions: ['Walk me through a time you led a technical decision without formal authority.', 'How comfortable are you ramping up further on Node.js/TypeScript at a senior level?'],
  recommendation: 'Maybe',
  recommendationReason: 'Worth a conversation to clarify leadership readiness and depth of Node.js/TypeScript expertise.',
};

function renderWithQueryClient(
  ui: React.ReactElement,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  return { queryClient, ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>) };
}

function fillAllFields() {
  fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'Senior Backend Engineer' } });
  fireEvent.change(screen.getByLabelText('Must-have skills'), { target: { value: 'Node.js, TypeScript, AWS' } });
  fireEvent.change(screen.getByLabelText('Years of experience required'), { target: { value: '5+ years' } });
  fireEvent.change(screen.getByLabelText('Full job description'), { target: { value: 'Owns the core payments API.' } });
  fireEvent.change(screen.getByLabelText('Candidate resume'), { target: { value: 'Jane Doe, 6 years experience.' } });
}

describe('Resume & Candidate Fit Analysis page', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    mockWorkflowResultDisplay.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders all 5 fields with correct labels', () => {
    const { container } = renderWithQueryClient(<ResumeScreening />);
    expect(container.querySelector('[data-slot="card"]')).toBeTruthy();
    expect(screen.getByLabelText('Job title')).toBeTruthy();
    expect(screen.getByLabelText('Must-have skills')).toBeTruthy();
    expect(screen.getByLabelText('Years of experience required')).toBeTruthy();
    expect(screen.getByLabelText('Full job description')).toBeTruthy();
    expect(screen.getByLabelText('Candidate resume')).toBeTruthy();
  });

  it('passes workflowKey="resume-screening" to the history drawer', () => {
    renderWithQueryClient(<ResumeScreening />);
    expect(screen.getByTestId('history-drawer-stub').getAttribute('data-workflow-key')).toBe(
      'resume-screening'
    );
  });

  it('disables the submit button until all 5 fields are filled', () => {
    renderWithQueryClient(<ResumeScreening />);
    const submit = screen.getByRole('button', { name: /analyze fit/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'Senior Backend Engineer' } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Must-have skills'), { target: { value: 'Node.js, TypeScript, AWS' } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Years of experience required'), { target: { value: '5+ years' } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Full job description'), { target: { value: 'Owns the core payments API.' } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Candidate resume'), { target: { value: 'Jane Doe, 6 years experience.' } });
    expect(submit.disabled).toBe(false);
  });

  it('does not call the API when the submit button is disabled', () => {
    renderWithQueryClient(<ResumeScreening />);
    const submit = screen.getByRole('button', { name: /analyze fit/i });
    fireEvent.click(submit);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('"Load sample" fills all 5 fields', () => {
    renderWithQueryClient(<ResumeScreening />);
    fireEvent.click(screen.getByRole('button', { name: /load sample/i }));

    expect((screen.getByLabelText('Job title') as HTMLInputElement).value).toMatch(/Senior Backend Engineer/);
    expect((screen.getByLabelText('Must-have skills') as HTMLInputElement).value).toMatch(/Node\.js/);
    expect((screen.getByLabelText('Years of experience required') as HTMLInputElement).value).toMatch(/5\+ years/);
    expect((screen.getByLabelText('Full job description') as HTMLTextAreaElement).value.length).toBeGreaterThan(0);
    expect((screen.getByLabelText('Candidate resume') as HTMLTextAreaElement).value).toMatch(/Jane Doe/);

    const submit = screen.getByRole('button', { name: /analyze fit/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });

  it('submits all 5 variables to /api/run with workflowKey', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: JSON.stringify(VALID_STRUCTURED_RESULT) }),
    });

    renderWithQueryClient(<ResumeScreening />);
    fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

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
            job_title: 'Senior Backend Engineer',
            must_have_skills: 'Node.js, TypeScript, AWS',
            years_experience_required: '5+ years',
            job_description: 'Owns the core payments API.',
            resume: 'Jane Doe, 6 years experience.',
          },
        }),
      })
    );
  });

  it('renders a structured UI (not raw markdown) when the result is valid JSON matching the schema', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: JSON.stringify(VALID_STRUCTURED_RESULT) }),
    });

    renderWithQueryClient(<ResumeScreening />);
    fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

    await waitFor(() => {
      expect(screen.getByTestId('fit-score')).toBeTruthy();
    });

    expect(screen.getByTestId('fit-score').textContent).toBe('7/10');
    expect(screen.getByTestId('fit-score-reason').textContent).toBe(VALID_STRUCTURED_RESULT.fitScoreReason);
    expect(screen.getByTestId('recommendation-badge').textContent).toBe('Maybe');
    expect(screen.getByText(VALID_STRUCTURED_RESULT.matchingStrengths[0])).toBeTruthy();
    expect(screen.getByText(VALID_STRUCTURED_RESULT.gaps[0])).toBeTruthy();
    expect(screen.getByText(VALID_STRUCTURED_RESULT.interviewQuestions[0])).toBeTruthy();

    // The fallback markdown renderer must not be used for a valid structured result.
    expect(mockWorkflowResultDisplay).not.toHaveBeenCalled();
    expect(screen.queryByTestId('workflow-result-fallback')).toBeNull();
  });

  it('falls back to WorkflowResultDisplay when result.result is not valid JSON', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: '## Fit Score\n8/10 - looks like a strong match.' }),
    });

    renderWithQueryClient(<ResumeScreening />);
    fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

    await waitFor(() => {
      expect(screen.getByTestId('workflow-result-fallback')).toBeTruthy();
    });

    expect(mockWorkflowResultDisplay).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Candidate Fit Analysis' })
    );
    expect(screen.getByTestId('workflow-result-fallback-title').textContent).toBe('Candidate Fit Analysis');
    expect(screen.queryByTestId('fit-score')).toBeNull();
  });

  it('falls back to WorkflowResultDisplay when result.result is valid JSON but lacks required keys', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: JSON.stringify({ someOtherField: 'oops' }) }),
    });

    renderWithQueryClient(<ResumeScreening />);
    fillAllFields();
    fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

    await waitFor(() => {
      expect(screen.getByTestId('workflow-result-fallback')).toBeTruthy();
    });

    expect(mockWorkflowResultDisplay).toHaveBeenCalled();
    expect(screen.queryByTestId('fit-score')).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

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
    fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

    await waitFor(() => {
      expect(screen.getByText(/Monthly message limit reached/i)).toBeTruthy();
    });
  });
});
