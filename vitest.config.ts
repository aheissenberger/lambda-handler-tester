import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/**/__tests__/**/*.{test,spec}.ts',
      'src/**/*.{test,spec}.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      exclude: ['src/**/__tests__/**', 'src/types/**', 'src/cli.ts'],
    },
  },
});
