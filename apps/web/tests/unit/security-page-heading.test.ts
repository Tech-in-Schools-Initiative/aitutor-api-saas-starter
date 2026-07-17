// apps/web/tests/unit/security-page-heading.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function readSource(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');
}

describe('SecurityPage heading class', () => {
  it('does not use the invalid "font-medium bold" class combination', () => {
    const source = readSource('app/(dashboard)/dashboard/security/page.tsx');
    expect(source).not.toMatch(/font-medium bold/);
  });

  it('uses font-bold on the page heading', () => {
    const source = readSource('app/(dashboard)/dashboard/security/page.tsx');
    expect(source).toMatch(/text-lg lg:text-2xl font-bold text-gray-900 mb-6/);
  });
});
