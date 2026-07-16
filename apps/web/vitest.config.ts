import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    env: {
      AUTH_SECRET: 'vitest-unit-test-secret-do-not-use-in-production',
    },
  },
});
