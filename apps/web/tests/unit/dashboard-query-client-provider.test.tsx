// apps/web/tests/unit/dashboard-query-client-provider.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/app/(dashboard)/dashboard/layout';

vi.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => <div data-testid="app-sidebar-stub" />,
}));

// The real (unmocked) SidebarProvider from @repo/ui calls useIsMobile(),
// which reads window.matchMedia. jsdom doesn't implement it, and no prior
// test in this suite renders a real SidebarProvider, so it's never been
// polyfilled in tests/setup.ts. Stub it locally rather than touching the
// shared setup file.
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

function QueryProbe() {
  const { data } = useQuery({
    queryKey: ['probe'],
    queryFn: async () => 'query-client-is-wired',
  });
  return <div data-testid="probe">{data ?? 'loading'}</div>;
}

describe('DashboardLayout QueryClientProvider wiring', () => {
  it('provides a QueryClient to descendants without throwing', async () => {
    render(
      <DashboardLayout>
        <QueryProbe />
      </DashboardLayout>
    );

    await waitFor(() => {
      expect(screen.getByTestId('probe').textContent).toBe('query-client-is-wired');
    });
  });
});
