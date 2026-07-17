// packages/email/tests/unit/send.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendEmailMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/client', () => ({
  sendEmail: sendEmailMock,
}));

import { sendPasswordResetEmail, sendTeamInvitationEmail } from '../../src/send';
import { PasswordResetEmail } from '../../src/templates/PasswordResetEmail';
import { TeamInvitationEmail } from '../../src/templates/TeamInvitationEmail';

describe('sendPasswordResetEmail', () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue({ id: 'email_1' });
  });

  it('sends to the given address with the reset subject and template', async () => {
    const result = await sendPasswordResetEmail({
      to: 'user@example.com',
      name: 'Ada',
      resetUrl: 'https://app.example.com/reset-password?token=abc',
      expiresInMinutes: 30,
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0][0];
    expect(call.to).toBe('user@example.com');
    expect(call.subject).toBe('Reset your password');
    expect(call.react.type).toBe(PasswordResetEmail);
    expect(call.react.props).toEqual({
      name: 'Ada',
      resetUrl: 'https://app.example.com/reset-password?token=abc',
      expiresInMinutes: 30,
    });
    expect(result).toEqual({ id: 'email_1' });
  });
});

describe('sendTeamInvitationEmail', () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue({ id: 'email_2' });
  });

  it('sends to the invited address with a team-specific subject and template', async () => {
    const result = await sendTeamInvitationEmail({
      to: 'invitee@example.com',
      teamName: 'Acme Team',
      inviterName: 'Grace',
      inviteUrl: 'https://app.example.com/sign-up?inviteId=42',
      role: 'member',
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0][0];
    expect(call.to).toBe('invitee@example.com');
    expect(call.subject).toBe("You've been invited to join Acme Team");
    expect(call.react.type).toBe(TeamInvitationEmail);
    expect(call.react.props).toEqual({
      teamName: 'Acme Team',
      inviterName: 'Grace',
      inviteUrl: 'https://app.example.com/sign-up?inviteId=42',
      role: 'member',
    });
    expect(result).toEqual({ id: 'email_2' });
  });
});
