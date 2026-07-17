// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from '@repo/ui/components/skeleton';

describe('Skeleton background color', () => {
  it('restores the brand-tinted bg-primary/10 instead of the neutral bg-accent default', () => {
    const { container } = render(<Skeleton />);
    const el = container.querySelector('[data-slot="skeleton"]') as HTMLElement;
    expect(el.className).toContain('bg-primary/10');
  });
});
