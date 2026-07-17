import { NextResponse } from 'next/server';
import { z } from 'zod';
import { confirmPasswordReset } from '@/lib/auth/password-reset';

const confirmSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = confirmSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }

  // confirmPasswordReset never throws for a known failure -- it always
  // resolves to { success: true } | { error: string }. Check the resolved
  // shape rather than wrapping this in a try/catch.
  const outcome = await confirmPasswordReset(
    result.data.token,
    result.data.password,
  );

  if ('error' in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json(
    { message: 'Your password has been reset.' },
    { status: 200 },
  );
}
