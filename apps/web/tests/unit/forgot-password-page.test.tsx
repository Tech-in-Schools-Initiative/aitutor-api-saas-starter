// @vitest-environment jsdom
//
// vitest.config.ts's global environment is 'node' (jose throws under jsdom's
// cross-realm Uint8Array handling). This overrides the environment for just
// this file via the pragma above, matching tests/unit/button.test.tsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const requestPasswordResetMock = vi.fn();
vi.mock('@/app/(login)/actions', () => ({
  requestPasswordReset: (...args: unknown[]) =>
    requestPasswordResetMock(...args),
}));

import ForgotPasswordPage from '@/app/(login)/forgot-password/page';

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    requestPasswordResetMock.mockReset();
  });

  it('renders an email field and a submit button', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Send reset link' }),
    ).toBeTruthy();
  });

  it('shows the generic success message returned by the action after submit', async () => {
    requestPasswordResetMock.mockResolvedValue({
      success:
        'If an account exists for that email, a password reset link has been sent.',
    });

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => {
      expect(
        screen.getByText(/if an account exists for that email/i),
      ).toBeTruthy();
    });
  });

  it('shows an error and keeps the form visible when the action returns one', async () => {
    requestPasswordResetMock.mockResolvedValue({ error: 'Invalid email' });

    render(<ForgotPasswordPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email')).toBeTruthy();
    });
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });
});
