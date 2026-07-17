// apps/web/tests/unit/front-layout-avatar-initials.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Suspense } from 'react';
import type { User } from '@repo/db/schema';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} alt={props.alt ?? ''} />,
}));

import Layout from '@/app/(front)/layout';
import { UserProvider } from '@/lib/auth';

describe('(front) layout Header — avatar initials', () => {
  it("shows initials from the user's name, not a single character sliced off the email", async () => {
    const testUser = {
      id: 1,
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
    } as unknown as User;

    const userPromise = Promise.resolve(testUser);
    await act(async () => {
      render(
        <UserProvider userPromise={userPromise}>
          <Suspense fallback={null}>
            <Layout>
              <div />
            </Layout>
          </Suspense>
        </UserProvider>
      );
      await userPromise;
    });

    expect(await screen.findByText('JD')).toBeTruthy();
  });
});
