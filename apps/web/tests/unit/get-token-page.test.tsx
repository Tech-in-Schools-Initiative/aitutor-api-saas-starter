// apps/web/tests/unit/get-token-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Token from '@/app/(dashboard)/dashboard/get-token/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Get Token dashboard page', () => {
  it('renders the shared Card/Button primitives instead of raw elements', () => {
    const { container } = renderWithQueryClient(<Token />);
    expect(container.querySelector('[data-slot="card"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="button"]')).toBeTruthy();
    expect(container.querySelector('.glass-morphism')).toBeNull();
  });

  it('fetches and displays a token when the button is clicked', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, token: 'test-token-123' }),
    }) as unknown as typeof fetch;

    renderWithQueryClient(<Token />);
    fireEvent.click(screen.getByRole('button', { name: /get new token/i }));

    await waitFor(() => {
      expect(screen.getByText('test-token-123')).toBeTruthy();
    });
  });

  it('uses the consistent dashboard header pattern', () => {
    renderWithQueryClient(<Token />);
    expect(screen.getByRole('heading', { name: 'Get Token', level: 1 })).toBeTruthy();
  });

  it('no longer imports the unused next/link module', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'app/(dashboard)/dashboard/get-token/page.tsx'),
      'utf-8'
    );
    expect(source).not.toMatch(/from ['"]next\/link['"]/);
  });
});
