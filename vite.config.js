import { defineConfig } from 'vite';

// base = nombre del repositorio, necesario para GitHub Pages
// (https://tamastudios.github.io/Dashboard/)
export default defineConfig({
  base: '/Dashboard/',
  build: {
    target: 'es2020',
    sourcemap: false,            // no exponer el código fuente original
    // sin polyfill inline de modulepreload → permite una CSP de scripts estricta
    modulePreload: { polyfill: false }
  }
});
