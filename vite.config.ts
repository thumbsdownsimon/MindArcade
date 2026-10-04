import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps asset paths relative, so the build works at any URL path
// (e.g. https://homelab.example/games/) behind a reverse proxy.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173 },
});
