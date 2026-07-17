import { describe, it, expect, vi, beforeEach } from 'vitest';

const confirmPasswordResetMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth/password-reset', () => ({
  confirmPasswordReset: confirmPasswordResetMock,
}));

import { POST } from '@/app/api/password-reset/confirm/route';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/password-reset/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/password-reset/confirm', () => {
  beforeEach(() => {
    confirmPasswordResetMock.mockReset();
  });

  it('rejects a short password with a 400 and a validation message', async () => {
    const response = await POST(makeRequest({ token: 'abc', password: 'short' }));
    expect(response.status).toBe(400);
    expect(confirmPasswordResetMock).not.toHaveBeenCalled();
  });

  it('rejects a missing token with a 400', async () => {
    const response = await POST(
      makeRequest({ token: '', password: 'a-long-enough-password' }),
    );
    expect(response.status).toBe(400);
    expect(confirmPasswordResetMock).not.toHaveBeenCalled();
  });

  it('returns 200 on a valid token and password', async () => {
    confirmPasswordResetMock.mockResolvedValue({ success: true });
    const response = await POST(
      makeRequest({ token: 'valid-token', password: 'a-long-enough-password' }),
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.message).toMatch(/password has been reset/i);
    expect(confirmPasswordResetMock).toHaveBeenCalledWith(
      'valid-token',
      'a-long-enough-password',
    );
  });

  it('returns a 400 with the resolved error message when the token is invalid or expired', async () => {
    confirmPasswordResetMock.mockResolvedValue({
      error: 'This reset link is invalid or has expired.',
    });
    const response = await POST(
      makeRequest({ token: 'bad-token', password: 'a-long-enough-password' }),
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('This reset link is invalid or has expired.');
  });
});
