// components/logo.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSidebar } from '@/components/ui/sidebar';

export function Logo() {
  const { state } = useSidebar();

  return (
    <Link href="/" className="flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer">
      {state === 'expanded' ? (
        <Image
          src="/logo-long.png"
          alt="Logo"
          width={150}
          height={40}
          className="object-contain"
        />
      ) : (
        <Image
          src="/logo-square.png"
          alt="Logo"
          width={40}
          height={40}
          className="object-contain"
        />
      )}
    </Link>
  );
}