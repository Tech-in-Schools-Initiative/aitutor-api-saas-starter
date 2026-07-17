// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('canvas-confetti', () => {
  const confettiMock = vi.fn() as unknown as { create: () => () => void };
  (confettiMock as any).create = vi.fn(() => {
    // The instance returned by canvas-confetti's `create()` is itself callable
    // (used to fire confetti) AND exposes a `.reset()` method (called by the
    // Confetti component's cleanup effect on unmount). A bare `vi.fn()` here
    // is only callable, not `.reset()`-able, and crashes on unmount.
    const instance = vi.fn() as unknown as (() => void) & { reset: () => void };
    (instance as any).reset = vi.fn();
    return instance;
  });
  return { default: confettiMock };
});

import { Hero } from '@/components/landing-page/hero/hero';

describe('Hero', () => {
  it('does not use the invalid text-spektr-cyan-50 class', () => {
    const { container } = render(<Hero />);
    expect(container.querySelector('.text-spektr-cyan-50')).toBeNull();
  });

  it('renders the "SaaS Wrapper for Your" heading with a real text-color token', () => {
    render(<Hero />);
    const heading = screen.getByText('SaaS Wrapper for Your');
    expect(heading.className).toContain('text-foreground');
  });

  it('renders grammatically corrected hero copy', () => {
    render(<Hero />);
    expect(
      screen.getByText(
        'Get started quickly with an online subscription product that uses AI Tutor API for agentic capabilities, Postgres for database management, and Stripe for payment processing.'
      )
    ).toBeTruthy();
  });
});
