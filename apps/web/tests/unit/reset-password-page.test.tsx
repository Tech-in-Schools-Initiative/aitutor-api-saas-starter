// apps/web/tests/unit/reset-password-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const resetPasswordMock = vi.fn();
vi.mock('@/app/(login)/actions', () => ({
  resetPassword: (...args: unknown[]) => resetPasswordMock(...args),
}));

const searchParamsGetMock = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: searchParamsGetMock }),
}));

import { ResetPasswordForm } from '@/app/(login)/reset-password/reset-password-form';

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    resetPasswordMock.mockReset();
    searchParamsGetMock.mockReset();
  });

  it('shows a missing-link message and no form when ?token= is absent', () => {
    searchParamsGetMock.mockReturnValue(null);
    render(<ResetPasswordForm />);
    expect(screen.getByText(/missing or invalid/i)).toBeTruthy();
    expect(screen.queryByLabelText('New password')).toBeNull();
  });

  it('renders the new-password form with the token in a hidden field when present', () => {
    searchParamsGetMock.mockImplementation((key: string) =>
      key === 'token' ? 'a-real-token' : null,
    );
    const { container } = render(<ResetPasswordForm />);
    expect(screen.getByLabelText('New password')).toBeTruthy();
    expect(screen.getByLabelText('Confirm new password')).toBeTruthy();
    const hiddenInput = container.querySelector(
      'input[name="token"]',
    ) as HTMLInputElement;
    expect(hiddenInput.value).toBe('a-real-token');
  });

  it('surfaces an error returned by the action (e.g. an invalid/expired token)', async () => {
    searchParamsGetMock.mockImplementation((key: string) =>
      key === 'token' ? 'expired-token' : null,
    );
    resetPasswordMock.mockResolvedValue({
      error: 'This reset link is invalid or has expired.',
    });

    render(<ResetPasswordForm />);
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'a-new-password' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'a-new-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() => {
      expect(
        screen.getByText('This reset link is invalid or has expired.'),
      ).toBeTruthy();
    });
  });
});
