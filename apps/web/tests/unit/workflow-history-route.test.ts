import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getUserMock, getUserWithTeamMock, getTeamForUserMock, getWorkflowHistoryMock } =
  vi.hoisted(() => ({
    getUserMock: vi.fn(),
    getUserWithTeamMock: vi.fn(),
    getTeamForUserMock: vi.fn(),
    getWorkflowHistoryMock: vi.fn(),
  }));

vi.mock('@/lib/auth/session', () => ({
  getUser: getUserMock,
}));

vi.mock('@repo/db/queries', () => ({
  getUserWithTeam: getUserWithTeamMock,
  getTeamForUser: getTeamForUserMock,
}));

vi.mock('@repo/db/utils', () => ({
  getWorkflowHistory: getWorkflowHistoryMock,
}));

import { GET } from '@/app/api/workflow/history/route';

describe('GET /api/workflow/history', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getUserWithTeamMock.mockReset();
    getTeamForUserMock.mockReset();
    getWorkflowHistoryMock.mockReset();
  });

  it('resolves the team via getUserWithTeam, not the heavier getTeamForUser', async () => {
    getUserMock.mockResolvedValue({ id: 42 });
    getUserWithTeamMock.mockResolvedValue({ user: { id: 42 }, teamId: 7 });
    getWorkflowHistoryMock.mockResolvedValue([
      { id: 1, input: 'a', output: 'b', createdAt: new Date().toISOString() },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/workflow/history?limit=5'));
    const body = await response.json();

    expect(getUserWithTeamMock).toHaveBeenCalledWith(42);
    expect(getTeamForUserMock).not.toHaveBeenCalled();
    expect(getWorkflowHistoryMock).toHaveBeenCalledWith(7, 5);
    expect(body).toHaveLength(1);
  });

  it('returns 404 when the user has no team', async () => {
    getUserMock.mockResolvedValue({ id: 42 });
    getUserWithTeamMock.mockResolvedValue({ user: { id: 42 }, teamId: null });

    const response = await GET(new NextRequest('http://localhost/api/workflow/history'));
    expect(response.status).toBe(404);
  });
});
