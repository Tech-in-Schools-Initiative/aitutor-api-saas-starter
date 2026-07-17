import { Button, Heading, Section, Text } from '@react-email/components';
import { EmailLayout } from './EmailLayout';

export type PasswordResetEmailProps = {
  name?: string;
  resetUrl: string;
  expiresInMinutes: number;
};

export function PasswordResetEmail({
  name,
  resetUrl,
  expiresInMinutes,
}: PasswordResetEmailProps) {
  const greetingName = name?.trim() || 'there';

  return (
    <EmailLayout previewText="Reset your password">
      <Heading className="text-xl font-bold text-gray-900">
        Reset your password
      </Heading>
      {/*
        Using a single template-literal expression (rather than mixed JSX
        text + `{expression}` children like `Hi {greetingName},`) here and
        below: React's static-markup renderer inserts `<!-- -->` comment
        markers between adjacent text/expression children to keep hydration
        unambiguous, which would otherwise split "Hi Ada," into
        "Hi <!-- -->Ada<!-- -->," in the rendered HTML.
      */}
      <Text className="text-sm text-gray-600">{`Hi ${greetingName},`}</Text>
      <Text className="text-sm text-gray-600">
        We received a request to reset your password. Click the button below
        to choose a new one. If you didn&apos;t request this, you can safely
        ignore this email.
      </Text>
      <Section className="my-6 text-center">
        {/*
          Deliberately not using Tailwind's `bg-gradient-to-r from-... via-...
          to-...` utilities here: @react-email/tailwind inlines each class's
          *own* declarations but never resolves the `--tw-gradient-from/via/
          to/stops` custom properties those classes are supposed to set on
          this element, so the button ships with an unresolved
          `linear-gradient(to right, var(--tw-gradient-stops))` and renders
          with no visible color in every email client (same issue fixed in
          EmailLayout's accent bar). Explicit hex stops (Tailwind's own
          purple-500/pink-500/orange-500 defaults) via inline `style`
          sidestep that and actually render.
        */}
        <Button
          href={resetUrl}
          className="rounded-full px-6 py-3 text-sm font-medium text-white"
          style={{
            backgroundImage:
              'linear-gradient(to right, #a855f7, #ec4899, #f97316)',
          }}
        >
          Reset password
        </Button>
      </Section>
      <Text className="text-xs text-gray-400">{`This link expires in ${expiresInMinutes} minutes. If the button above doesn't work, copy and paste this URL into your browser:`}</Text>
      <Text className="break-all text-xs text-gray-400">{resetUrl}</Text>
    </EmailLayout>
  );
}

export default PasswordResetEmail;
