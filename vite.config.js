import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
});
