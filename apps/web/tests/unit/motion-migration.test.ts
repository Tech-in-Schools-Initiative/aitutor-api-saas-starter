import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const filesThatImportedFramerMotion = [
  'components/landing-page/timeline/TimelineContent.tsx',
  'components/landing-page/hero/hero.tsx',
  'components/landing-page/timeline/components/testimonial-cards.tsx',
  'components/landing-page/footer/animated-gradient-background.tsx',
  'components/landing-page/hero/components/sparkles-text.tsx',
];

function readSource(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');
}

describe('framer-motion -> motion consolidation', () => {
  it.each(filesThatImportedFramerMotion)(
    '%s no longer imports from "framer-motion"',
    (relativePath) => {
      expect(readSource(relativePath)).not.toMatch(
        /from ['"]framer-motion['"]/
      );
    }
  );

  it.each(filesThatImportedFramerMotion)(
    '%s imports its motion primitives from "motion/react" instead',
    (relativePath) => {
      expect(readSource(relativePath)).toMatch(/from ['"]motion\/react['"]/);
    }
  );
});
