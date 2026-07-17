// apps/web/tests/unit/dropdown-menu-separator-color.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';

describe('DropdownMenuSeparator color', () => {
  it('restores bg-muted so the nav-user menu divider keeps its original look (live call site, not dead code)', () => {
    const { baseElement } = render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Item 2</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    const separator = baseElement.querySelector('[data-slot="dropdown-menu-separator"]') as HTMLElement;
    expect(separator).toBeTruthy();
    expect(separator.className).toContain('bg-muted');
  });
});
