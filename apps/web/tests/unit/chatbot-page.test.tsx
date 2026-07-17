// apps/web/tests/unit/chatbot-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import Chatbot from '@/app/(dashboard)/dashboard/chatbot/page';

describe('Chatbot dashboard page', () => {
  it('renders the shared Card primitive instead of a hand-rolled glass-morphism panel', () => {
    const { container } = render(<Chatbot />);
    expect(container.querySelector('[data-slot="card"]')).toBeTruthy();
    expect(container.querySelector('.glass-morphism')).toBeNull();
  });

  it('uses the consistent dashboard header pattern instead of the mismatched hero heading', () => {
    render(<Chatbot />);
    expect(screen.getByRole('heading', { name: 'Chatbot', level: 1 })).toBeTruthy();
  });

  it('still embeds the AI Story Generator iframe', () => {
    const { container } = render(<Chatbot />);
    const iframe = container.querySelector('iframe');
    expect(iframe?.getAttribute('src')).toContain('aitutor-api.vercel.app/embed/chatbot');
  });

  it('no longer imports the unused next/link module', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'app/(dashboard)/dashboard/chatbot/page.tsx'),
      'utf-8'
    );
    expect(source).not.toMatch(/from ['"]next\/link['"]/);
  });
});
