// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StreamingChat from '@/components/ai-tutor-api/StreamingChat';

describe('StreamingChat', () => {
  it('renders the shared Input/Button primitives instead of raw elements', () => {
    const { container } = render(<StreamingChat />);
    expect(container.querySelector('[data-slot="input"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="button"]')).toBeTruthy();
  });

  it('labels the message input for screen readers', () => {
    render(<StreamingChat />);
    expect(screen.getByLabelText('Chat message')).toBeTruthy();
  });

  it('shows an empty state before any message has been sent', () => {
    render(<StreamingChat />);
    expect(screen.getByText('No messages yet')).toBeTruthy();
  });
});
