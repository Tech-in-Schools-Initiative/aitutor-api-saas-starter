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

  it('still includes a reachable Workflow nav entry, renamed to Custom Workflow', () => {
    const items = getDashboardNavItems('/dashboard/workflow');
    const workflowItem = items.find((item) => item.url === '/dashboard/workflow');
    expect(workflowItem).toBeDefined();
    expect(workflowItem?.title).toBe('Custom Workflow');
  });

  it('marks the Custom Workflow entry active when the pathname matches', () => {
    const items = getDashboardNavItems('/dashboard/workflow');
    const workflowItem = items.find((item) => item.url === '/dashboard/workflow');
    expect(workflowItem?.isActive).toBe(true);
  });

  it('includes nav entries for the 3 new example workflow pages', () => {
    const items = getDashboardNavItems('/dashboard');
    const realEstate = items.find(
      (item) => item.url === '/dashboard/workflows/real-estate-analysis'
    );
    const googleAds = items.find(
      (item) => item.url === '/dashboard/workflows/google-ads-analysis'
    );
    const resumeScreening = items.find(
      (item) => item.url === '/dashboard/workflows/resume-screening'
    );
    expect(realEstate?.title).toBe('Real Estate Analysis');
    expect(googleAds?.title).toBe('Google Ads Analysis');
    expect(resumeScreening?.title).toBe('Resume Screening');
  });

  it('marks each new workflow entry active only on its own pathname, not on Custom Workflow', () => {
    const items = getDashboardNavItems('/dashboard/workflows/real-estate-analysis');
    const customWorkflow = items.find((item) => item.url === '/dashboard/workflow');
    const realEstate = items.find(
      (item) => item.url === '/dashboard/workflows/real-estate-analysis'
    );
    const googleAds = items.find(
      (item) => item.url === '/dashboard/workflows/google-ads-analysis'
    );
    expect(realEstate?.isActive).toBe(true);
    expect(customWorkflow?.isActive).toBe(false);
    expect(googleAds?.isActive).toBe(false);
  });

  it('returns exactly the eight nav entries in order', () => {
    const items = getDashboardNavItems('/dashboard');
    expect(items.map((i) => i.url)).toEqual([
      '/dashboard/workflow',
      '/dashboard/workflows/real-estate-analysis',
      '/dashboard/workflows/google-ads-analysis',
      '/dashboard/workflows/resume-screening',
      '/dashboard/team',
      '/dashboard/general',
      '/dashboard/activity',
      '/dashboard/security',
    ]);
  });
});
