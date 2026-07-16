import { describe, it, expect, beforeEach, vi } from 'vitest';
import { passwordResetTokens, activityLogs } from '@repo/db/schema';
import { signResetToken } from '@/lib/auth/reset-token';

const mockDb = vi.hoisted(() => ({
  query: {
    users: { findFirst: vi.fn() },
    teamMembers: { findFirst: vi.fn() },
    passwordResetTokens: { findFirst: vi.fn() },
  },
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

const mockSendPasswordResetEmail = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: 'email_test_id' }),
);

const mockCookieStore = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@repo/db/client', () => ({ db: mockDb }));
vi.mock('@repo/email/send', () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

import {
  requestPasswordReset,
  confirmPasswordReset,
} from '@/lib/auth/password-reset';

function mockInsert() {
  const values = vi.fn().mockResolvedValue(undefined);
  mockDb.insert.mockReturnValue({ values });
  return values;
}
function mockUpdate() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });
  mockDb.update.mockReturnValue({ set });
  return { set, where };
}
function mockDelete() {
  const where = vi.fn().mockResolvedValue(undefined);
  mockDb.delete.mockReturnValue({ where });
  return where;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert();
  mockUpdate();
  mockDelete();
  mockDb.query.teamMembers.findFirst.mockResolvedValue({ teamId: 99 });
});

describe('requestPasswordReset: account-enumeration safety', () => {
  it('returns { success: true } and emails when the account exists', async () => {
    mockDb.query.users.findFirst.mockResolvedValue({
      id: 7,
      email: 'exists@example.com',
      name: 'Existing User',
      passwordHash: 'old-hash',
    });

    const result = await requestPasswordReset('exists@example.com');

    expect(result).toEqual({ success: true });
    expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'exists@example.com' }),
    );
    expect(mockDb.delete).toHaveBeenCalledWith(passwordResetTokens);
    expect(mockDb.insert).toHaveBeenCalledWith(passwordResetTokens);
    expect(mockDb.insert).toHaveBeenCalledWith(activityLogs);
  });

  it('returns the identical { success: true } and sends no email when the account does not exist', async () => {
    mockDb.query.users.findFirst.mockResolvedValue(undefined);

    const result = await requestPasswordReset('missing@example.com');

    expect(result).toEqual({ success: true });
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.delete).not.toHaveBeenCalled();
  });
});

describe('confirmPasswordReset: single-use token behavior', () => {
  it('accepts a valid unused token, updates the password, and signs the user in', async () => {
    const { token, tokenHash } = await signResetToken(7);
    mockDb.query.passwordResetTokens.findFirst.mockResolvedValue({
      id: 1,
      userId: 7,
      tokenHash,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    mockDb.query.users.findFirst.mockResolvedValue({
      id: 7,
      email: 'a@example.com',
      name: 'A',
      passwordHash: 'old-hash',
    });

    const result = await confirmPasswordReset(token, 'new-password-123');

    expect(result).toEqual({ success: true });
    // Two update() calls occurred: users.passwordHash + passwordResetTokens.usedAt.
    expect(mockDb.update).toHaveBeenCalledTimes(2);
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'session',
      expect.any(String),
      expect.any(Object),
    );
  });

  it('rejects a second confirm attempt once the token row is marked used', async () => {
    const { token, tokenHash } = await signResetToken(7);
    mockDb.query.passwordResetTokens.findFirst.mockResolvedValue({
      id: 1,
      userId: 7,
      tokenHash,
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });

    const result = await confirmPasswordReset(token, 'another-password');

    expect(result).toEqual({
      error: 'This reset link has already been used.',
    });
  });

  it('rejects an expired DB row even if the JWT itself still verifies', async () => {
    const { token, tokenHash } = await signResetToken(7);
    mockDb.query.passwordResetTokens.findFirst.mockResolvedValue({
      id: 1,
      userId: 7,
      tokenHash,
      usedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
      createdAt: new Date(),
    });

    const result = await confirmPasswordReset(token, 'another-password');

    expect(result).toEqual({
      error: 'This reset link is invalid or has expired.',
    });
  });

  it('rejects a garbage token string without throwing', async () => {
    const result = await confirmPasswordReset('not-a-real-token', 'x');

    expect(result).toEqual({
      error: 'This reset link is invalid or has expired.',
    });
  });
});
