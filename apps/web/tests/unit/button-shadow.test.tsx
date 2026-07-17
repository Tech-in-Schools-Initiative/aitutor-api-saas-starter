// apps/web/tests/unit/button-shadow.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@repo/ui/components/button';

describe('Button variant shadow depth', () => {
  it('restores shadow-xs on the default variant', () => {
    render(<Button>Default</Button>);
    expect(screen.getByRole('button', { name: 'Default' }).className).toContain('shadow-xs');
  });

  it('restores shadow-xs on the secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button', { name: 'Secondary' }).className).toContain('shadow-xs');
  });

  it('restores shadow-xs on the destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('shadow-xs');
  });
});
