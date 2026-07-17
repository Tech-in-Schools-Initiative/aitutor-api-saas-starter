// apps/web/tests/unit/workflow-page-mutation.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Workflow from '@/app/(dashboard)/dashboard/workflow/page';

vi.mock('@/components/ai-tutor-api/StoryDisplay', () => ({
  default: ({ result }: { result: any }) => <div data-testid="story-result">{JSON.stringify(result)}</div>,
}));

vi.mock('@/components/workflow/WorkflowHistoryDrawer', () => ({
  WorkflowHistoryDrawer: () => <div data-testid="history-drawer-stub" />,
}));

function renderWithQueryClient(
  ui: React.ReactElement,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  return { queryClient, ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>) };
}

describe('Workflow page /api/run mutation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('submits the story via useMutation and renders the result', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'Once upon a time...' }),
    });

    renderWithQueryClient(<Workflow />);

    fireEvent.change(screen.getByPlaceholderText(/Tell me a story/i), {
      target: { value: 'A magical forest' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Generate Story/i }));

    await waitFor(() => {
      expect(screen.getByTestId('story-result')).toBeTruthy();
    });
    expect(fetch).toHaveBeenCalledWith('/api/run', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ story: 'A magical forest' }),
    }));
  });

  it('invalidates team-limit and workflow-history queries on success', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'Once upon a time...' }),
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderWithQueryClient(<Workflow />, queryClient);

    fireEvent.change(screen.getByPlaceholderText(/Tell me a story/i), {
      target: { value: 'A magical forest' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Generate Story/i }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['team-limit'] });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workflow-history'] });
  });

  it('shows a validation message without calling the API for an empty story', () => {
    renderWithQueryClient(<Workflow />);
    fireEvent.click(screen.getByRole('button', { name: /Generate Story/i }));
    expect(screen.getByText('Please enter a story')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});
