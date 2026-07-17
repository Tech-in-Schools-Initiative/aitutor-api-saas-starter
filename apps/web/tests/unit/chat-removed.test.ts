import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';

describe('dead streaming chat feature', () => {
  it('has been removed from app/(dashboard)/dashboard/streaming (chat feature removed, product is workflow-only)', () => {
    const streamingPagePath = path.join(
      process.cwd(),
      'app',
      '(dashboard)',
      'dashboard',
      'streaming',
      'page.tsx'
    );
    expect(existsSync(streamingPagePath)).toBe(false);
  });

  it('has been removed: components/ai-tutor-api/StreamingChat.tsx', () => {
    const streamingChatPath = path.join(
      process.cwd(),
      'components',
      'ai-tutor-api',
      'StreamingChat.tsx'
    );
    expect(existsSync(streamingChatPath)).toBe(false);
  });

  it('has been removed: app/api/chat/route.ts', () => {
    const chatRoutePath = path.join(process.cwd(), 'app', 'api', 'chat', 'route.ts');
    expect(existsSync(chatRoutePath)).toBe(false);
  });
});
