import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { TeamInvitationEmail } from '../../src/templates/TeamInvitationEmail';

describe('TeamInvitationEmail', () => {
  it('includes the team name, role, and invite URL', async () => {
    const html = await render(
      <TeamInvitationEmail
        teamName="Acme Team"
        inviterName="Grace Hopper"
        inviteUrl="https://app.example.com/sign-up?inviteId=42"
        role="member"
      />,
    );
    expect(html).toContain('Acme Team');
    expect(html).toContain('member');
    expect(html).toContain('https://app.example.com/sign-up?inviteId=42');
    expect(html).toContain('Grace Hopper');
  });

  it('falls back to a generic inviter name when none is given', async () => {
    const html = await render(
      <TeamInvitationEmail
        teamName="Acme Team"
        inviteUrl="https://app.example.com/sign-up?inviteId=42"
        role="owner"
      />,
    );
    expect(html).toContain('A teammate');
  });

  it('matches the known-good markup snapshot', async () => {
    const html = await render(
      <TeamInvitationEmail
        teamName="Acme Team"
        inviterName="Grace Hopper"
        inviteUrl="https://app.example.com/sign-up?inviteId=42"
        role="member"
      />,
    );
    expect(html).toMatchSnapshot();
  });
});
