import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import {
  signResetToken,
  verifyResetToken,
  hashResetTokenId,
  InvalidResetTokenError,
} from '@/lib/auth/reset-token';
import { signToken } from '@/lib/auth/session';

describe('reset token round-trip', () => {
  it('signs and verifies a reset token, preserving userId, purpose, and jti', async () => {
    const { token, jti, tokenHash, expiresAt } = await signResetToken(42);
    expect(typeof token).toBe('string');
    expect(tokenHash).toBe(hashResetTokenId(jti));
    expect(tokenHash).toHaveLength(64);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const verified = await verifyResetToken(token);
    expect(verified.purpose).toBe('password-reset');
    expect(verified.user.id).toBe(42);
    expect(verified.jti).toBe(jti);
  });

  it('produces a distinct jti and tokenHash on every call', async () => {
    const a = await signResetToken(1);
    const b = await signResetToken(1);
    expect(a.jti).not.toBe(b.jti);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe('purpose-claim rejection', () => {
  it('rejects a real session token (no purpose claim) signed with the same AUTH_SECRET', async () => {
    const sessionToken = await signToken({
      user: { id: 42 },
      expires: new Date(Date.now() + 60_000).toISOString(),
    });
    await expect(verifyResetToken(sessionToken)).rejects.toThrow(
      InvalidResetTokenError,
    );
  });

  it('rejects a token carrying a different purpose claim', async () => {
    const key = new TextEncoder().encode(process.env.AUTH_SECRET);
    const wrongPurposeToken = await new SignJWT({
      purpose: 'team-invitation',
      user: { id: 42 },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setJti('some-jti')
      .setIssuedAt()
      .setExpirationTime('1 hour from now')
      .sign(key);

    await expect(verifyResetToken(wrongPurposeToken)).rejects.toThrow(
      InvalidResetTokenError,
    );
  });
});

describe('expiry', () => {
  it('rejects a token whose expiration has already passed', async () => {
    const key = new TextEncoder().encode(process.env.AUTH_SECRET);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiredToken = await new SignJWT({
      purpose: 'password-reset',
      user: { id: 42 },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setJti('expired-jti')
      .setIssuedAt(nowSeconds - 3600)
      .setExpirationTime(nowSeconds - 60)
      .sign(key);

    await expect(verifyResetToken(expiredToken)).rejects.toThrow();
  });
});
