// packages/email/tests/unit/password-reset-email.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@react-email/render';
import { PasswordResetEmail } from '../../src/templates/PasswordResetEmail';

describe('PasswordResetEmail', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, BASE_URL: 'https://example.com' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('includes the reset URL and expiry minutes in the rendered HTML', async () => {
    const html = await render(
      <PasswordResetEmail
        name="Ada"
        resetUrl="https://app.example.com/reset-password?token=abc123"
        expiresInMinutes={30}
      />,
    );
    expect(html).toContain(
      'https://app.example.com/reset-password?token=abc123',
    );
    expect(html).toContain('30 minutes');
    expect(html).toContain('Ada');
  });

  it('falls back to a generic greeting when no name is given', async () => {
    const html = await render(
      <PasswordResetEmail
        resetUrl="https://app.example.com/reset-password?token=abc123"
        expiresInMinutes={30}
      />,
    );
    expect(html).toContain('Hi there,');
  });

  it('matches the known-good markup snapshot', async () => {
    const html = await render(
      <PasswordResetEmail
        name="Ada"
        resetUrl="https://app.example.com/reset-password?token=abc123"
        expiresInMinutes={30}
      />,
    );
    expect(html).toMatchSnapshot();
  });
});
