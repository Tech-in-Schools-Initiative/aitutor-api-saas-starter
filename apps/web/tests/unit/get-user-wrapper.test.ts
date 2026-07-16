import { describe, it, expect, vi, beforeEach } from 'vitest';

const { cookiesGetMock, getUserByIdMock } = vi.hoisted(() => ({
  cookiesGetMock: vi.fn(),
  getUserByIdMock: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: () => ({ get: cookiesGetMock }),
}));

vi.mock('@repo/db/queries', () => ({
  getUserById: getUserByIdMock,
}));

import { signToken, getUser } from '@/lib/auth/session';

beforeEach(() => {
  cookiesGetMock.mockReset();
  getUserByIdMock.mockReset();
});

describe('getUser() session wrapper', () => {
  it('returns null when there is no session cookie', async () => {
    cookiesGetMock.mockReturnValue(undefined);
    const user = await getUser();
    expect(user).toBeNull();
    expect(getUserByIdMock).not.toHaveBeenCalled();
  });

  it('returns null for an expired session', async () => {
    const token = await signToken({
      user: { id: 7 },
      expires: new Date(Date.now() - 60_000).toISOString(),
    });
    cookiesGetMock.mockReturnValue({ value: token });
    const user = await getUser();
    expect(user).toBeNull();
    expect(getUserByIdMock).not.toHaveBeenCalled();
  });

  it('delegates to getUserById with the session user id for a valid session', async () => {
    const token = await signToken({
      user: { id: 7 },
      expires: new Date(Date.now() + 60_000).toISOString(),
    });
    cookiesGetMock.mockReturnValue({ value: token });
    getUserByIdMock.mockResolvedValue({ id: 7, email: 'test@test.com' });

    const user = await getUser();
    expect(getUserByIdMock).toHaveBeenCalledWith(7);
    expect(user).toEqual({ id: 7, email: 'test@test.com' });
  });
});
