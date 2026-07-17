// apps/web/tests/unit/sheet-title-size.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@repo/ui/components/sheet';

describe('SheetTitle default size', () => {
  it('keeps the text-lg class the current shadcn registry default dropped', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Workflow History</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
    const title = screen.getByText('Workflow History');
    expect(title.className).toContain('text-lg');
  });
});
