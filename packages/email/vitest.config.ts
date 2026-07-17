import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    env: {
      BASE_URL: 'http://localhost:3000',
    },
  },
});
