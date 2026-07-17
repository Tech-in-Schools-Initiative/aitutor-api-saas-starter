import { Button, Heading, Section, Text } from '@react-email/components';
import { EmailLayout } from './EmailLayout';

export type TeamInvitationEmailProps = {
  teamName: string;
  inviterName?: string;
  inviteUrl: string;
  role: string;
};

export function TeamInvitationEmail({
  teamName,
  inviterName,
  inviteUrl,
  role,
}: TeamInvitationEmailProps) {
  const inviter = inviterName?.trim() || 'A teammate';

  return (
    <EmailLayout previewText={`${inviter} invited you to join ${teamName}`}>
      <Heading className="text-xl font-bold text-gray-900">
        You&apos;ve been invited to {teamName}
      </Heading>
      <Text className="text-sm text-gray-600">
        {inviter} has invited you to join <strong>{teamName}</strong> as a{' '}
        {role}.
      </Text>
      <Section className="my-6 text-center">
        <Button
          href={inviteUrl}
          className="rounded-full px-6 py-3 text-sm font-medium text-white"
          style={{
            backgroundImage:
              'linear-gradient(to right, #a855f7, #ec4899, #f97316)',
          }}
        >
          Accept invitation
        </Button>
      </Section>
      <Text className="text-xs text-gray-400">
        If the button above doesn&apos;t work, copy and paste this URL into
        your browser:
      </Text>
      <Text className="break-all text-xs text-gray-400">{inviteUrl}</Text>
    </EmailLayout>
  );
}

export default TeamInvitationEmail;
