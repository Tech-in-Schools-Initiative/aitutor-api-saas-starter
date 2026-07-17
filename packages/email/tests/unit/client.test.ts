import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendMock = vi.fn();

vi.mock('resend', () => ({
  // NOTE: must be a regular `function`, not an arrow function — our
  // implementation calls `new Resend(apiKey)`, and arrow functions have no
  // [[Construct]] internal method, so `new` on an arrow-based mock throws
  // "is not a constructor" regardless of what src/client.ts does.
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: sendMock } };
  }),
}));

import { sendEmail, __resetClientForTests } from '../../src/client';
import { Resend } from 'resend';

describe('sendEmail', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    sendMock.mockReset();
    (Resend as unknown as ReturnType<typeof vi.fn>).mockClear();
    __resetClientForTests();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('throws at call time, not import time, when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.RESEND_FROM_EMAIL = 'noreply@example.com';

    await expect(
      sendEmail({ to: 'user@example.com', subject: 'Hi', react: null as any }),
    ).rejects.toThrow('RESEND_API_KEY');
  });

  it('throws when RESEND_FROM_EMAIL is missing', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    delete process.env.RESEND_FROM_EMAIL;

    await expect(
      sendEmail({ to: 'user@example.com', subject: 'Hi', react: null as any }),
    ).rejects.toThrow('RESEND_FROM_EMAIL');
  });

  it('constructs a single Resend client and reuses it across calls', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'noreply@example.com';
    sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null });

    await sendEmail({ to: 'a@example.com', subject: 'One', react: null as any });
    await sendEmail({ to: 'b@example.com', subject: 'Two', react: null as any });

    expect(Resend).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('returns the Resend message id on success', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'noreply@example.com';
    sendMock.mockResolvedValue({ data: { id: 'email_123' }, error: null });

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Welcome',
      react: null as any,
    });

    expect(result).toEqual({ id: 'email_123' });
  });

  it('throws a descriptive error when Resend reports an error', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'noreply@example.com';
    sendMock.mockResolvedValue({
      data: null,
      error: { message: 'Invalid `to` field' },
    });

    await expect(
      sendEmail({ to: 'bad', subject: 'Oops', react: null as any }),
    ).rejects.toThrow('Invalid `to` field');
  });
});
