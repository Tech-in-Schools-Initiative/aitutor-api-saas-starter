// apps/web/tests/unit/display-card.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DisplayCard } from '@/components/landing-page/timeline/components/display-cards';

describe('DisplayCard', () => {
  it('caps its width responsively instead of a fixed w-[42rem]', () => {
    const { container } = render(<DisplayCard />);
    const card = container.firstChild as HTMLElement;
    const classes = card.className.split(' ');
    expect(classes).not.toContain('w-[42rem]');
    expect(classes).toContain('max-w-[42rem]');
  });
});
