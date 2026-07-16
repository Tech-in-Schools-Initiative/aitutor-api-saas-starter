import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import { users } from '@repo/db/schema';
import { getUserById } from '@repo/db/queries';

let userId: number;

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      email: `vitest-get-user-by-id-${Date.now()}@example.com`,
      passwordHash: 'not-a-real-hash',
      role: 'member',
    })
    .returning();
  userId = user.id;
});

afterAll(async () => {
  if (userId) {
    await db.delete(users).where(eq(users.id, userId));
  }
});

describe('getUserById', () => {
  it('returns the user row for an existing, non-deleted user', async () => {
    const user = await getUserById(userId);
    expect(user).not.toBeNull();
    expect(user!.id).toBe(userId);
  });

  it('returns null for a user id that does not exist', async () => {
    const user = await getUserById(-1);
    expect(user).toBeNull();
  });

  it('returns null for a soft-deleted user', async () => {
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));
    const user = await getUserById(userId);
    expect(user).toBeNull();
    await db.update(users).set({ deletedAt: null }).where(eq(users.id, userId));
  });
});
