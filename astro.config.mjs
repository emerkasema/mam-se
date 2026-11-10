import { defineConfig } from 'astro/config';
// Stejná cesta musí platit pro stránku, workery i service worker.
export default defineConfig({
  output: 'static', base: process.env.PUBLIC_APP_BASE || '/mam-se/',
  vite: { optimizeDeps: { exclude: ['@evolu/sqlite-wasm'] } },
});
