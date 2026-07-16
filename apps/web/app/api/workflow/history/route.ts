// app/api/workflow/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { getWorkflowHistory } from '@/lib/db/utils';

export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const team = await getTeamForUser(user.id);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10');
    const history = await getWorkflowHistory(team.id, limit);

    return NextResponse.json(history);
  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
