// src/app/api/token/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const response = await fetch('https://aitutor-api.vercel.app/api/v1/chat/token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AITUTOR_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatbotId: process.env.CHATBOT_ID,
        sessionId: "user_session_" + Date.now() // Simple session ID
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Token Generation Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}