import { describe, it, expect } from 'vitest';
import { getDashboardNavItems } from '@/lib/navigation/dashboard-nav-items';

describe('getDashboardNavItems', () => {
  it('no longer includes the removed Chatbot, Streaming, or Get Token entries', () => {
    const items = getDashboardNavItems('/dashboard');
    const urls = items.map((i) => i.url);
    expect(urls).not.toContain('/dashboard/chatbot');
    expect(urls).not.toContain('/dashboard/streaming');
    expect(urls).not.toContain('/dashboard/get-token');
  });

  it('still includes a reachable Workflow nav entry', () => {
    const items = getDashboardNavItems('/dashboard/workflow');
    const workflowItem = items.find((item) => item.url === '/dashboard/workflow');
    expect(workflowItem).toBeDefined();
    expect(workflowItem?.title).toBe('Workflow');
  });

  it('marks the Workflow entry active when the pathname matches', () => {
    const items = getDashboardNavItems('/dashboard/workflow');
    const workflowItem = items.find((item) => item.url === '/dashboard/workflow');
    expect(workflowItem?.isActive).toBe(true);
  });

  it('returns exactly the five remaining nav entries', () => {
    const items = getDashboardNavItems('/dashboard');
    expect(items.map((i) => i.url)).toEqual([
      '/dashboard/workflow',
      '/dashboard/team',
      '/dashboard/general',
      '/dashboard/activity',
      '/dashboard/security',
    ]);
  });
});
