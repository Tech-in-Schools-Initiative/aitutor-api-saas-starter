// apps/web/tests/unit/settings-avatar-size.test.tsx
// @vitest-environment jsdom
//
// jsdom has no ResizeObserver, but Radix Avatar's fallback-visibility timer
// (via @radix-ui/react-use-size) requires one to mount. Polyfilled locally
// here rather than in the shared tests/setup.ts to avoid touching a file
// other concurrent tasks rely on (see tests/unit/tooltip-colors.test.tsx for
// the same pattern).
import { describe, it, expect, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { Suspense } from 'react';
import { Settings } from '@/app/(dashboard)/dashboard/settings';
import { UserProvider } from '@/lib/auth';
import type { TeamDataWithMembers, User } from '@repo/db/schema';

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const teamData = {
  id: 1,
  name: 'Acme',
  planName: 'Free',
  subscriptionStatus: null,
  teamMembers: [
    { id: 1, role: 'owner', user: { id: 1, name: 'Jane Doe', email: 'jane@example.com' } },
  ],
} as unknown as TeamDataWithMembers;

describe('Settings team-member avatar size', () => {
  it('overrides the shrunk shadcn default so it still renders at the original 40px (size-10) footprint', async () => {
    const testUser = {
      id: 1,
      name: 'Jane Doe',
      email: 'jane@example.com',
    } as unknown as User;
    const userPromise = Promise.resolve(testUser);

    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <UserProvider userPromise={userPromise}>
          <Suspense fallback={null}>
            <Settings teamData={teamData} />
          </Suspense>
        </UserProvider>
      ));
      await userPromise;
    });

    const avatar = container.querySelector('[data-slot="avatar"]') as HTMLElement;
    expect(avatar).toBeTruthy();
    expect(avatar.getAttribute('data-size')).toBe('lg');
  });
});
