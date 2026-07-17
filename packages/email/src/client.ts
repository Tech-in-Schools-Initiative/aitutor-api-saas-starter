import { Resend } from 'resend';
import type { ReactElement } from 'react';

let cachedClient: Resend | null = null;

function getResendClient(): Resend {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY is not set. Add it to your environment before sending email.',
    );
  }

  cachedClient = new Resend(apiKey);
  return cachedClient;
}

export type SendEmailArgs = {
  to: string;
  subject: string;
  react: ReactElement;
};

export type SendEmailResult = {
  id: string;
};

export async function sendEmail({
  to,
  subject,
  react,
}: SendEmailArgs): Promise<SendEmailResult> {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error(
      'RESEND_FROM_EMAIL is not set. Add it to your environment before sending email.',
    );
  }

  const client = getResendClient();
  const { data, error } = await client.emails.send({
    from,
    to,
    subject,
    react,
  });

  if (error) {
    throw new Error(`Failed to send email via Resend: ${error.message}`);
  }

  if (!data) {
    throw new Error(
      'Resend returned no data for a send that reported no error.',
    );
  }

  return { id: data.id };
}

// Exposed for tests only, so the lazy singleton can be reset between cases
// without requiring a fresh module import.
export function __resetClientForTests() {
  cachedClient = null;
}
