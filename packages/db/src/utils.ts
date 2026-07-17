import { db } from './client';
import { teams, Team } from './schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { tiers, Tier } from './tiers';
import { workflowHistory, NewWorkflowHistory } from './schema';

// This function checks the monthly message limit for a team.
// If the team has an active subscription (stripeSubscriptionId exists) and its stripeProductId
// matches a tier’s productId, that tier's messageLimit is used; otherwise, the free plan
// limit of 5 messages is enforced.
//
// Takes an already-fetched Team row rather than a teamId, so callers that already have the
// team (e.g. via getTeamCore) don't pay for a second, redundant fetch here.
export async function checkMessageLimit(
  team: Team
): Promise<{ withinLimit: boolean; remainingMessages: number }> {
  let messageLimit: number;

  if (team.stripeSubscriptionId && team.stripeProductId) {
    // Look for a matching tier based on the stored stripeProductId.
    const matchedTier: Tier | undefined = tiers.find(
      (t) => t.productId === team.stripeProductId
    );
    if (matchedTier) {
      messageLimit = matchedTier.messageLimit;
    } else {
      // If no matching tier found, default to free.
      messageLimit = 5;
    }
  } else {
    // No active subscription—apply free plan limit.
    messageLimit = 5;
  }

  const currentMessages = team.currentMessages ?? 0;
  const remainingMessages = messageLimit - currentMessages;
  const withinLimit = remainingMessages > 0;

  return { withinLimit, remainingMessages };
}

// Function to increment a team's message count.
export async function incrementMessageCount(teamId: number, count: number = 1): Promise<void> {
  await db.update(teams)
    .set({
      currentMessages: sql`${teams.currentMessages} + ${count}`,
      updatedAt: new Date()
    })
    .where(eq(teams.id, teamId));
}

export async function saveWorkflowHistory(
  teamId: number,
  userId: number,
  input: string,
  output: string,
  workflowKey: string
): Promise<void> {
  const newHistory: NewWorkflowHistory = {
    teamId,
    userId,
    input,
    output,
    workflowKey,
    createdAt: new Date(),
  };

  await db.insert(workflowHistory).values(newHistory);
}

// Function to get workflow history for a team, scoped to a single workflow.
export async function getWorkflowHistory(
  teamId: number,
  workflowKey: string,
  limit: number = 10
) {
  return db.select({
    id: workflowHistory.id,
    input: workflowHistory.input,
    output: workflowHistory.output,
    createdAt: workflowHistory.createdAt,
    userId: workflowHistory.userId,
  })
  .from(workflowHistory)
  .where(and(eq(workflowHistory.teamId, teamId), eq(workflowHistory.workflowKey, workflowKey)))
  .orderBy(desc(workflowHistory.createdAt))
  .limit(limit);
}
