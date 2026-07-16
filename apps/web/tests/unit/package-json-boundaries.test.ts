import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(
  readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')
);
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

describe('apps/web package.json workspace boundaries', () => {
  it('depends on @repo/ui, @repo/db, and @repo/email via workspace:*', () => {
    expect(deps['@repo/ui']).toBe('workspace:*');
    expect(deps['@repo/db']).toBe('workspace:*');
    expect(deps['@repo/email']).toBe('workspace:*');
  });

  it('no longer lists dependencies that moved fully into packages/db or packages/ui', () => {
    expect(deps).not.toHaveProperty('drizzle-kit');
    expect(deps).not.toHaveProperty('postgres');
    expect(deps).not.toHaveProperty('dotenv');
    expect(deps).not.toHaveProperty('radix-ui');
    expect(deps).not.toHaveProperty('class-variance-authority');
    expect(deps).not.toHaveProperty('clsx');
    expect(deps).not.toHaveProperty('tailwind-merge');
  });

  it('retains app-only dependencies still used directly by apps/web code', () => {
    for (const name of [
      'drizzle-orm', 'stripe', 'ai', 'bcryptjs', 'jose',
      'canvas-confetti', 'marked', 'motion', 'zod', 'lucide-react',
    ]) {
      expect(deps).toHaveProperty(name);
    }
  });
});
