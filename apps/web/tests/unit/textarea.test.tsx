// @vitest-environment jsdom
//
// vitest.config.ts's global environment is 'node' (jose throws under jsdom's
// cross-realm Uint8Array handling). This overrides the environment for just
// this file via the pragma above, rather than flipping the global default.
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from '@repo/ui/components/textarea';

describe('Textarea', () => {
  it('renders without throwing and exposes an accessible textbox role', () => {
    render(<Textarea aria-label="Property details" />);
    expect(screen.getByRole('textbox', { name: 'Property details' })).toBeTruthy();
  });

  it('marks itself as the shadcn textarea primitive via data-slot', () => {
    render(<Textarea aria-label="Notes" />);
    const textarea = screen.getByRole('textbox', { name: 'Notes' });
    expect(textarea.getAttribute('data-slot')).toBe('textarea');
  });

  it('forwards a controlled value and fires onChange as the user types', () => {
    const handleChange = vi.fn();

    function Controlled() {
      const [value, setValue] = useState('');
      return (
        <Textarea
          aria-label="Description"
          value={value}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
            handleChange(e.target.value);
            setValue(e.target.value);
          }}
        />
      );
    }

    render(<Controlled />);
    const textarea = screen.getByRole('textbox', { name: 'Description' }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hello' } });

    expect(handleChange).toHaveBeenCalledWith('hello');
    expect(textarea.value).toBe('hello');
  });

  it('applies a custom className alongside the base styles', () => {
    render(<Textarea aria-label="Custom" className="my-custom-class" />);
    const textarea = screen.getByRole('textbox', { name: 'Custom' });
    expect(textarea.className).toContain('my-custom-class');
  });
});
