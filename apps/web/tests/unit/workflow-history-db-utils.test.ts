import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import { teams, users, workflowHistory } from '@repo/db/schema';
import { saveWorkflowHistory, getWorkflowHistory } from '@repo/db/utils';

let userId: number;
let teamId: number;

beforeAll(async () => {
  const [team] = await db
    .insert(teams)
    .values({ name: 'workflowKey Fixture Team' })
    .returning();
  teamId = team.id;

  const [user] = await db
    .insert(users)
    .values({
      name: 'Fixture User',
      email: `workflow-history-db-utils-${Date.now()}@example.com`,
      passwordHash: 'hash',
    })
    .returning();
  userId = user.id;
});

afterAll(async () => {
  await db.delete(workflowHistory).where(eq(workflowHistory.teamId, teamId));
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(teams).where(eq(teams.id, teamId));
});

describe('saveWorkflowHistory / getWorkflowHistory (workflowKey)', () => {
  it('stores the workflowKey passed to saveWorkflowHistory and returns it unfiltered from getWorkflowHistory', async () => {
    await saveWorkflowHistory(teamId, userId, 'property_details: a house', 'Buy.', 'real-estate-analysis');

    const [row] = await db
      .select()
      .from(workflowHistory)
      .where(eq(workflowHistory.teamId, teamId));

    expect(row.workflowKey).toBe('real-estate-analysis');
  });

  it('getWorkflowHistory only returns rows matching the given workflowKey', async () => {
    await saveWorkflowHistory(teamId, userId, 'campaign_data: some ads', 'Optimize.', 'google-ads-analysis');

    const realEstateHistory = await getWorkflowHistory(teamId, 'real-estate-analysis');
    const googleAdsHistory = await getWorkflowHistory(teamId, 'google-ads-analysis');

    expect(realEstateHistory).toHaveLength(1);
    expect(realEstateHistory[0].input).toBe('property_details: a house');

    expect(googleAdsHistory).toHaveLength(1);
    expect(googleAdsHistory[0].input).toBe('campaign_data: some ads');
  });

  it('respects the limit argument', async () => {
    for (let i = 0; i < 3; i++) {
      await saveWorkflowHistory(teamId, userId, `resume ${i}`, `output ${i}`, 'resume-screening');
    }

    const limited = await getWorkflowHistory(teamId, 'resume-screening', 2);
    expect(limited).toHaveLength(2);
  });
});
