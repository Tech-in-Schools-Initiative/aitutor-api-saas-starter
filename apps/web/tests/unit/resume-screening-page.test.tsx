// apps/web/tests/unit/resume-screening-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ResumeScreening from '@/app/(dashboard)/dashboard/workflows/resume-screening/page';

vi.mock('@/components/ai-tutor-api/WorkflowResultDisplay', () => ({
  default: ({ title, result }: { title: string; result: any }) => (
    <div data-testid="workflow-result">
      <span data-testid="workflow-result-title">{title}</span>
      <span data-testid="workflow-result-body">{JSON.stringify(result)}</span>
    </div>
  ),
}));

vi.mock('@/components/workflow/WorkflowHistoryDrawer', () => ({
  WorkflowHistoryDrawer: ({ workflowKey }: { workflowKey: string }) => (
    <div data-testid="history-drawer-stub" data-workflow-key={workflowKey} />
  ),
}));

function renderWithQueryClient(
  ui: React.ReactElement,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  return { queryClient, ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>) };
}

describe('Resume & Candidate Fit Analysis page', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the shared Card/Textarea/Button primitives with two labeled fields', () => {
    const { container } = renderWithQueryClient(<ResumeScreening />);
    expect(container.querySelector('[data-slot="card"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-slot="textarea"]').length).toBe(2);
    expect(screen.getByLabelText('Job description')).toBeTruthy();
    expect(screen.getByLabelText('Resume')).toBeTruthy();
  });

  it('passes workflowKey="resume-screening" to the history drawer', () => {
    renderWithQueryClient(<ResumeScreening />);
    expect(screen.getByTestId('history-drawer-stub').getAttribute('data-workflow-key')).toBe(
      'resume-screening'
    );
  });

  it('disables the submit button until both fields are filled', () => {
    renderWithQueryClient(<ResumeScreening />);
    const submit = screen.getByRole('button', { name: /analyze fit/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Job description'), {
      target: { value: 'Senior Backend Engineer role.' },
    });
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Resume'), {
      target: { value: 'Jane Doe, 6 years experience.' },
    });
    expect(submit.disabled).toBe(false);
  });

  it('does not call the API when the submit button is disabled', () => {
    renderWithQueryClient(<ResumeScreening />);
    const submit = screen.getByRole('button', { name: /analyze fit/i });
    fireEvent.click(submit);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('"Load sample" fills both textareas from the sample content', () => {
    renderWithQueryClient(<ResumeScreening />);
    fireEvent.click(screen.getByRole('button', { name: /load sample/i }));

    const jobDescription = screen.getByLabelText('Job description') as HTMLTextAreaElement;
    const resume = screen.getByLabelText('Resume') as HTMLTextAreaElement;

    expect(jobDescription.value).toMatch(/Senior Backend Engineer/);
    expect(resume.value).toMatch(/Jane Doe/);
  });

  it('submits both variables to /api/run with workflowKey and renders the result', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: '## Fit Score\n8/10' }),
    });

    renderWithQueryClient(<ResumeScreening />);

    fireEvent.change(screen.getByLabelText('Job description'), {
      target: { value: 'Needs 5+ years Node.js.' },
    });
    fireEvent.change(screen.getByLabelText('Resume'), {
      target: { value: 'Jane Doe has 6 years experience.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

    await waitFor(() => {
      expect(screen.getByTestId('workflow-result')).toBeTruthy();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/run',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          workflowKey: 'resume-screening',
          variables: {
            job_description: 'Needs 5+ years Node.js.',
            resume: 'Jane Doe has 6 years experience.',
          },
        }),
      })
    );
    expect(screen.getByTestId('workflow-result-title').textContent).toBe('Candidate Fit Analysis');
  });

  it('invalidates team-limit and resume-screening workflow-history queries on success', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: '## Fit Score\n8/10' }),
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderWithQueryClient(<ResumeScreening />, queryClient);

    fireEvent.change(screen.getByLabelText('Job description'), {
      target: { value: 'Needs 5+ years Node.js.' },
    });
    fireEvent.change(screen.getByLabelText('Resume'), {
      target: { value: 'Jane Doe has 6 years experience.' },
    });
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

    fireEvent.change(screen.getByLabelText('Job description'), {
      target: { value: 'Needs 5+ years Node.js.' },
    });
    fireEvent.change(screen.getByLabelText('Resume'), {
      target: { value: 'Jane Doe has 6 years experience.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

    await waitFor(() => {
      expect(screen.getByText(/Monthly message limit reached/i)).toBeTruthy();
    });
  });
});
