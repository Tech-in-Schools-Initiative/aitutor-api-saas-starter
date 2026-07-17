// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} alt={props.alt ?? ''} />,
}));

import { StackedCircularFooter } from '@/components/landing-page/footer/footer';

describe('StackedCircularFooter', () => {
  it('does not render the commented-out newsletter subscribe form', () => {
    render(<StackedCircularFooter />);
    expect(screen.queryByPlaceholderText('Enter your email')).toBeNull();
    expect(screen.queryByText('Subscribe')).toBeNull();
  });

  it('links Home to the actual homepage instead of a dead "#" href', () => {
    render(<StackedCircularFooter />);
    const homeLink = screen.getByRole('link', { name: 'Home' });
    expect(homeLink.getAttribute('href')).toBe('/');
  });
});
