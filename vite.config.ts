import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  worker: { format: 'es' },
  optimizeDeps: { include: ['cubejs'] },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test.setup.ts'],
  },
} as Parameters<typeof defineConfig>[0] & { test: unknown });
