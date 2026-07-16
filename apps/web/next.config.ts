import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/ui', '@repo/db', '@repo/email'],
  turbopack: {
    root: __dirname
  }
};

export default nextConfig;
