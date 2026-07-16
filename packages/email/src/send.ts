// TEMPORARY placeholder ahead of Task 8.
//
// Per the Phase 3 plan (docs/superpowers/plans/2026-07-15-phase-3-email-feature.md),
// Task 8 ("packages/email send.ts") is what's supposed to introduce this file for
// real, wrapping the lazy Resend client (Task 4's src/client.ts) and the
// PasswordResetEmail/TeamInvitationEmail React Email templates (Tasks 6-7) into
// two typed send helpers. None of that exists yet at Task 3.
//
// Task 3 (apps/web/lib/auth/password-reset.ts) needs `sendPasswordResetEmail` to
// exist as a real, typed export of `@repo/email/send` so that module resolves at
// both compile time (tsc) and test time (vi.mock('@repo/email/send', ...) can
// only intercept a specifier that actually resolves through this package's
// `exports` map). This stub exists solely to satisfy that forward reference; it
// is never exercised for real because every caller mocks this module in tests,
// and it deliberately throws if it's ever reached outside a test, so a
// misconfigured mock fails loudly instead of silently pretending to send email.
//
// Task 8 replaces this file's body wholesale with the real implementation
// described in the plan.

export type SendPasswordResetEmailArgs = {
  to: string;
  name?: string;
  resetUrl: string;
  expiresInMinutes: number;
};

export type SendPasswordResetEmailResult = {
  id: string;
};

export async function sendPasswordResetEmail(
  _args: SendPasswordResetEmailArgs,
): Promise<SendPasswordResetEmailResult> {
  throw new Error(
    'sendPasswordResetEmail is a Task-3-era placeholder (packages/email/src/send.ts) ' +
      'and is not wired up to Resend yet — that lands in Task 8. Every real caller ' +
      'must mock @repo/email/send in tests; reaching this line means that mock is missing.',
  );
}
