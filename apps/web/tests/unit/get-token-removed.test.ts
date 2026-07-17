import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';

describe('dead Get Token feature', () => {
  it('has been removed: dashboard page no longer exists', () => {
    const pagePath = path.join(
      process.cwd(),
      'app',
      '(dashboard)',
      'dashboard',
      'get-token',
      'page.tsx'
    );
    expect(existsSync(pagePath)).toBe(false);
  });

  it('has been removed: /api/token route no longer exists', () => {
    const routePath = path.join(process.cwd(), 'app', 'api', 'token', 'route.ts');
    expect(existsSync(routePath)).toBe(false);
  });
});
