// apps/web/tests/unit/shuffle-cards.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ShuffleCards } from '@/components/landing-page/timeline/components/testimonial-cards';

describe('ShuffleCards', () => {
  it('does not apply a fixed negative offset at the base (mobile) breakpoint', () => {
    const { container } = render(<ShuffleCards />);
    const stack = container.querySelector('.relative') as HTMLElement;
    const classes = stack.className.split(' ');
    expect(classes).not.toContain('-ml-[100px]');
    expect(classes).toContain('sm:-ml-[100px]');
  });

  it('uses a narrower card width at the base breakpoint than the desktop 350px', () => {
    const { container } = render(<ShuffleCards />);
    const stack = container.querySelector('.relative') as HTMLElement;
    const classes = stack.className.split(' ');
    expect(classes).not.toContain('w-[350px]');
    expect(classes).toContain('sm:w-[350px]');
  });
});
