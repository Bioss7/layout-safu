import { dirname, relative, resolve } from 'node:path';
import { defineConfig } from 'vite';
import { uiPreview } from './tools/ui-preview.mjs';
import { formatOnSave } from './tools/format-on-save.mjs';

const toPosix = (value) => value.replace(/\\/g, '/');

// JS-входы: ключ = имя собранного файла assets/js/<ключ>.js
const jsInputs = {
  'abiturient-header': resolve('src/js/abiturient/header.js'),
  'abiturient-footer': resolve('src/js/abiturient/footer.js'),
  'abiturient-tabs': resolve('src/js/abiturient/tabs.js'),
  'abiturient-drag-scroll': resolve('src/js/abiturient/drag-scroll.js'),
  'abiturient-accordion': resolve('src/js/abiturient/accordion.js'),
  'abiturient-topic-select': resolve('src/js/abiturient/topic-select.js'),
  'abiturient-question-form': resolve('src/js/abiturient/question-form.js'),
  'abiturient-reviews': resolve('src/js/abiturient/reviews.js'),
  'abiturient-info-dialog': resolve('src/js/abiturient/info-dialog.js'),
  modal: resolve('src/js/main/modal.js'),
  main: resolve('src/js/main/main.js'),
  'main-header': resolve('src/js/main/header.js'),
  hero: resolve('src/js/main/hero.js'),
  'life-tabs': resolve('src/js/main/life-tabs.js'),
  'reviews-slider': resolve('src/js/main/reviews-slider.js'),
  charts: resolve('src/js/main/charts.js'),
  'about-header': resolve('src/js/about/header.js'),
  'about-page': resolve('src/js/about/about.js'),
  'programs-header': resolve('src/js/programs/header.js'),
  'programs-catalog': resolve('src/js/programs/catalog.js'),
  'programs-contact-form': resolve('src/js/programs/contact-form.js'),
  'programs-detail-page': resolve('src/js/programs/detail.js'),
};

const jsOutputBySource = new Map(
  Object.entries(jsInputs).map(([name, abs]) => [toPosix(abs), `assets/js/${name}.js`]),
);

// Собранные JS-бандлы самодостаточны (без import/export), поэтому в HTML их можно
// подключать обычными <script> и страница работает при открытии файла через file://.
// Плагин подменяет /src/js/... на относительный путь до бандла и убирает crossorigin,
// который браузер блокирует для локальных файлов (origin null).
function relativeClassicScripts() {
  const tagRe = /<(?:link|script)\b[^>]*>/g;
  const crossoriginRe = /\s+crossorigin(?=[\s/>])/g;
  const srcRe = /(\ssrc=")\/src\/js\/([^"]+\.js)(")/g;

  return {
    name: 'relative-classic-scripts',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const pageDir = dirname(ctx.filename);
        return html.replace(tagRe, (tag) => {
          const withoutCrossorigin = tag.replace(crossoriginRe, '');
          return withoutCrossorigin.replace(srcRe, (_match, before, url, after) => {
            const output = jsOutputBySource.get(toPosix(resolve('src/js', url)));
            if (!output) return _match;
            let rel = toPosix(relative(pageDir, resolve(output)));
            if (!rel.startsWith('.')) rel = `./${rel}`;
            return `${before}${rel}${after}`;
          });
        });
      },
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: 'public',
  plugins: [relativeClassicScripts(), uiPreview(), formatOnSave()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        // HTML-страницы
        index: resolve('index.html'),
        about: resolve('about/index.html'),
        programs: resolve('programs/index.html'),
        abiturient: resolve('abiturient/index.html'),
        'ui-catalog': resolve('ui/index.html'),
        'ui-statistics': resolve('ui/statistics/index.html'),
        'programs-detail': resolve('programs/detail/index.html'),
        // JS-скрипты страниц
        ...jsInputs,
      },
      output: {
        entryFileNames: ({ name }) => name.startsWith('ui-') ? 'ui/assets/js/[name].js' : 'assets/js/[name].js',
        chunkFileNames: ({ name }) => /^(?:ui|pages)/.test(name) ? 'ui/assets/js/[name].js' : 'assets/js/[name].js',
        assetFileNames: ({ names }) => {
          const name = names?.[0] ?? '';
          if (/^(?:ui|pages)/.test(name)) return 'ui/assets/[name][extname]';
          if (name.endsWith('.css')) return 'assets/css/[name][extname]';
          return 'assets/[name][extname]';
        },
      },
    },
  },
});
