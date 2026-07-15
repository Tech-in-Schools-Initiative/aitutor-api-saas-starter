import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { validatedAction } from '@/lib/auth/middleware';

const require = createRequire(import.meta.url);

// `require('zod/package.json')` is blocked by zod's "exports" map, so resolve
// the package's node_modules directory via require.resolve.paths and read
// package.json directly with fs, bypassing the exports restriction.
// (Same pattern as tests/unit/tiers-limit.test.ts for drizzle-orm/drizzle-kit.)
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

describe('zod version pin', () => {
  it('zod is at least 4.4.3', () => {
    const version = installedVersion('zod');
    expect(atLeast(version, '4.4.3'), `installed zod ${version} is older than expected`).toBe(true);
  });
});

describe('validatedAction error message extraction', () => {
  const testSchema = z.object({
    email: z.string().email().min(3).max(255),
    password: z.string().min(8).max(100),
  });

  const action = validatedAction(testSchema, async (data) => {
    return { success: `welcome ${data.email}` };
  });

  it('surfaces a Zod issue message string on invalid input', async () => {
    const formData = new FormData();
    formData.set('email', 'not-an-email');
    formData.set('password', 'short');
    const result = await action({}, formData);
    expect(result).toHaveProperty('error');
    expect(typeof (result as unknown as { error: string }).error).toBe('string');
    expect((result as unknown as { error: string }).error.length).toBeGreaterThan(0);
  });

  it('passes validated data through to the action on valid input', async () => {
    const formData = new FormData();
    formData.set('email', 'user@example.com');
    formData.set('password', 'a-long-enough-password');
    const result = await action({}, formData);
    expect(result).toEqual({ success: 'welcome user@example.com' });
  });
});
