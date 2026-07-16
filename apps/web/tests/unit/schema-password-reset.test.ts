// apps/web/tests/unit/schema-password-reset.test.ts
import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { passwordResetTokens, ActivityType } from '@repo/db/schema';

describe('passwordResetTokens table shape', () => {
  const { name, columns } = getTableConfig(passwordResetTokens);
  const columnNames = columns.map((c) => c.name);

  it('is named password_reset_tokens', () => {
    expect(name).toBe('password_reset_tokens');
  });

  it('has the expected columns', () => {
    expect(columnNames).toEqual(
      expect.arrayContaining([
        'id',
        'user_id',
        'token_hash',
        'expires_at',
        'used_at',
        'created_at',
      ]),
    );
  });

  it('enforces token_hash uniqueness and non-nullability', () => {
    const tokenHash = columns.find((c) => c.name === 'token_hash');
    expect(tokenHash?.isUnique).toBe(true);
    expect(tokenHash?.notNull).toBe(true);
  });

  it('leaves used_at nullable (null means the token is still live)', () => {
    const usedAt = columns.find((c) => c.name === 'used_at');
    expect(usedAt?.notNull).toBe(false);
  });

  it('requires user_id and expires_at', () => {
    const userId = columns.find((c) => c.name === 'user_id');
    const expiresAt = columns.find((c) => c.name === 'expires_at');
    expect(userId?.notNull).toBe(true);
    expect(expiresAt?.notNull).toBe(true);
  });
});

describe('ActivityType additions', () => {
  it('adds REQUEST_PASSWORD_RESET', () => {
    expect(ActivityType.REQUEST_PASSWORD_RESET).toBe('REQUEST_PASSWORD_RESET');
  });

  it('adds RESET_PASSWORD', () => {
    expect(ActivityType.RESET_PASSWORD).toBe('RESET_PASSWORD');
  });
});
