import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';

describe('dead terminal.tsx', () => {
  it('has been removed from app/(front) (confirmed unimported by any route)', () => {
    const terminalPath = path.join(process.cwd(), 'app', '(front)', 'terminal.tsx');
    expect(existsSync(terminalPath)).toBe(false);
  });
});
