import { describe, it, expect, vi, beforeEach } from 'vitest';

const requestPasswordResetMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth/password-reset', () => ({
  requestPasswordReset: requestPasswordResetMock,
}));

import { POST } from '@/app/api/password-reset/request/route';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/password-reset/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/password-reset/request', () => {
  beforeEach(() => {
    requestPasswordResetMock.mockReset();
  });

  it('rejects an invalid email with a 400 and a validation message', async () => {
    const response = await POST(makeRequest({ email: 'not-an-email' }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(typeof json.error).toBe('string');
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it('returns the generic 200 message for a known account', async () => {
    requestPasswordResetMock.mockResolvedValue({ success: true });
    const response = await POST(makeRequest({ email: 'known@example.com' }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.message).toMatch(/if an account exists/i);
    expect(requestPasswordResetMock).toHaveBeenCalledWith('known@example.com');
  });

  it('returns the identical 200 generic message for an unknown account', async () => {
    requestPasswordResetMock.mockResolvedValue({ success: true });
    const response = await POST(makeRequest({ email: 'unknown@example.com' }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.message).toMatch(/if an account exists/i);
  });

  it('still returns the generic 200 message when the underlying call throws', async () => {
    requestPasswordResetMock.mockRejectedValue(new Error('db unreachable'));
    const response = await POST(makeRequest({ email: 'known@example.com' }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.message).toMatch(/if an account exists/i);
  });
});
