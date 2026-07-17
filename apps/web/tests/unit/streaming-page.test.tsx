// apps/web/tests/unit/streaming-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import Streaming from '@/app/(dashboard)/dashboard/streaming/page';

describe('Streaming dashboard page', () => {
  it('renders the shared Card primitive instead of a glass-morphism panel', () => {
    const { container } = render(<Streaming />);
    expect(container.querySelector('[data-slot="card"]')).toBeTruthy();
    expect(container.querySelector('.glass-morphism')).toBeNull();
  });

  it('uses the consistent dashboard header pattern', () => {
    render(<Streaming />);
    expect(screen.getByRole('heading', { name: 'Streaming', level: 1 })).toBeTruthy();
  });

  it('no longer imports the unused next/link module', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'app/(dashboard)/dashboard/streaming/page.tsx'),
      'utf-8'
    );
    expect(source).not.toMatch(/from ['"]next\/link['"]/);
  });
});
