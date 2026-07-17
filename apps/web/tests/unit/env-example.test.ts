import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('.env.example password-reset email vars', () => {
  const contents = readFileSync(
    path.resolve(__dirname, '../../.env.example'),
    'utf-8',
  );

  it('documents RESEND_API_KEY', () => {
    expect(contents).toMatch(/^RESEND_API_KEY=/m);
  });

  it('documents RESEND_FROM_EMAIL', () => {
    expect(contents).toMatch(/^RESEND_FROM_EMAIL=/m);
  });
});
