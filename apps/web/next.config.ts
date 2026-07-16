import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/ui'],
  turbopack: {
    root: __dirname
  }
};

export default nextConfig;
