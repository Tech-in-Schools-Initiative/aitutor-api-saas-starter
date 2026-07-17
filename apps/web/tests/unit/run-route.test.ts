// apps/web/tests/unit/run-route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  getUserMock,
  getTeamCoreMock,
  checkMessageLimitMock,
  incrementMessageCountMock,
  saveWorkflowHistoryMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  getTeamCoreMock: vi.fn(),
  checkMessageLimitMock: vi.fn(),
  incrementMessageCountMock: vi.fn(),
  saveWorkflowHistoryMock: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  getUser: getUserMock,
}));

vi.mock('@repo/db/queries', () => ({
  getTeamCore: getTeamCoreMock,
}));

vi.mock('@repo/db/utils', () => ({
  checkMessageLimit: checkMessageLimitMock,
  incrementMessageCount: incrementMessageCountMock,
  saveWorkflowHistory: saveWorkflowHistoryMock,
}));

import { POST } from '@/app/api/run/route';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/run', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/run', () => {
  beforeEach(() => {
    getUserMock.mockReset().mockResolvedValue({ id: 1 });
    getTeamCoreMock.mockReset().mockResolvedValue({ id: 7 });
    checkMessageLimitMock.mockReset().mockResolvedValue({ withinLimit: true, remainingMessages: 4 });
    incrementMessageCountMock.mockReset();
    saveWorkflowHistoryMock.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: 'the output' }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('legacy { story } body resolves to story-generator/WORKFLOW_ID and sends { story } to AI Tutor API', async () => {
    vi.stubEnv('WORKFLOW_ID', 'legacy-workflow-id');
    vi.stubEnv('AITUTOR_API_KEY', 'test-key');

    const response = await POST(makeRequest({ story: 'A magical forest' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ result: 'the output' });

    expect(fetch).toHaveBeenCalledWith(
      'https://aitutor-api.vercel.app/api/v1/run/legacy-workflow-id',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ story: 'A magical forest' }),
      })
    );

    expect(saveWorkflowHistoryMock).toHaveBeenCalledWith(
      7,
      1,
      'A magical forest',
      'the output',
      'story-generator'
    );
  });

  it('returns 400 when the legacy body is missing story', async () => {
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('new { workflowKey, variables } body resolves the matching WORKFLOW_ID_* env var and spreads variables into the request body', async () => {
    vi.stubEnv('WORKFLOW_ID_REAL_ESTATE_ANALYSIS', 'real-estate-workflow-id');
    vi.stubEnv('AITUTOR_API_KEY', 'test-key');

    const response = await POST(
      makeRequest({
        workflowKey: 'real-estate-analysis',
        variables: { property_details: 'A 3-bed house' },
      })
    );

    expect(response.status).toBe(200);

    expect(fetch).toHaveBeenCalledWith(
      'https://aitutor-api.vercel.app/api/v1/run/real-estate-workflow-id',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ property_details: 'A 3-bed house' }),
      })
    );

    expect(saveWorkflowHistoryMock).toHaveBeenCalledWith(
      7,
      1,
      'property_details: A 3-bed house',
      'the output',
      'real-estate-analysis'
    );
  });

  it('spreads multiple variables (resume-screening) into the request body and joins them for history', async () => {
    vi.stubEnv('WORKFLOW_ID_RESUME_SCREENING', 'resume-workflow-id');
    vi.stubEnv('AITUTOR_API_KEY', 'test-key');

    const response = await POST(
      makeRequest({
        workflowKey: 'resume-screening',
        variables: {
          job_description: 'Senior Backend Engineer',
          resume: 'Jane Doe, 6 years experience',
        },
      })
    );

    expect(response.status).toBe(200);

    expect(fetch).toHaveBeenCalledWith(
      'https://aitutor-api.vercel.app/api/v1/run/resume-workflow-id',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          job_description: 'Senior Backend Engineer',
          resume: 'Jane Doe, 6 years experience',
        }),
      })
    );

    expect(saveWorkflowHistoryMock).toHaveBeenCalledWith(
      7,
      1,
      'job_description: Senior Backend Engineer\n\nresume: Jane Doe, 6 years experience',
      'the output',
      'resume-screening'
    );
  });

  it('resolves google-ads-analysis to WORKFLOW_ID_GOOGLE_ADS_ANALYSIS', async () => {
    vi.stubEnv('WORKFLOW_ID_GOOGLE_ADS_ANALYSIS', 'google-ads-workflow-id');
    vi.stubEnv('AITUTOR_API_KEY', 'test-key');

    const response = await POST(
      makeRequest({
        workflowKey: 'google-ads-analysis',
        variables: { campaign_data: 'Campaign stats here' },
      })
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      'https://aitutor-api.vercel.app/api/v1/run/google-ads-workflow-id',
      expect.objectContaining({
        body: JSON.stringify({ campaign_data: 'Campaign stats here' }),
      })
    );
  });

  it('returns 400 for an unrecognized workflowKey', async () => {
    vi.stubEnv('AITUTOR_API_KEY', 'test-key');

    const response = await POST(
      makeRequest({ workflowKey: 'not-a-real-workflow', variables: { foo: 'bar' } })
    );

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 400 when the new-shape body is missing variables', async () => {
    vi.stubEnv('WORKFLOW_ID_REAL_ESTATE_ANALYSIS', 'real-estate-workflow-id');
    vi.stubEnv('AITUTOR_API_KEY', 'test-key');

    const response = await POST(makeRequest({ workflowKey: 'real-estate-analysis' }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 500 when the resolved WORKFLOW_ID_* env var is missing', async () => {
    vi.stubEnv('AITUTOR_API_KEY', 'test-key');

    const response = await POST(
      makeRequest({
        workflowKey: 'real-estate-analysis',
        variables: { property_details: 'A 3-bed house' },
      })
    );

    expect(response.status).toBe(500);
    expect(fetch).not.toHaveBeenCalled();
  });
});
