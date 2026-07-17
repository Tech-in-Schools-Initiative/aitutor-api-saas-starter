import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requestPasswordReset } from '@/lib/auth/password-reset';

const requestSchema = z.object({
  email: z.string().email(),
});

const GENERIC_MESSAGE =
  'If an account exists for that email, a password reset link has been sent.';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = requestSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    await requestPasswordReset(result.data.email);
  } catch (err) {
    // Never let an infra failure distinguish this response from the
    // known-account or unknown-account paths -- log server-side only.
    console.error('requestPasswordReset failed', err);
  }

  return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
}
