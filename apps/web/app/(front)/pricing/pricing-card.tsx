// apps/web/app/(front)/pricing/pricing-card.tsx
import { checkoutAction } from '@/lib/payments/actions';
import { Check } from 'lucide-react';
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { getTierIconColorClass } from '@/lib/pricing/tier-colors';

export interface PricingTier {
    name: string;
    icon: React.ReactNode;
    price: number | null;
    description: string;
    features: string[];
    popular?: boolean;
    color: string;
    priceId: string | null;
    messageLimit: number;
    isFreeTier?: boolean;
}

export function PricingCard({
  tier,
  isFreeTier = false,
  index = 0
}: {
  tier: PricingTier;
    isFreeTier?: boolean;
    index?: number;
}) {
    const {name, icon, price, description, features, popular, color, priceId, messageLimit} = tier;
  return (
    <div
        className={cn(
            "relative group",
            "transition-all duration-300",
            index === 0 && "rotate-[-1deg]",  // Rotate only paid tiers
            index === 1 && "rotate-[1deg]",
            index === 2 && "rotate-[-2deg]",
            "hover:shadow-lg hover:shadow-pink-500/50", // Add glow on hover
        )}
    >
        <div
            className={cn(
                "absolute inset-0 bg-white dark:bg-zinc-900",
                "border-2 border-zinc-900 dark:border-white",
                "rounded-lg shadow-[4px_4px_0px_0px] shadow-zinc-900 dark:shadow-white",
                "transition-all duration-300",
                "group-hover:shadow-[8px_8px_0px_0px]",
                "group-hover:translate-x-[-4px]",
                "group-hover:translate-y-[-4px]"
            )}
        />

        <div className="relative p-6">
            {popular && (
                <div
                className={cn(
                    "absolute -top-2 -right-2",
                    "font-handwritten px-3 py-1 rounded-full rotate-12 text-sm border-2 border-zinc-900",
                    "text-white", // Ensure text is white for better contrast
                    "bg-gradient-to-r from-pink-500 to-purple-500" // Gradient background
                )}
            >
                Popular!
            </div>
            )}

            <div className="mb-6">
                <div
                    className={cn(
                        "w-12 h-12 rounded-full mb-4",
                        "flex items-center justify-center",
                        "border-2 border-zinc-900 dark:border-white",
                        getTierIconColorClass(color)
                    )}
                >
                    {icon}
                </div>
                <h3 className="font-handwritten text-2xl text-zinc-900 dark:text-white">
                    {name}
                </h3>
                <p className="font-handwritten text-zinc-600 dark:text-zinc-400">
                     {messageLimit === -1 ? "Unlimited Messages" : `${messageLimit} messages per month`}
                </p>
            </div>

            {/* Price */}
            <div className="mb-6 font-handwritten">
                <span className="text-4xl font-bold text-zinc-900 dark:text-white">
                    ${price ?? 0}
                </span>
                {price !== null && price > 0 ? (
                    <span className="text-zinc-600 dark:text-zinc-400">
                        /month
                    </span>
                ) : null}

            </div>

            <div className="space-y-3 mb-6">
                {features.map((feature) => (
                    <div
                        key={feature}
                        className="flex items-center gap-3"
                    >
                        <div
                            className="w-5 h-5 rounded-full border-2 border-zinc-900
                            dark:border-white flex items-center justify-center"
                        >
                            <Check className="w-3 h-3" />
                        </div>
                        <span className="font-handwritten text-lg text-zinc-900 dark:text-white">
                            {feature}
                        </span>
                    </div>
                ))}
            </div>

            {!isFreeTier && (
                priceId ? (
                    <form action={checkoutAction}>
                        <input type="hidden" name="priceId" value={priceId} />
                        <Button
                            className={cn(
                                "w-full h-12 font-handwritten text-lg relative",
                                "border-2 border-zinc-900 dark:border-white",
                                "transition-all duration-300",
                                "shadow-[4px_4px_0px_0px] shadow-zinc-900 dark:shadow-white",
                                "hover:shadow-[6px_6px_0px_0px]",
                                "hover:translate-x-[-2px] hover:translate-y-[-2px]",
                                "bg-gradient-to-r from-pink-500 to-purple-500 text-white",
                                "hover:from-pink-400 hover:to-purple-400",
                                "active:from-pink-600 active:to-purple-600",
                            )}
                        >
                            Get Started
                        </Button>
                    </form>
                ) : (
                    <Button
                        disabled
                        className={cn(
                            "w-full h-12 font-handwritten text-lg relative",
                            "border-2 border-zinc-900 dark:border-white",
                            "opacity-50 cursor-not-allowed",
                            "bg-gradient-to-r from-pink-500 to-purple-500 text-white",
                        )}
                    >
                        Coming Soon
                    </Button>
                )
            )}
             {isFreeTier && (
                <Button
                className={cn(
                    "w-full h-12 font-handwritten text-lg relative",
                    "border-2 border-zinc-900 dark:border-white",
                    "transition-all duration-300",
                    "shadow-[4px_4px_0px_0px] shadow-zinc-900 dark:shadow-white",
                    "hover:shadow-[6px_6px_0px_0px]",
                    "hover:translate-x-[-2px] hover:translate-y-[-2px]",
                    "bg-zinc-50 dark:bg-zinc-800",
                    "text-zinc-900 dark:text-white",
                    "hover:bg-white dark:hover:bg-zinc-700",
                    "active:bg-zinc-50 dark:active:bg-zinc-800",
                )}
            >
              Try Now
            </Button>
          )}
        </div>
    </div>
  );
}
