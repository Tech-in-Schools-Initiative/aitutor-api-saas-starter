import { db } from './drizzle';
import { users, teams, teamMembers } from './schema';
import { hashPassword } from '@/lib/auth/session';

async function seedTest() {
  const email = 'test@test.com';
  const password = 'admin123';
  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values([{ email, passwordHash, role: 'owner' }])
    .returning();

  const [team] = await db
    .insert(teams)
    .values({ name: 'Test Team', messageLimit: 5, currentMessages: 0 })
    .returning();

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: user.id,
    role: 'owner',
  });

  console.log('Test seed complete (no Stripe calls).');
}

seedTest()
  .catch((error) => {
    console.error('Test seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
