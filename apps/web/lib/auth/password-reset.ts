import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@repo/db/client';
import {
  users,
  teamMembers,
  activityLogs,
  passwordResetTokens,
  ActivityType,
  type NewActivityLog,
} from '@repo/db/schema';
import { hashPassword, setSession } from './session';
import {
  signResetToken,
  verifyResetToken,
  hashResetTokenId,
  RESET_TOKEN_TTL_MINUTES,
} from './reset-token';
import { sendPasswordResetEmail } from '@repo/email/send';

const GENERIC_INVALID_TOKEN_ERROR = 'This reset link is invalid or has expired.';

async function logActivity(
  teamId: number | null | undefined,
  userId: number,
  type: ActivityType,
) {
  if (teamId === null || teamId === undefined) {
    return;
  }
  const newActivity: NewActivityLog = {
    teamId,
    userId,
    action: type,
  };
  await db.insert(activityLogs).values(newActivity);
}

async function getTeamIdForUser(userId: number): Promise<number | null> {
  const membership = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, userId),
  });
  return membership?.teamId ?? null;
}

/**
 * Always resolves to the same shape whether or not `email` belongs to an
 * account, so callers can render one generic "check your email" message
 * with no observable branch on account existence.
 */
export async function requestPasswordReset(
  email: string,
): Promise<{ success: true }> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (user) {
    // Invalidate any prior outstanding token for this user so only the
    // most recently requested link is usable.
    await db
      .delete(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          isNull(passwordResetTokens.usedAt),
        ),
      );

    const { token, tokenHash, expiresAt } = await signResetToken(user.id);

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const teamId = await getTeamIdForUser(user.id);
    await logActivity(teamId, user.id, ActivityType.REQUEST_PASSWORD_RESET);

    const resetUrl = `${process.env.BASE_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name ?? user.email,
      resetUrl,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
    });
  }

  return { success: true };
}

/**
 * Always resolves — never throws for a known failure mode (bad token,
 * expired token, already-used token). Callers must check the resolved
 * shape (`'error' in outcome`), not wrap this in a try/catch expecting a
 * thrown error.
 */
export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<{ success: true } | { error: string }> {
  let payload;
  try {
    payload = await verifyResetToken(token);
  } catch {
    // Covers both our own InvalidResetTokenError (wrong/missing purpose
    // claim) and jose's own errors (bad signature, malformed, expired JWT).
    return { error: GENERIC_INVALID_TOKEN_ERROR };
  }

  const tokenHash = hashResetTokenId(payload.jti);
  const tokenRow = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.tokenHash, tokenHash),
  });

  if (!tokenRow) {
    return { error: GENERIC_INVALID_TOKEN_ERROR };
  }
  if (tokenRow.usedAt) {
    return { error: 'This reset link has already been used.' };
  }
  if (tokenRow.expiresAt < new Date()) {
    return { error: GENERIC_INVALID_TOKEN_ERROR };
  }
  if (tokenRow.userId !== payload.user.id) {
    return { error: GENERIC_INVALID_TOKEN_ERROR };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, tokenRow.userId),
  });
  if (!user) {
    return { error: GENERIC_INVALID_TOKEN_ERROR };
  }

  const passwordHash = await hashPassword(newPassword);

  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, tokenRow.id));

  const teamId = await getTeamIdForUser(user.id);
  await logActivity(teamId, user.id, ActivityType.RESET_PASSWORD);

  // Product decision (confirmed during design): a successful reset signs
  // the user in immediately, matching the existing signIn/signUp UX.
  await setSession(user);

  return { success: true };
}
