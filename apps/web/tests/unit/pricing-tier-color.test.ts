import { describe, it, expect } from 'vitest';
import { getTierIconColorClass } from '@/app/(front)/pricing/page';

describe('getTierIconColorClass', () => {
  it('maps "blue" to a static, Tailwind-scanner-visible class', () => {
    expect(getTierIconColorClass('blue')).toBe('text-blue-500');
  });

  it('maps "amber" to a static class', () => {
    expect(getTierIconColorClass('amber')).toBe('text-amber-500');
  });

  it('falls back to text-blue-500 for an unrecognized color key', () => {
    expect(getTierIconColorClass('mystery')).toBe('text-blue-500');
  });
});
