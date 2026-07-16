// lib/tiers.ts

export interface Tier {
    id: string;
    name: string;
    href: string;
    priceMonthly: number | null;
    description: string;
    features: string[];
    messageLimit: number;
    productId: string; // Stripe Price ID
    priceId?:string;
}
  
export const tiers: Tier[] = [
    {
      id: 'free',
      name: 'Free',
      href: '#',
      priceMonthly: null,
      description: 'For individuals who need to track their work.',
      features: [
        '5 messages per month',
        'Basic features',
      ],
      messageLimit: 5,
      productId: '', // No Price ID for the free tier
      priceId:''
    },
    {
      id: 'starter',
      name: 'Starter',
      href: '#',
      priceMonthly: 10,
      description: 'For small teams who need to collaborate.',
      features: [
        '100 messages per month',
        'All Free tier features',
        'Priority support',
      ],
      messageLimit: 100,
      productId: 'product_...', // Replace with your Starter tier Price ID
      priceId:''
    },
    {
      id: 'pro',
      name: 'Pro',
      href: '#',
      priceMonthly: 30,
      description: 'For large teams who need advanced features.',
      features: [
        'Unlimited messages',
        'All Starter tier features',
        'Dedicated account manager',
      ],
      messageLimit: -1, // -1 represents unlimited
      productId: 'product_...', // Replace with your Pro tier Price ID
      priceId:''
    },
];
