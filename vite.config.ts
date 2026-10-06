import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps asset paths relative, so the build works under the GitHub Pages
// project path (https://<user>.github.io/MindArcade/) as well as locally.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173 },
  // The shared three.js chunk is ~900 kB (~250 kB gzipped) and only loads when a 3D game opens.
  build: { chunkSizeWarningLimit: 1000 },
});
