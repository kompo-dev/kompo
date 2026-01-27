import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Only test User Application code (apps, shared, domains)
    include: [
        'apps/**/*.test.ts', 
        'libs/**/*.test.ts'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'packages/**',  // Exclude Framework tests (handled by packages/vitest.config.ts)
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/**/src/**/*.ts'],
      exclude: ['**/__tests__/**', '**/node_modules/**'],
    },
    testTimeout: 10000
  },
})
