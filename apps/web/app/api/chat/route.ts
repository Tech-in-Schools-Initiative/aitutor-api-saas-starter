// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

// NOTE: `ai` is intentionally frozen at 4.3.19 (not upgraded to v5-v7).
// The v5+ useChat/@ai-sdk/react data-stream protocol requires confirming
// this proxy's real upstream (https://aitutor-api.vercel.app/api/v1/chat/{token}/stream)
// emits a compatible format. That gate check could NOT be performed on
// 2026-07-15 because no real AITUTOR_API_KEY/WORKFLOW_ID/NEXT_PUBLIC_AITUTOR_TOKEN
// credentials were available in this environment -- this is an unverified
// unknown, not a confirmed incompatibility. See docs/superpowers/specs/2026-07-15-ai-sdk-v4-freeze.md.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;
    
    const token = process.env.NEXT_PUBLIC_AITUTOR_TOKEN;
    
    const response = await fetch(
      `https://aitutor-api.vercel.app/api/v1/chat/${token}/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AITUTOR_API_KEY}`,
        },
        body: JSON.stringify({ messages }),
      }
    );

    // Create a new TransformStream for streaming
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new TransformStream({
      async transform(chunk, controller) {
        const text = decoder.decode(chunk);
        controller.enqueue(encoder.encode(text));
      },
    });

    // Pipe the response to our stream
    response.body?.pipeTo(stream.writable);

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Streaming API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}