import { describe, it, expect } from 'vitest';
import { PACKAGE_NAME } from '@repo/email';

describe('@repo/email scaffold', () => {
  it('resolves and exports its placeholder', () => {
    expect(PACKAGE_NAME).toBe('@repo/email');
  });
});
