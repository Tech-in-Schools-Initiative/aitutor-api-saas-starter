import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';

describe('timeline component dedupe', () => {
  it('removes the unused duplicate TimelineContent.tsx', () => {
    const dupPath = path.join(
      process.cwd(),
      'components/landing-page/timeline/TimelineContent.tsx'
    );
    expect(existsSync(dupPath)).toBe(false);
  });

  it("renames the typo'd TImelineSecion.tsx to TimelineSection.tsx", () => {
    const oldPath = path.join(
      process.cwd(),
      'components/landing-page/timeline/TImelineSecion.tsx'
    );
    const newPath = path.join(
      process.cwd(),
      'components/landing-page/timeline/TimelineSection.tsx'
    );
    expect(existsSync(oldPath)).toBe(false);
    expect(existsSync(newPath)).toBe(true);
  });

  it('exports TimelineSection from the renamed file', async () => {
    const mod = await import('@/components/landing-page/timeline/TimelineSection');
    expect(typeof mod.TimelineSection).toBe('function');
  });
});
