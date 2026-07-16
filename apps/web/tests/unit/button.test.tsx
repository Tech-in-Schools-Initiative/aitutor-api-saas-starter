// @vitest-environment jsdom
//
// vitest.config.ts's global environment is 'node' (jose throws under jsdom's
// cross-realm Uint8Array handling). This is the first test that renders a DOM
// tree, so it overrides the environment for just this file via the pragma
// above, rather than flipping the global default back to jsdom.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@repo/ui/components/button';

describe('Button', () => {
  it('renders without throwing and exposes an accessible button role', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeTruthy();
  });

  it('marks itself as the shadcn button primitive via data-slot', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('data-slot')).toBe('button');
  });

  it('applies the default variant background class', () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole('button', { name: 'Default' });
    expect(button.className).toContain('bg-primary');
  });

  it('applies the destructive variant background class when requested', () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button.className).toContain('bg-destructive');
  });
});
