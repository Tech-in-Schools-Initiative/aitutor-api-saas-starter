// lib/db/utils.ts
import { db } from './drizzle';
import { teams, Team } from './schema';
import { eq, sql, desc } from 'drizzle-orm';
import { tiers, Tier } from '../tiers';
import { workflowHistory, NewWorkflowHistory } from './schema';

// This function checks the monthly message limit for a team.
// If the team has an active subscription (stripeSubscriptionId exists) and its stripeProductId
// matches a tier’s productId, that tier's messageLimit is used; otherwise, the free plan
// limit of 5 messages is enforced.
export async function checkMessageLimit(
  teamId: number
): Promise<{ withinLimit: boolean; remainingMessages: number }> {
  const teamResult = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);

  if (teamResult.length === 0) {
    throw new Error("Team not found");
  }

  const currentTeam: Team = teamResult[0];
  let messageLimit: number;

  if (currentTeam.stripeSubscriptionId && currentTeam.stripeProductId) {
    // Look for a matching tier based on the stored stripeProductId.
    const matchedTier: Tier | undefined = tiers.find(
      (t) => t.productId === currentTeam.stripeProductId
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

  const currentMessages = currentTeam.currentMessages ?? 0;
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
  output: string
): Promise<void> {
  const newHistory: NewWorkflowHistory = {
    teamId,
    userId,
    input,
    output,
    createdAt: new Date(),
  };
  
  await db.insert(workflowHistory).values(newHistory);
}

// Function to get workflow history for a team
export async function getWorkflowHistory(
  teamId: number,
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
  .where(eq(workflowHistory.teamId, teamId))
  .orderBy(desc(workflowHistory.createdAt))
  .limit(limit);
}
