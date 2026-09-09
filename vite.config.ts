import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// GitHub Pages serves this repo under /Rubik-Cube-Learn/. Override with BASE_PATH for any other host.
const base = process.env.BASE_PATH ?? '/Rubik-Cube-Learn/';

/**
 * GitHub Pages has no rewrite rules, so a hard refresh on /learn would 404.
 * It does serve 404.html for unmatched paths with the URL intact, which lets the
 * client router take over — so ship a copy of index.html under that name.
 */
const spaFallback = {
  name: 'spa-404-fallback',
  closeBundle() {
    const dir = fileURLToPath(new URL('./dist', import.meta.url));
    const index = join(dir, 'index.html');
    if (existsSync(index)) copyFileSync(index, join(dir, '404.html'));
  },
};

export default defineConfig({
  base,
  plugins: [react(), spaFallback],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  worker: { format: 'es' },
  optimizeDeps: { include: ['cubejs'] },
  build: {
    target: 'es2022',
    rollupOptions: {},
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test.setup.ts'],
  },
} as Parameters<typeof defineConfig>[0] & { test: unknown });
