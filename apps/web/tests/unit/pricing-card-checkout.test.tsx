// apps/web/tests/unit/pricing-card-checkout.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PricingCard } from '@/app/(front)/pricing/pricing-card';

const baseTier = {
  name: 'Starter',
  icon: <span />,
  price: 10,
  description: 'For small teams',
  features: ['100 messages per month'],
  color: 'amber',
  messageLimit: 100,
};

describe('PricingCard checkout CTA', () => {
  it('disables the CTA instead of submitting an empty priceId when none is configured', () => {
    render(<PricingCard tier={{ ...baseTier, priceId: null }} />);
    const button = screen.getByRole('button', { name: 'Coming Soon' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(document.querySelector('input[name="priceId"]')).toBeNull();
  });

  it('renders a working checkout form with the hidden priceId input when one is configured', () => {
    render(<PricingCard tier={{ ...baseTier, priceId: 'price_123' }} />);
    const hiddenInput = document.querySelector('input[name="priceId"]') as HTMLInputElement;
    expect(hiddenInput).toBeTruthy();
    expect(hiddenInput.value).toBe('price_123');
    const button = screen.getByRole('button', { name: 'Get Started' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});
