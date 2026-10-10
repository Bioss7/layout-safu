import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve('index.html'),
        modal: resolve('src/js/modal.js'),
        main: resolve('src/js/main.js'),
        header: resolve('src/js/header.js'),
        hero: resolve('src/js/hero.js'),
        'life-tabs': resolve('src/js/life-tabs.js'),
        'reviews-slider': resolve('src/js/reviews-slider.js'),
        charts: resolve('src/js/charts.js'),
      },
      output: {
        entryFileNames: 'assets/js/[name].js',
        chunkFileNames: 'assets/js/[name].js',
        assetFileNames: ({ names }) => {
          const name = names?.[0] ?? '';
          if (name.endsWith('.css')) return 'assets/css/style[extname]';
          return 'assets/[name][extname]';
        },
      },
    },
  },
});