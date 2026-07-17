// dashboard-pricing-page-tsx
import { MoveRight, PhoneCall } from 'lucide-react';
import { tiers, Tier } from '@repo/db/tiers'; // Import tiers
import { SubmitButton } from './submit-button';
import { cn } from "@repo/ui/lib/utils";
import { Sparkles, Star, Pencil } from "lucide-react";
import { PricingCard, type PricingTier } from './pricing-card';

// Prices are fresh for one hour max
export const revalidate = 3600;

export default async function PricingPage() {
     const pricingTiers: PricingTier[] = tiers.map((tier) => ({
        name: tier.name,
        icon: tier.id === 'free' ? <Pencil className="w-6 h-6" /> : (tier.id === 'starter' ? <Star className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />), // Replace with your desired icons
        price: tier.priceMonthly,
        description: tier.description,
        features: tier.features,
        popular: tier.id === 'starter', // Example: Make "Starter" popular
        color: tier.id === 'free' ? 'blue' : (tier.id === 'starter' ? 'amber' : 'blue'), // Example colors
        priceId: tier.priceId,
        messageLimit: tier.messageLimit
    }));

  return (
    <div className={cn("w-full py-12")}>
      <div className="container mx-auto max-w-7xl">
        <div className="flex text-center justify-center items-center gap-4 flex-col">
          <div className="flex gap-2 flex-col">
            <h2 className="text-4xl md:text-6xl tracking-tighter max-w-3xl text-center font-regular font-handwritten rotate-[-1deg]">
              Customize your pricing

            </h2>
          </div>
          <div className="grid pt-20 text-left grid-cols-1 lg:grid-cols-3 w-full gap-8">
            {/* Free Tier First */}
            {pricingTiers.filter(tier => tier.price === null).map(tier => (
                <PricingCard
                    key={tier.name}
                    tier={tier}
                    isFreeTier
                />
            ))}

            {/* Paid Tiers */}
             {pricingTiers.filter(tier => tier.price !== null).map((tier, index) => (
              <PricingCard
                key={tier.name}
                tier={tier}
                index={index}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
