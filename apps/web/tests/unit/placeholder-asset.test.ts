import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('public/placeholder.svg', () => {
  it('exists and is a valid SVG document', () => {
    const filePath = path.resolve(process.cwd(), 'public', 'placeholder.svg');
    expect(existsSync(filePath)).toBe(true);
    const contents = readFileSync(filePath, 'utf-8');
    expect(contents.trim().startsWith('<svg')).toBe(true);
  });
});
