// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RadioGroup, RadioGroupItem } from '@repo/ui/components/radio-group';

describe('RadioGroupItem unchecked border color', () => {
  it('restores border-primary so the invite-team role picker keeps its original look (live call site, not dead code)', () => {
    const { container } = render(
      <RadioGroup defaultValue="member">
        <RadioGroupItem value="member" />
      </RadioGroup>
    );
    const item = container.querySelector('[data-slot="radio-group-item"]') as HTMLElement;
    expect(item.className).toContain('border-primary');
  });
});
