import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
} from '@react-email/components';
import type { ReactNode } from 'react';

export type EmailLayoutProps = {
  previewText: string;
  children: ReactNode;
};

export function EmailLayout({ previewText, children }: EmailLayoutProps) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-10 max-w-[480px] rounded-lg bg-white p-8 shadow-sm">
            <Section className="mb-6 text-center">
              <Img
                src={`${baseUrl}/logo-long.png`}
                alt="Logo"
                width="150"
                height="40"
                className="mx-auto object-contain"
              />
            </Section>
            {/*
              Deliberately not using Tailwind's `bg-gradient-to-r
              from-... via-... to-...` utilities here: @react-email/tailwind
              inlines each class's *own* declarations but never resolves the
              `--tw-gradient-from/via/to/stops` custom properties those
              classes are supposed to set on this element, so the bar ships
              with an unresolved `linear-gradient(to right,
              var(--tw-gradient-stops))` and renders with no visible color in
              every email client. Explicit hex stops (Tailwind's own
              purple-500/pink-500/orange-500 defaults) via inline `style`
              sidestep that and actually render.
            */}
            <Section
              className="mb-6 h-1 rounded-full"
              style={{
                backgroundImage:
                  'linear-gradient(to right, #a855f7, #ec4899, #f97316)',
              }}
            />
            {children}
            <Hr className="my-6 border-gray-200" />
            <Section className="text-center text-xs text-gray-400">
              You&apos;re receiving this email because of activity on your
              account.
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
