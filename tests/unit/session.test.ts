import { describe, it, expect, vi } from 'vitest';
import {
  signToken,
  verifyToken,
  hashPassword,
  comparePasswords,
} from '@/lib/auth/session';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

describe('session token round-trip', () => {
  it('signs and verifies a token, preserving the payload', async () => {
    const payload = {
      user: { id: 42 },
      expires: new Date(Date.now() + 60_000).toISOString(),
    };
    const token = await signToken(payload);
    expect(typeof token).toBe('string');

    const verified = await verifyToken(token);
    expect(verified.user.id).toBe(42);
    expect(verified.expires).toBe(payload.expires);
  });

  it('rejects a tampered token', async () => {
    const token = await signToken({
      user: { id: 1 },
      expires: new Date(Date.now() + 60_000).toISOString(),
    });
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    await expect(verifyToken(tampered)).rejects.toThrow();
  });
});

describe('password hashing round-trip', () => {
  it('hashes a password and verifies it against the original', async () => {
    const plain = 'correct-horse-battery-staple';
    const hashed = await hashPassword(plain);
    expect(hashed).not.toBe(plain);
    await expect(comparePasswords(plain, hashed)).resolves.toBe(true);
  });

  it('rejects an incorrect password against a hash', async () => {
    const hashed = await hashPassword('correct-horse-battery-staple');
    await expect(comparePasswords('wrong-password', hashed)).resolves.toBe(false);
  });
});
