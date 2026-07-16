import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';
import path from 'node:path';

// Loads apps/web/.env for direct/CLI usage (drizzle-kit, scripts/*.ts run via
// tsx from this package). When this module is imported through Next.js
// (apps/web), Next has already populated process.env from apps/web/.env(.local)
// before any app code runs, so this call is a no-op there — dotenv never
// overwrites a variable that's already set.
dotenv.config({ path: path.resolve(__dirname, '../../../apps/web/.env'), quiet: true });

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

export const client = postgres(process.env.POSTGRES_URL);
export const db = drizzle(client, { schema });
