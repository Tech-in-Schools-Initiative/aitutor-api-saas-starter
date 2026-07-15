import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

// `require('stripe/package.json')` is blocked by stripe's "exports" map,
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

describe('stripe version pin', () => {
  it('stripe is at least 22.3.1', () => {
    const version = installedVersion('stripe');
    expect(atLeast(version, '22.3.1'), `installed stripe ${version} is older than expected`).toBe(true);
  });
});

describe('lib/payments/stripe.ts apiVersion literal', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'lib/payments/stripe.ts'),
    'utf8'
  );

  it('no longer pins the pre-upgrade api version', () => {
    expect(source).not.toContain('2025-01-27.acacia');
  });

  it('pins a validly-shaped dated Stripe API version', () => {
    const match = source.match(/apiVersion:\s*'([^']+)'/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/^\d{4}-\d{2}-\d{2}\.[a-z]+$/);
  });

  it('pins the exact api version the installed stripe SDK ships as its latest', () => {
    // Read the installed package's own pinned constant directly rather than
    // hardcoding an expected literal here, so this test tracks whatever
    // version is actually installed (per node_modules/stripe/cjs/apiVersion.js).
    const searchPaths = require.resolve.paths('stripe') ?? [];
    let sdkApiVersion: string | null = null;
    for (const searchPath of searchPaths) {
      const apiVersionPath = path.join(searchPath, 'stripe', 'cjs', 'apiVersion.js');
      try {
        const content = readFileSync(apiVersionPath, 'utf-8');
        const m = content.match(/exports\.ApiVersion\s*=\s*'([^']+)'/);
        if (m) {
          sdkApiVersion = m[1];
          break;
        }
      } catch {
        continue;
      }
    }
    expect(sdkApiVersion).not.toBeNull();

    const match = source.match(/apiVersion:\s*'([^']+)'/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(sdkApiVersion);
  });
});
