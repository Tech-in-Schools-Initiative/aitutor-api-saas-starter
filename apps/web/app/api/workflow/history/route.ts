// app/api/workflow/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithTeam } from '@repo/db/queries';
import { getUser } from '@/lib/auth/session';
import { getWorkflowHistory } from '@repo/db/utils';

export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam || !userWithTeam.teamId) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10');
    const history = await getWorkflowHistory(userWithTeam.teamId, limit);

    return NextResponse.json(history);
  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
