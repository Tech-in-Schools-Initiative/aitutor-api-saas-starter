import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import { teams, users, teamMembers } from '@repo/db/schema';
import { getTeamCore } from '@repo/db/queries';

let userId: number;
let teamId: number;

beforeAll(async () => {
  const [team] = await db
    .insert(teams)
    .values({
      name: 'getTeamCore Fixture Team',
      stripeSubscriptionId: 'sub_test_123',
      stripeProductId: 'prod_test_456',
      currentMessages: 2,
    })
    .returning();
  teamId = team.id;

  const [user] = await db
    .insert(users)
    .values({ name: 'Fixture User', email: `get-team-core-${Date.now()}@example.com`, passwordHash: 'hash' })
    .returning();
  userId = user.id;

  await db.insert(teamMembers).values({ userId, teamId, role: 'owner' });
});

afterAll(async () => {
  await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(teams).where(eq(teams.id, teamId));
});

describe('getTeamCore', () => {
  it('returns the scalar team row for a user without the member roster', async () => {
    const team = await getTeamCore(userId);
    expect(team).not.toBeNull();
    expect(team!.id).toBe(teamId);
    expect(team!.stripeSubscriptionId).toBe('sub_test_123');
    expect(team!.stripeProductId).toBe('prod_test_456');
    expect(team!.currentMessages).toBe(2);
    expect(team).not.toHaveProperty('teamMembers');
  });

  it('returns null for a user with no team', async () => {
    const [orphanUser] = await db
      .insert(users)
      .values({ name: 'Orphan', email: `orphan-${Date.now()}@example.com`, passwordHash: 'hash' })
      .returning();

    const team = await getTeamCore(orphanUser.id);
    expect(team).toBeNull();

    await db.delete(users).where(eq(users.id, orphanUser.id));
  });
});
