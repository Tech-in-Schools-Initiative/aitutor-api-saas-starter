import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const { sendTeamInvitationEmailMock, getUserMock } = vi.hoisted(() => ({
  sendTeamInvitationEmailMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock('@repo/email/send', () => ({
  sendTeamInvitationEmail: sendTeamInvitationEmailMock,
}));

// `validatedActionWithUser` (via `apps/web/lib/auth/middleware.ts`) authenticates
// by calling `getUser` from `@/lib/auth/session` (which itself reads the `session`
// cookie and verifies a JWT) -- NOT a `getUser` export from `@repo/db/queries`
// (no such export exists there; see packages/db/src/queries.ts). Mock the real
// source directly so we don't have to fabricate a signed session cookie.
vi.mock('@/lib/auth/session', () => ({
  getUser: getUserMock,
}));

vi.mock('@repo/db/client', () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'from', 'leftJoin', 'where', 'insert', 'values']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.limit = vi.fn();
  chain.returning = vi.fn();
  return { db: chain };
});

vi.mock('@repo/db/queries', () => ({
  getUserWithTeam: vi.fn(async () => ({ user: { id: 1 }, teamId: 7 })),
}));

import { db } from '@repo/db/client';
import { inviteTeamMember } from '@/app/(login)/actions';

// `db` is typed as the real `PostgresJsDatabase<...>` (it has no `.limit`/
// `.returning` members) even though `@repo/db/client` is mocked above --
// TypeScript checks the import against the real module's types, not the
// mock factory's shape. Cast the whole import to an untyped record first,
// matching the pattern the mock factory itself uses for its chain methods,
// so the property access below doesn't trip a type error.
const mockedDb = db as unknown as Record<string, ReturnType<typeof vi.fn>>;
const limitMock = mockedDb.limit;
const returningMock = mockedDb.returning;

describe('inviteTeamMember email wiring', () => {
  beforeEach(() => {
    sendTeamInvitationEmailMock.mockReset();
    sendTeamInvitationEmailMock.mockResolvedValue({ id: 'email_1' });
    limitMock.mockReset();
    returningMock.mockReset();
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({
      id: 1,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    });
  });

  it('sends a team invitation email with the created invitation id in the URL', async () => {
    limitMock
      .mockResolvedValueOnce([]) // existingMember
      .mockResolvedValueOnce([]) // existingInvitation
      .mockResolvedValueOnce([{ name: 'Acme Team' }]); // team name lookup
    returningMock.mockResolvedValueOnce([{ id: 42 }]);

    const formData = new FormData();
    formData.set('email', 'invitee@example.com');
    formData.set('role', 'member');

    const result = await inviteTeamMember(
      { error: '', success: '' },
      formData,
    );

    expect(sendTeamInvitationEmailMock).toHaveBeenCalledTimes(1);
    const call = sendTeamInvitationEmailMock.mock.calls[0][0];
    expect(call.to).toBe('invitee@example.com');
    expect(call.teamName).toBe('Acme Team');
    expect(call.role).toBe('member');
    expect(call.inviterName).toBe('Ada Lovelace');
    expect(call.inviteUrl).toContain('/sign-up?inviteId=42');
    expect(result).toEqual({ success: 'Invitation sent successfully' });
  });

  it('still returns success to the user even when the email send fails', async () => {
    limitMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ name: 'Acme Team' }]);
    returningMock.mockResolvedValueOnce([{ id: 43 }]);
    sendTeamInvitationEmailMock.mockRejectedValue(new Error('Resend is down'));

    const formData = new FormData();
    formData.set('email', 'invitee2@example.com');
    formData.set('role', 'member');

    const result = await inviteTeamMember(
      { error: '', success: '' },
      formData,
    );

    expect(result).toEqual({ success: 'Invitation sent successfully' });
  });
});
