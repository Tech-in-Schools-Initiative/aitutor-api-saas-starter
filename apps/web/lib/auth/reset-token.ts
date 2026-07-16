import { createHash, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

const key = new TextEncoder().encode(process.env.AUTH_SECRET);

export const RESET_TOKEN_PURPOSE = 'password-reset' as const;
export const RESET_TOKEN_TTL_MINUTES = 30;

export type ResetTokenPayload = {
  purpose: typeof RESET_TOKEN_PURPOSE;
  user: { id: number };
  jti: string;
};

export class InvalidResetTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidResetTokenError';
  }
}

/** SHA-256 hex digest of a token's `jti`, used as the DB lookup key. Not
 * bcrypt: bcrypt's per-call salting makes it unusable for a WHERE clause. */
export function hashResetTokenId(jti: string): string {
  return createHash('sha256').update(jti).digest('hex');
}

export async function signResetToken(userId: number): Promise<{
  token: string;
  jti: string;
  tokenHash: string;
  expiresAt: Date;
}> {
  const jti = randomUUID();
  const expiresAt = new Date(
    Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000,
  );

  const token = await new SignJWT({
    purpose: RESET_TOKEN_PURPOSE,
    user: { id: userId },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(key);

  return { token, jti, tokenHash: hashResetTokenId(jti), expiresAt };
}

export async function verifyResetToken(
  token: string,
): Promise<ResetTokenPayload> {
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });

  if (payload.purpose !== RESET_TOKEN_PURPOSE) {
    throw new InvalidResetTokenError(
      'Token is not a password-reset token (missing or wrong purpose claim)',
    );
  }
  if (typeof payload.jti !== 'string' || payload.jti.length === 0) {
    throw new InvalidResetTokenError('Token is missing a jti claim');
  }

  const user = payload.user as { id?: unknown } | undefined;
  if (!user || typeof user.id !== 'number') {
    throw new InvalidResetTokenError('Token is missing a valid user claim');
  }

  return { purpose: RESET_TOKEN_PURPOSE, user: { id: user.id }, jti: payload.jti };
}
