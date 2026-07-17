// apps/web/tests/unit/front-layout-sign-in.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Suspense } from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} alt={props.alt ?? ''} />,
}));

import Layout from '@/app/(front)/layout';
import { UserProvider } from '@/lib/auth';

describe('(front) layout Header — Sign In button', () => {
  it('uses the outline Button variant with no contradictory background/text classes', async () => {
    const userPromise = Promise.resolve(null);
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

    const signInLink = screen.getByRole('link', { name: 'Sign In' });

    expect(signInLink.getAttribute('data-slot')).toBe('button');
    expect(signInLink.getAttribute('data-variant')).toBe('outline');
    expect(signInLink.className).not.toContain('bg-black');
    expect(signInLink.className).not.toContain('bg-transparent');
    expect(signInLink.className).not.toContain('text-black');
  });

  it('leaves the Sign Up button as the solid black CTA', async () => {
    const userPromise = Promise.resolve(null);
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

    const signUpLink = screen.getByRole('link', { name: 'Sign Up' });
    expect(signUpLink.className).toContain('bg-black');
  });
});
