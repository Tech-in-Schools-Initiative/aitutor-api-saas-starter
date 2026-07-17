// @vitest-environment jsdom
//
// jsdom has no ResizeObserver, but Radix Tooltip's Arrow (via
// @radix-ui/react-use-size) requires one to mount. This is the first test in
// the suite to render a Radix primitive with an Arrow, so the gap hasn't
// surfaced before now. Polyfilled locally here rather than in the shared
// tests/setup.ts to avoid touching a file other concurrent tasks rely on.
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@repo/ui/components/tooltip';

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe('TooltipContent brand colors', () => {
  it('restores the brand-colored background instead of the neutral shadcn-registry default', () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    // Radix renders "Hint" twice: once in the visible content node, and once
    // in a visually-hidden accessible duplicate (role="tooltip"). Scope the
    // query to the actual content element so getByText doesn't throw on
    // multiple matches.
    const content = screen.getByText('Hint', { selector: '[data-slot="tooltip-content"]' });
    expect(content.className).toContain('bg-primary');
    expect(content.className).toContain('text-primary-foreground');
  });
});
