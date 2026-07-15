import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { teams } from '@/lib/db/schema';
import { checkMessageLimit, incrementMessageCount } from '@/lib/db/utils';

let teamId: number;

beforeAll(async () => {
  const [team] = await db
    .insert(teams)
    .values({
      name: 'Vitest Fixture Team',
      messageLimit: 5,
      currentMessages: 0,
    })
    .returning();
  teamId = team.id;
});

afterAll(async () => {
  if (teamId) {
    await db.delete(teams).where(eq(teams.id, teamId));
  }
});

describe('checkMessageLimit / incrementMessageCount', () => {
  it('reports the free-tier limit (5) as remaining when no messages sent', async () => {
    const { withinLimit, remainingMessages } = await checkMessageLimit(teamId);
    expect(withinLimit).toBe(true);
    expect(remainingMessages).toBe(5);
  });

  it('decrements remaining messages after incrementMessageCount', async () => {
    await incrementMessageCount(teamId, 3);
    const { withinLimit, remainingMessages } = await checkMessageLimit(teamId);
    expect(withinLimit).toBe(true);
    expect(remainingMessages).toBe(2);
  });

  it('flips withinLimit to false once the free-tier limit is exhausted', async () => {
    await incrementMessageCount(teamId, 2);
    const { withinLimit, remainingMessages } = await checkMessageLimit(teamId);
    expect(withinLimit).toBe(false);
    expect(remainingMessages).toBe(0);
  });

  it('throws for a team id that does not exist', async () => {
    await expect(checkMessageLimit(-1)).rejects.toThrow('Team not found');
  });
});
