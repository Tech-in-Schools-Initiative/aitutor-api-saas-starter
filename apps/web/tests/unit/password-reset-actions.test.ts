import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@repo/email/send', () => ({ sendTeamInvitationEmail: vi.fn() }));
vi.mock('@repo/db/client', () => ({ db: {} }));
vi.mock('@repo/db/queries', () => ({
  getUser: vi.fn(),
  getUserWithTeam: vi.fn(),
}));

const requestPasswordResetMock = vi.hoisted(() => vi.fn());
const confirmPasswordResetMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth/password-reset', () => ({
  requestPasswordReset: requestPasswordResetMock,
  confirmPasswordReset: confirmPasswordResetMock,
}));

import { redirect } from 'next/navigation';
import {
  requestPasswordReset as requestPasswordResetAction,
  resetPassword,
} from '@/app/(login)/actions';

describe('requestPasswordReset server action', () => {
  beforeEach(() => {
    requestPasswordResetMock.mockReset();
  });

  it('rejects an invalid email before calling the underlying reset logic', async () => {
    const formData = new FormData();
    formData.set('email', 'not-an-email');

    const result = await requestPasswordResetAction({ error: '' }, formData);

    expect(result).toHaveProperty('error');
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it('returns an identical generic success message whether or not the account exists', async () => {
    requestPasswordResetMock.mockResolvedValue({ success: true });
    const formData = new FormData();
    formData.set('email', 'known@example.com');

    const result = await requestPasswordResetAction({ error: '' }, formData);

    expect(result).toEqual({
      success:
        'If an account exists for that email, a password reset link has been sent.',
    });
    expect(requestPasswordResetMock).toHaveBeenCalledWith('known@example.com');
  });

  it('still returns the generic success message when the underlying call throws', async () => {
    requestPasswordResetMock.mockRejectedValue(new Error('db unreachable'));
    const formData = new FormData();
    formData.set('email', 'known@example.com');

    const result = await requestPasswordResetAction({ error: '' }, formData);

    expect(result).toEqual({
      success:
        'If an account exists for that email, a password reset link has been sent.',
    });
  });
});

describe('resetPassword server action', () => {
  beforeEach(() => {
    confirmPasswordResetMock.mockReset();
    (redirect as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it('rejects mismatched passwords before calling the underlying reset logic', async () => {
    const formData = new FormData();
    formData.set('token', 'a-token');
    formData.set('password', 'a-long-enough-password');
    formData.set('confirmPassword', 'does-not-match');

    const result = await resetPassword({ error: '' }, formData);

    expect(result).toHaveProperty('error', "Passwords don't match");
    expect(confirmPasswordResetMock).not.toHaveBeenCalled();
  });

  it('redirects to /dashboard on a successful reset', async () => {
    confirmPasswordResetMock.mockResolvedValue({ success: true });
    const formData = new FormData();
    formData.set('token', 'a-token');
    formData.set('password', 'a-long-enough-password');
    formData.set('confirmPassword', 'a-long-enough-password');

    await resetPassword({ error: '' }, formData);

    expect(confirmPasswordResetMock).toHaveBeenCalledWith(
      'a-token',
      'a-long-enough-password',
    );
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('returns the resolved error message when confirmPasswordReset resolves with an error (e.g. an expired token), without redirecting', async () => {
    confirmPasswordResetMock.mockResolvedValue({
      error: 'This reset link is invalid or has expired.',
    });
    const formData = new FormData();
    formData.set('token', 'expired-token');
    formData.set('password', 'a-long-enough-password');
    formData.set('confirmPassword', 'a-long-enough-password');

    const result = await resetPassword({ error: '' }, formData);

    expect(result).toEqual({
      error: 'This reset link is invalid or has expired.',
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
