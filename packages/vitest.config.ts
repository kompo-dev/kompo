import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Match tests in src/ folders of packages
    include: ['src/**/*.test.ts', '**/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/**', 'libs/**', '.archived/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', '**/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/node_modules/**'],
    },
    testTimeout: 10000,
    alias: {
      '@kompo/kit': new URL('./kit/src/index.ts', import.meta.url).pathname,
      '@kompo/blueprints': new URL('./blueprints/src/index.ts', import.meta.url).pathname,
    },
  },
})
