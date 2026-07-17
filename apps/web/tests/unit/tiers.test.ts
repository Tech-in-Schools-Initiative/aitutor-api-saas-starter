// apps/web/tests/unit/tiers.test.ts
import { describe, it, expect } from 'vitest';
import { tiers } from '@repo/db/tiers';

describe('tiers priceId placeholder', () => {
  it('uses null (not an empty string) for unset Stripe price IDs', () => {
    for (const tier of tiers) {
      expect(tier.priceId).not.toBe('');
      if (tier.priceId !== null) {
        expect(typeof tier.priceId).toBe('string');
      }
    }
  });

  it('has no configured priceId yet for any paid tier (documented placeholder, pending real Stripe IDs)', () => {
    const paidTiers = tiers.filter((t) => t.priceMonthly !== null);
    expect(paidTiers.every((t) => t.priceId === null)).toBe(true);
  });
});
