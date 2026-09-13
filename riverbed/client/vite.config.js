import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // When running via `netlify dev`, Netlify's own CLI proxies both
      // the Vite dev server and the functions and handles this rewrite
      // itself — this vite.config proxy is a fallback for running the
      // client alone with `npm run dev` against `netlify functions:serve`.
      '/api': 'http://localhost:8888',
    },
  },
});
