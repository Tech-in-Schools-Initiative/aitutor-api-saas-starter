import js from '@eslint/js';

const baseConfig = [
  js.configs.recommended,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
    ],
  },
];

export default baseConfig;
