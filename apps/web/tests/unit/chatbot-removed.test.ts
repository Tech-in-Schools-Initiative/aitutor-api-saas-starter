import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';

describe('dead chatbot page', () => {
  it('has been removed from app/(dashboard)/dashboard/chatbot (chat feature removed, product is workflow-only)', () => {
    const chatbotPagePath = path.join(
      process.cwd(),
      'app',
      '(dashboard)',
      'dashboard',
      'chatbot',
      'page.tsx'
    );
    expect(existsSync(chatbotPagePath)).toBe(false);
  });
});
