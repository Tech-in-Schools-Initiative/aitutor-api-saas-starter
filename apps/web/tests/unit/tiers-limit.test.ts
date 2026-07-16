import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { db } from '@repo/db/client';
import { teams } from '@repo/db/schema';
import { checkMessageLimit, incrementMessageCount } from '@repo/db/utils';

const require = createRequire(import.meta.url);

// `require('<pkg>/package.json')` is blocked by these packages' "exports" map,
// so resolve the package's node_modules directory via require.resolve.paths and
// read package.json directly with fs, bypassing the exports restriction.
function installedVersion(pkgName: string): string {
  const searchPaths = require.resolve.paths(pkgName) ?? [];
  for (const searchPath of searchPaths) {
    const pkgJsonPath = path.join(searchPath, pkgName, 'package.json');
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      return pkg.version;
    } catch {
      continue;
    }
  }
  throw new Error(`Could not resolve installed version for ${pkgName}`);
}

function coreVersion(v: string): number[] {
  return v.split('-')[0].split('.').map(Number);
}
function atLeast(actual: string, min: string): boolean {
  const a = coreVersion(actual);
  const m = coreVersion(min);
  for (let i = 0; i < Math.max(a.length, m.length); i++) {
    const av = a[i] ?? 0;
    const mv = m[i] ?? 0;
    if (av !== mv) return av > mv;
  }
  return true;
}

describe('drizzle-orm / drizzle-kit version pin', () => {
  it('drizzle-orm is at least 0.45.2', () => {
    const version = installedVersion('drizzle-orm');
    expect(atLeast(version, '0.45.2'), `installed drizzle-orm ${version} is older than expected`).toBe(true);
  });

  it('drizzle-kit is at least 0.31.10', () => {
    const version = installedVersion('drizzle-kit');
    expect(atLeast(version, '0.31.10'), `installed drizzle-kit ${version} is older than expected`).toBe(true);
  });
});

let teamId: number;

beforeAll(async () => {
  const [team] = await db
    .insert(teams)
    .values({
      name: 'Vitest Fixture Team',
      messageLimit: 5,
      currentMessages: 0,
    })
    .returning();
  teamId = team.id;
});

afterAll(async () => {
  if (teamId) {
    await db.delete(teams).where(eq(teams.id, teamId));
  }
});

describe('checkMessageLimit / incrementMessageCount', () => {
  it('reports the free-tier limit (5) as remaining when no messages sent', async () => {
    const { withinLimit, remainingMessages } = await checkMessageLimit(teamId);
    expect(withinLimit).toBe(true);
    expect(remainingMessages).toBe(5);
  });

  it('decrements remaining messages after incrementMessageCount', async () => {
    await incrementMessageCount(teamId, 3);
    const { withinLimit, remainingMessages } = await checkMessageLimit(teamId);
    expect(withinLimit).toBe(true);
    expect(remainingMessages).toBe(2);
  });

  it('flips withinLimit to false once the free-tier limit is exhausted', async () => {
    await incrementMessageCount(teamId, 2);
    const { withinLimit, remainingMessages } = await checkMessageLimit(teamId);
    expect(withinLimit).toBe(false);
    expect(remainingMessages).toBe(0);
  });

  it('throws for a team id that does not exist', async () => {
    await expect(checkMessageLimit(-1)).rejects.toThrow('Team not found');
  });
});
