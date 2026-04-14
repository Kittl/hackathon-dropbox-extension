import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
  },
  publicDir: 'public',
  build: {
    outDir: 'dist',
  },
  base: './',
});
