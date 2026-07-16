// app/api/team/limit/route.ts
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { checkMessageLimit } from '@/lib/db/utils';
import { NextResponse } from 'next/server';
import { tiers } from '@/lib/tiers';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }

  const team = await getTeamForUser(user.id);
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const { remainingMessages } = await checkMessageLimit(team.id);
  const unlimited = remainingMessages === Infinity;

  let subscriptionTier = "Free";
  if (team.stripeSubscriptionId && team.stripeProductId) {
    const matchedTier = tiers.find(t => t.productId === team.stripeProductId);
    if (matchedTier) {
      subscriptionTier = matchedTier.name;
    }
  }

  return NextResponse.json({ unlimited, remainingMessages, subscriptionTier });
}
