import type { TeamMember, User } from '@repo/db/schema';

export type TeamMemberWithUser = TeamMember & {
  user: Pick<User, 'id' | 'name' | 'email'>;
};

/**
 * Determines whether `currentUserId` may remove `member` from the team,
 * given the full `teamMembers` roster. Replaces the old hardcoded
 * `index > 1` gate: only team owners may remove members, owners can never
 * be removed via this control, and nobody can remove themselves this way.
 */
export function canRemoveTeamMember(
  currentUserId: number | undefined,
  member: TeamMemberWithUser,
  teamMembers: TeamMemberWithUser[]
): boolean {
  if (!currentUserId) return false;

  const viewer = teamMembers.find((m) => m.user.id === currentUserId);
  const viewerIsOwner = viewer?.role === 'owner';
  const targetIsOwner = member.role === 'owner';
  const targetIsSelf = member.user.id === currentUserId;

  return viewerIsOwner && !targetIsOwner && !targetIsSelf;
}
