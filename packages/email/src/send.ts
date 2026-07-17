// packages/email/src/send.ts
import { createElement } from 'react';
import { sendEmail } from './client';
import { PasswordResetEmail } from './templates/PasswordResetEmail';
import { TeamInvitationEmail } from './templates/TeamInvitationEmail';

export type SendPasswordResetEmailArgs = {
  to: string;
  name?: string;
  resetUrl: string;
  expiresInMinutes: number;
};

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
  expiresInMinutes,
}: SendPasswordResetEmailArgs) {
  return sendEmail({
    to,
    subject: 'Reset your password',
    react: createElement(PasswordResetEmail, {
      name,
      resetUrl,
      expiresInMinutes,
    }),
  });
}

export type SendTeamInvitationEmailArgs = {
  to: string;
  teamName: string;
  inviterName?: string;
  inviteUrl: string;
  role: string;
};

export async function sendTeamInvitationEmail({
  to,
  teamName,
  inviterName,
  inviteUrl,
  role,
}: SendTeamInvitationEmailArgs) {
  return sendEmail({
    to,
    subject: `You've been invited to join ${teamName}`,
    react: createElement(TeamInvitationEmail, {
      teamName,
      inviterName,
      inviteUrl,
      role,
    }),
  });
}
