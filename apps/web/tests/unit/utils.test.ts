import { describe, it, expect } from 'vitest';
import { cn, getInitials } from '@repo/ui/lib/utils';

describe('cn', () => {
  it('joins truthy class names with a space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('drops falsy values', () => {
    const isActive = false;
    expect(cn('a', isActive && 'b', undefined, null, 'c')).toBe('a c');
  });

  it('merges conflicting Tailwind classes, keeping the last one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('merges conditional class objects', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active');
  });
});

describe('getInitials', () => {
  it('uses the first letter of up to two words in the name', () => {
    expect(getInitials('Jane Doe', 'jane@example.com')).toBe('JD');
  });

  it('uses a single initial for a one-word name', () => {
    expect(getInitials('Cher', 'cher@example.com')).toBe('C');
  });

  it('caps name-derived initials at two letters for a three-word name', () => {
    expect(getInitials('Jane Middle Doe', 'jane@example.com')).toBe('JM');
  });

  it('falls back to the email local-part when no name is present, splitting on separators', () => {
    expect(getInitials(null, 'john.doe@example.com')).toBe('JD');
  });

  it('falls back to the first two characters of the email local-part when it has no separators', () => {
    expect(getInitials(undefined, 'johndoe@example.com')).toBe('JO');
  });

  it('never splits on spaces in the email (the original bug)', () => {
    expect(getInitials(null, 'johndoe@example.com')).not.toBe('J');
  });

  it('returns a placeholder when neither name nor email is usable', () => {
    expect(getInitials(null, null)).toBe('?');
    expect(getInitials('', '')).toBe('?');
  });
});
