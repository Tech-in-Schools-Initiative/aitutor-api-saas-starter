import { describe, it, expect } from 'vitest';
import { canRemoveTeamMember } from '@/lib/auth/permissions';
import type { TeamMember, User } from '@repo/db/schema';

type Member = TeamMember & { user: Pick<User, 'id' | 'name' | 'email'> };

function makeMember(overrides: Partial<Member>): Member {
  return {
    id: 1,
    userId: 1,
    teamId: 1,
    role: 'member',
    joinedAt: new Date(),
    user: { id: 1, name: 'Test User', email: 'test@example.com' },
    ...overrides,
  };
}

describe('canRemoveTeamMember', () => {
  it('allows an owner to remove a regular member', () => {
    const owner = makeMember({
      id: 1,
      userId: 10,
      role: 'owner',
      user: { id: 10, name: 'Owner', email: 'owner@example.com' },
    });
    const member = makeMember({
      id: 2,
      userId: 20,
      role: 'member',
      user: { id: 20, name: 'Member', email: 'member@example.com' },
    });
    expect(canRemoveTeamMember(10, member, [owner, member])).toBe(true);
  });

  it('does not allow removing another owner', () => {
    const owner = makeMember({
      id: 1,
      userId: 10,
      role: 'owner',
      user: { id: 10, name: 'Owner', email: 'owner@example.com' },
    });
    const otherOwner = makeMember({
      id: 2,
      userId: 20,
      role: 'owner',
      user: { id: 20, name: 'Other Owner', email: 'other@example.com' },
    });
    expect(canRemoveTeamMember(10, otherOwner, [owner, otherOwner])).toBe(false);
  });

  it('does not allow removing yourself', () => {
    const owner = makeMember({
      id: 1,
      userId: 10,
      role: 'owner',
      user: { id: 10, name: 'Owner', email: 'owner@example.com' },
    });
    expect(canRemoveTeamMember(10, owner, [owner])).toBe(false);
  });

  it('does not allow a regular member to remove anyone', () => {
    const owner = makeMember({
      id: 1,
      userId: 10,
      role: 'owner',
      user: { id: 10, name: 'Owner', email: 'owner@example.com' },
    });
    const member = makeMember({
      id: 2,
      userId: 20,
      role: 'member',
      user: { id: 20, name: 'Member', email: 'member@example.com' },
    });
    expect(canRemoveTeamMember(20, owner, [owner, member])).toBe(false);
  });

  it('returns false when there is no current user id', () => {
    const member = makeMember({});
    expect(canRemoveTeamMember(undefined, member, [member])).toBe(false);
  });
});
