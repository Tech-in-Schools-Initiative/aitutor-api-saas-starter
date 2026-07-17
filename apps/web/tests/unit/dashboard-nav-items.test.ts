import { describe, it, expect } from 'vitest';
import { getDashboardNavItems } from '@/lib/navigation/dashboard-nav-items';

describe('getDashboardNavItems', () => {
  it('includes a reachable Get Token nav entry', () => {
    const items = getDashboardNavItems('/dashboard/workflow');
    const getTokenItem = items.find((item) => item.url === '/dashboard/get-token');
    expect(getTokenItem).toBeDefined();
    expect(getTokenItem?.title).toBe('Get Token');
  });

  it('marks the Get Token entry active when the pathname matches', () => {
    const items = getDashboardNavItems('/dashboard/get-token');
    const getTokenItem = items.find((item) => item.url === '/dashboard/get-token');
    expect(getTokenItem?.isActive).toBe(true);
  });

  it('still includes all seven previously existing nav entries', () => {
    const items = getDashboardNavItems('/dashboard');
    expect(items.map((i) => i.url)).toEqual(
      expect.arrayContaining([
        '/dashboard/workflow',
        '/dashboard/chatbot',
        '/dashboard/streaming',
        '/dashboard/team',
        '/dashboard/general',
        '/dashboard/activity',
        '/dashboard/security',
      ])
    );
  });
});
