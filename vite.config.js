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
        // HTML-страницы
        index: resolve('index.html'),
        about: resolve('about/index.html'),
        // Скрипты главной страницы
        modal: resolve('src/js/main/modal.js'),
        main: resolve('src/js/main/main.js'),
        'main-header': resolve('src/js/main/header.js'),
        hero: resolve('src/js/main/hero.js'),
        'life-tabs': resolve('src/js/main/life-tabs.js'),
        'reviews-slider': resolve('src/js/main/reviews-slider.js'),
        charts: resolve('src/js/main/charts.js'),
        // Скрипты страницы «О вузе»
        'about-header': resolve('src/js/about/header.js'),
        'about-page': resolve('src/js/about/about.js'),
      },
      output: {
        entryFileNames: 'assets/js/[name].js',
        chunkFileNames: 'assets/js/[name].js',
        assetFileNames: ({ names }) => {
          const name = names?.[0] ?? '';
          if (name.endsWith('.css')) return 'assets/css/[name][extname]';
          return 'assets/[name][extname]';
        },
      },
    },
  },
});
