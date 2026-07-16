// lib/db/seed.ts
import { stripe } from '../payments/stripe';
import { db } from './drizzle';
import { users, teams, teamMembers } from './schema';
import { hashPassword } from '@/lib/auth/session';
import { tiers } from '@/lib/tiers'; // Import the tiers

async function createStripeProductsAndPrices() {
    console.log('Creating Stripe products and prices...');

    for (const tier of tiers) {
        if (tier.priceMonthly !== null) { // Only create products for paid tiers
            let product;

            //Check if product exists
            const existingProducts = await stripe.products.list({
                active: true,
            });

            const existingProduct = existingProducts.data.find(p => p.name === tier.name);

            if(existingProduct){
                product = existingProduct;
                console.log(`Product ${tier.name} already exists`);
            } else {
                product = await stripe.products.create({
                    name: tier.name,
                    description: tier.description,
                });
                console.log(`Product ${tier.name} created`);
            }


            // Check if price exists
            const existingPrices = await stripe.prices.list({
                product: product.id,
                active: true,
            });

            const existingPrice = existingPrices.data.find(p => p.unit_amount === tier.priceMonthly! * 100);

            if(existingPrice){
                console.log(`Price for ${tier.name} already exists`);
                //Update the priceId on the tier
                tier.priceId = existingPrice.id;

            } else {
                const price = await stripe.prices.create({
                    product: product.id,
                    unit_amount: tier.priceMonthly! * 100, // Convert to cents
                    currency: 'usd',
                    recurring: {
                        interval: 'month',
                         trial_period_days: tier.priceMonthly === null ? 0 : 14, // No trial for free
                    },
                });
                console.log(`Price for ${tier.name} created`);
                //Update the priceId on the tier
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
    .values([
      {
        email: email,
        passwordHash: passwordHash,
        role: "owner",
      },
    ])
    .returning();

  console.log('Initial user created.');

    // Find the "Free" tier
    const freeTier = tiers.find(t => t.id === 'free');
    if (!freeTier) {
        throw new Error("Free tier not found in tiers.ts");
    }

  const [team] = await db
    .insert(teams)
    .values({
      name: 'Test Team',
      messageLimit: freeTier.messageLimit, // Set the message limit from the tier
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
