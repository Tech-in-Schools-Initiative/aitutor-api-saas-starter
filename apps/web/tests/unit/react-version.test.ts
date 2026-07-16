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

describe('React 19.2 upgrade', () => {
  it('react and react-dom are at least 19.2.7', () => {
    expect(versionAtLeast(installedVersion('react'), '19.2.7')).toBe(true);
    expect(versionAtLeast(installedVersion('react-dom'), '19.2.7')).toBe(true);
  });

  it('@types/react and @types/react-dom match the 19.2 upgrade', () => {
    expect(versionAtLeast(installedVersion('@types/react'), '19.2.17')).toBe(true);
    expect(versionAtLeast(installedVersion('@types/react-dom'), '19.2.3')).toBe(true);
  });
});
