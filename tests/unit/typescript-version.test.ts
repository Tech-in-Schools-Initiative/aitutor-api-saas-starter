import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function installedVersion(pkg: string): string {
  return (require(`${pkg}/package.json`) as { version: string }).version;
}

function versionAtLeast(version: string, min: string): boolean {
  const v = version.split('.').map(Number);
  const m = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const vi = v[i] ?? 0;
    const mi = m[i] ?? 0;
    if (vi !== mi) return vi > mi;
  }
  return true;
}

describe('TypeScript stays on the 5.x line', () => {
  it('is at least 5.9.3 and below the 6.0 tsgo line', () => {
    const version = installedVersion('typescript');
    expect(versionAtLeast(version, '5.9.3')).toBe(true);
    expect(versionAtLeast(version, '6.0.0')).toBe(false);
  });
});
