// apps/web/tests/unit/login-forgot-password-link.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/app/(login)/actions', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

const searchParamsGetMock = vi.fn().mockReturnValue(null);
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: searchParamsGetMock }),
}));

import { Login } from '@/app/(login)/login';

describe('Login forgot-password link', () => {
  it('shows a "Forgot your password?" link to /forgot-password in sign-in mode', () => {
    render(<Login mode="signin" />);
    const link = screen.getByRole('link', { name: 'Forgot your password?' });
    expect(link.getAttribute('href')).toBe('/forgot-password');
  });

  it('does not show the forgot-password link in sign-up mode', () => {
    render(<Login mode="signup" />);
    expect(
      screen.queryByRole('link', { name: 'Forgot your password?' }),
    ).toBeNull();
  });
});
