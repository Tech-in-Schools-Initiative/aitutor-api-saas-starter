// app/api/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/session';
import { getTeamCore } from '@repo/db/queries';
import { checkMessageLimit, incrementMessageCount, saveWorkflowHistory } from '@repo/db/utils';

// Maps a workflowKey to the env var holding that workflow's AI Tutor API workflow_id.
const WORKFLOW_ENV_VAR_BY_KEY: Record<string, string> = {
  'story-generator': 'WORKFLOW_ID',
  'real-estate-analysis': 'WORKFLOW_ID_REAL_ESTATE_ANALYSIS',
  'google-ads-analysis': 'WORKFLOW_ID_GOOGLE_ADS_ANALYSIS',
  'resume-screening': 'WORKFLOW_ID_RESUME_SCREENING',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let workflowKey: string;
    let aiTutorRequestBody: Record<string, unknown>;
    let joinedInput: string;

    if (typeof body.workflowKey === 'string') {
      // New shape: { workflowKey, variables }
      const { variables } = body;
      if (!variables || typeof variables !== 'object') {
        return NextResponse.json(
          { error: 'Missing variables parameter' },
          { status: 400 }
        );
      }

      workflowKey = body.workflowKey;
      aiTutorRequestBody = { ...variables };
      joinedInput = Object.entries(variables as Record<string, string>)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n\n');
    } else {
      // Legacy shape: { story }
      const { story } = body;
      if (!story) {
        return NextResponse.json(
          { error: 'Missing story parameter' },
          { status: 400 }
        );
      }

      workflowKey = 'story-generator';
      aiTutorRequestBody = { story };
      joinedInput = story;
    }

    const workflowEnvVar = WORKFLOW_ENV_VAR_BY_KEY[workflowKey];
    if (!workflowEnvVar) {
      return NextResponse.json(
        { error: `Unknown workflowKey: ${workflowKey}` },
        { status: 400 }
      );
    }

    // Get the authenticated user.
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get the team details for the user.
    const team = await getTeamCore(user.id);
    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    // Check the team's monthly message limit.
    const { withinLimit, remainingMessages } = await checkMessageLimit(team);
    if (!withinLimit) {
      return NextResponse.json(
        {
          error:
            'Monthly message limit reached. Upgrade your plan for unlimited messages.',
        },
        { status: 403 }
      );
    }

    // Validate required environment variables.
    const workflowId = process.env[workflowEnvVar];
    if (!workflowId || !process.env.AITUTOR_API_KEY) {
      return NextResponse.json(
        { error: `Missing environment variables: ${workflowEnvVar} or AITUTOR_API_KEY` },
        { status: 500 }
      );
    }

    // Call the external AI Tutor API's run endpoint.
    const response = await fetch(
      `https://aitutor-api.vercel.app/api/v1/run/${workflowId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.AITUTOR_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(aiTutorRequestBody),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Error generating story' },
        { status: response.status }
      );
    }

    // MOVED: Increment the team's message count AFTER successful API call
    await incrementMessageCount(team.id, 1);

    // Save workflow history
    await saveWorkflowHistory(
      team.id,
      user.id,
      joinedInput,
      data.result || JSON.stringify(data),
      workflowKey
    );

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
