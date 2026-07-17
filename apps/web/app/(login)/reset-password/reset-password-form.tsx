'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Loader2 } from 'lucide-react';
import { resetPassword } from '../actions';
import { ActionState } from '@/lib/auth/middleware';

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    resetPassword,
    { error: '' },
  );

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Image alt="Logo" src="/logo-long.png" width={200} height={100} />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Choose a new password
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {!token ? (
          <p className="text-center text-sm text-red-500">
            This password reset link is missing or invalid. Please request a
            new one.
          </p>
        ) : (
          <form className="space-y-6" action={formAction}>
            <input type="hidden" name="token" value={token} />
            <div>
              <Label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                New password
              </Label>
              <div className="mt-1">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={100}
                  className="appearance-none rounded-full relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 focus:border-pink-500 focus:z-10 sm:text-sm"
                  placeholder="Enter a new password"
                />
              </div>
            </div>

            <div>
              <Label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700"
              >
                Confirm new password
              </Label>
              <div className="mt-1">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={100}
                  className="appearance-none rounded-full relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 focus:border-pink-500 focus:z-10 sm:text-sm"
                  placeholder="Confirm your new password"
                />
              </div>
            </div>

            {state?.error && (
              <div className="text-red-500 text-sm">{state.error}</div>
            )}

            <div>
              <Button
                type="submit"
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
                disabled={pending}
              >
                {pending ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    Resetting...
                  </>
                ) : (
                  'Reset password'
                )}
              </Button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
