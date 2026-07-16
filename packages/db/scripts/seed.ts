import { hash } from 'bcryptjs';
import Stripe from 'stripe';
import { db } from '../src/client';
import { users, teams, teamMembers } from '../src/schema';
import { tiers } from '../src/tiers';

const SALT_ROUNDS = 10;

async function hashPassword(password: string) {
  return hash(password, SALT_ROUNDS);
}

// A standalone Stripe client — deliberately NOT imported from
// apps/web/lib/payments/stripe.ts. packages/db must not depend on the app
// that consumes it.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
});

async function createStripeProductsAndPrices() {
  console.log('Creating Stripe products and prices...');

  for (const tier of tiers) {
    if (tier.priceMonthly !== null) {
      let product;

      const existingProducts = await stripe.products.list({ active: true });
      const existingProduct = existingProducts.data.find((p) => p.name === tier.name);

      if (existingProduct) {
        product = existingProduct;
        console.log(`Product ${tier.name} already exists`);
      } else {
        product = await stripe.products.create({
          name: tier.name,
          description: tier.description,
        });
        console.log(`Product ${tier.name} created`);
      }

      const existingPrices = await stripe.prices.list({ product: product.id, active: true });
      const existingPrice = existingPrices.data.find(
        (p) => p.unit_amount === tier.priceMonthly! * 100
      );

      if (existingPrice) {
        console.log(`Price for ${tier.name} already exists`);
        tier.priceId = existingPrice.id;
      } else {
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: tier.priceMonthly! * 100,
          currency: 'usd',
          recurring: {
            interval: 'month',
            trial_period_days: tier.priceMonthly === null ? 0 : 14,
          },
        });
        console.log(`Price for ${tier.name} created`);
        tier.priceId = price.id;
      }
    }
  }

  console.log('Stripe products and prices created successfully.');
}

async function seed() {
  const email = 'test@test.com';
  const password = 'admin123';
  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values([{ email, passwordHash, role: 'owner' }])
    .returning();

  console.log('Initial user created.');

  const freeTier = tiers.find((t) => t.id === 'free');
  if (!freeTier) {
    throw new Error('Free tier not found in tiers.ts');
  }

  const [team] = await db
    .insert(teams)
    .values({
      name: 'Test Team',
      messageLimit: freeTier.messageLimit,
      currentMessages: 0,
    })
    .returning();

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: user.id,
    role: 'owner',
  });

  await createStripeProductsAndPrices();
}

seed()
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed process finished. Exiting...');
    process.exit(0);
  });
