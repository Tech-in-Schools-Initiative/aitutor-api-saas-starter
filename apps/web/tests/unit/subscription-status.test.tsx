// apps/web/tests/unit/subscription-status.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SidebarProvider } from '@repo/ui/components/sidebar';
import { SubscriptionStatus } from '@/components/subscription-status';

// The real (unmocked) SidebarProvider from @repo/ui calls useIsMobile(),
// which reads window.matchMedia. jsdom doesn't implement it, and it isn't
// polyfilled in tests/setup.ts, so stub it locally (same approach as
// dashboard-query-client-provider.test.tsx).
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>{ui}</SidebarProvider>
      </QueryClientProvider>
    ),
  };
}

describe('SubscriptionStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the remaining-message badge once the query resolves', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ unlimited: false, remainingMessages: 3, subscriptionTier: 'Starter' }),
    });

    renderWithProviders(<SubscriptionStatus />);

    expect(screen.getByText('Loading...')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Messages: 3 left')).toBeTruthy();
    });
    expect(screen.getByText('Starter')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith('/api/team/limit');
  });

  it('shows an error badge when the request fails', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'nope' }),
    });

    renderWithProviders(<SubscriptionStatus />);

    await waitFor(() => {
      expect(screen.getByText('Error loading message count')).toBeTruthy();
    });
  });

  it('configures the query to poll every 20 seconds and refetch on window focus', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ unlimited: true, subscriptionTier: 'Pro' }),
    });

    const { queryClient } = renderWithProviders(<SubscriptionStatus />);

    await waitFor(() => {
      expect(screen.getByText('Messages: Unlimited')).toBeTruthy();
    });

    const query = queryClient.getQueryCache().find({ queryKey: ['team-limit'] });
    // Query.options is typed as the narrower QueryOptions (query-core), which
    // omits observer-only fields like refetchInterval/refetchOnWindowFocus even
    // though useQuery's full option set (incl. those fields) is what's actually
    // stored on the object at runtime. Cast locally rather than widen the import.
    const options = query?.options as
      | { refetchInterval?: number; refetchOnWindowFocus?: boolean }
      | undefined;
    expect(options?.refetchInterval).toBe(20000);
    expect(options?.refetchOnWindowFocus).toBe(true);
  });
});
