import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf-8');
}

describe('lucide-react 1.24.0 icon-rename/removal fixes', () => {
  it('activity/page.tsx uses CircleAlert (not the old AlertCircle name)', () => {
    const source = read('app/(dashboard)/dashboard/activity/page.tsx');
    expect(source).not.toMatch(/\bAlertCircle\b/);
    expect(source).toContain('CircleAlert');
  });

  it('activity/page.tsx uses CircleCheckBig (not the old CheckCircle name)', () => {
    const source = read('app/(dashboard)/dashboard/activity/page.tsx');
    expect(source).not.toMatch(/\bCheckCircle\b/);
    expect(source).toContain('CircleCheckBig');
  });

  it('invite-team.tsx uses CirclePlus (not the old PlusCircle name)', () => {
    const source = read('app/(dashboard)/dashboard/invite-team.tsx');
    expect(source).not.toMatch(/\bPlusCircle\b/);
    expect(source).toContain('CirclePlus');
  });

  it('footer.tsx no longer imports the removed brand icons (Facebook/Instagram/Linkedin were dropped from lucide-react and were never rendered here anyway)', () => {
    const source = read('components/landing-page/footer/footer.tsx');
    expect(source).not.toMatch(/\bFacebook\b/);
    expect(source).not.toMatch(/\bInstagram\b/);
    expect(source).not.toMatch(/\bLinkedin\b/);
    expect(source).not.toMatch(/from ["']lucide-react["']/);
  });

  it('the renamed icons actually exist as exports of the installed lucide-react', () => {
    const lucideReact = require('lucide-react');
    expect(lucideReact.CircleAlert).toBeDefined();
    expect(lucideReact.CircleCheckBig).toBeDefined();
    expect(lucideReact.CirclePlus).toBeDefined();
    // The removed brand icons must genuinely be gone (regression guard against
    // silently re-adding a dead import once they're no longer exported).
    expect(lucideReact.Facebook).toBeUndefined();
    expect(lucideReact.Instagram).toBeUndefined();
    expect(lucideReact.Linkedin).toBeUndefined();
  });

  it('CircleCheckBig is a distinct icon from CircleCheck (guards against the wrong equivalent icon being reintroduced)', () => {
    const lucideReact = require('lucide-react');
    expect(lucideReact.CircleCheckBig).not.toBe(lucideReact.CircleCheck);
  });
});
