import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['node_modules', 'dist', 'examples'],
      reporter: ['text'],
    }
  },
  resolve: {
    alias: {
      '@': '/src',
      '@test': '/test',
    },
  },
});

