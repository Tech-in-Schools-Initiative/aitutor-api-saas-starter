import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function installedVersion(pkg: string): string {
  return (require(`${pkg}/package.json`) as { version: string }).version;
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

describe('next version pin', () => {
  it('next is at least 16.2.10 (latest stable per npm dist-tags)', () => {
    const version = installedVersion('next');
    expect(atLeast(version, '16.2.10'), `installed next ${version} is older than expected`).toBe(true);
  });

  it('react and react-dom were not downgraded below 19.2.7 by the codemod', () => {
    const react = installedVersion('react');
    const reactDom = installedVersion('react-dom');
    expect(atLeast(react, '19.2.7'), `installed react ${react} is older than expected`).toBe(true);
    expect(atLeast(reactDom, '19.2.7'), `installed react-dom ${reactDom} is older than expected`).toBe(true);
  });
});
