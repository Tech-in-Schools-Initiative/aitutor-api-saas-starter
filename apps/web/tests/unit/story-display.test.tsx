// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import StoryDisplay from '@/components/ai-tutor-api/StoryDisplay';

describe('StoryDisplay', () => {
  it('renders the shared Card primitive instead of a glass-morphism panel', async () => {
    const { container } = render(<StoryDisplay result={{ result: '# Hello\n\nA story.' }} />);
    await waitFor(() => {
      expect(container.querySelector('[data-slot="card"]')).toBeTruthy();
    });
    expect(container.querySelector('.glass-morphism')).toBeNull();
  });

  it('drops the no-op prose classes', () => {
    const { container } = render(<StoryDisplay result={{ result: 'A story.' }} />);
    const content = container.querySelector('.story-content');
    expect(content?.className).not.toMatch(/\bprose\b/);
  });
});
