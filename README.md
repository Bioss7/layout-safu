# Лендинг ИТ-стажировки в Московском транспорте

Сборка проекта на **[Vite 7](https://vite.dev/)** и **pnpm**. Все собранные и оптимизированные файлы попадают в папку `dist/`.

## Запуск

1. Установи зависимости (один раз):
   ```bash
   pnpm install
   ```

2. Режим разработки — dev-сервер с HMR:
   ```bash
   pnpm dev
   ```

3. Продакшн-сборка в `dist/`:
   ```bash
   pnpm build
   ```

4. Локальный просмотр собранной версии:
   ```bash
   pnpm preview
   ```

## Скрипты

| Скрипт | Что делает |
| --- | --- |
| `pnpm dev` | dev-сервер Vite (HMR, SCSS/JS/HTML из исходников) |
| `pnpm build` | прод-сборка в `dist/` (CSS/JS минифицированы, ассеты скопированы) |
| `pnpm preview` | статический сервер поверх `dist/` |
| `pnpm webp` | ручная конвертация PNG → WebP (`convert-to-webp.mjs`) |
| `pnpm optimize` | ручная PNG/WebP-оптимизация (`optimize-images.mjs`) |

## Что собирается

- **HTML**: страницы — `index.html` (главная) и `about/index.html` (пример отдельной страницы). Подключения файлов — явные теги прямо в разметке (видно при переносе в шаблоны):
  - `<link rel="stylesheet" href="/src/scss/main/style.scss">` — SCSS-вход страницы;
  - `<link rel="stylesheet" href="/assets/vendor/swiper-bundle.min.css">` + `<script src="/assets/vendor/...">` — общие вендоры;
  - `<script type="module" src="/src/js/main/<block>.js">` — скрипты блоков страницы.
- **SCSS → CSS**: у каждой страницы свой полный SCSS (`src/scss/<page>/` — свои `_vars/_mixins/_fonts/reset` и `blocks/`). Vite компилирует `src/scss/<page>/style.scss`, прогоняет через PostCSS/`autoprefixer` (браузеры из `.browserslistrc`), минифицирует и кладёт в `dist/assets/css/<page>.css` (главная → `index.css`). `url()` в SCSS указывают на `/<page>/assets/...`.
- **JS**: каждый файл собирается в отдельный `dist/assets/js/<name>.js` (минифицированный). Скрипты полностью по страницам — `src/js/<page>/` (включая собственный `header.js`). Общие вендоры swiper/chart.js — локальные файлы в `public/assets/vendor/`.
- **Ассеты**: шрифты и изображения — свои у каждой страницы: `public/<page>/assets/{img,fonts}` → `dist/<page>/assets/`. Общий только `public/assets/vendor/` → `dist/assets/vendor/`.

При переносе в Bitrix достаточно взять разметку из собранного `dist/<page>/index.html` и подключить файлы из `dist/<page>/assets/` и `dist/assets/vendor/` своими штатными методами.

## Общее и страничное (полная изоляция)

- Каждая страница самодостаточна: `src/scss/<page>/` (включая копии `_vars/_mixins/_fonts/reset` и всех нужных `blocks/`), `src/js/<page>/`, `public/<page>/assets/`.
- Единственное общее — вендоры `public/assets/vendor/` (swiper, chart.js).
- Общие блоки (header/footer) физически скопированы в каждую страницу — правки вносите в каждую копию.
- Входы страниц прописаны в `vite.config.js` → `build.rollupOptions.input`.

## Структура исходников

```
index.html                → главная страница (точка входа Vite)
about/index.html          → пример отдельной страницы («О вузе»)
src/
  scss/
    main/                 → _vars, _mixins, _fonts, reset, style.scss, blocks/ (все блоки главной)
    about/                → _vars, _mixins, _fonts, reset, style.scss, blocks/ (блоки страницы)
  js/
    main/                 → скрипты главной (main, modal, header, hero, life-tabs, reviews-slider, charts)
    about/                → скрипты страницы (about, header)
public/
  assets/vendor/          → ОБЩИЕ вендоры (swiper-bundle, chart.js)
  main/assets/{img,fonts} → ассеты главной (свои шрифты и картинки, включая header/footer)
  about/assets/{img,fonts}→ ассеты страницы «О вузе»
vite.config.js            → конфиг Vite (входы HTML/JS, publicDir: public, outDir: dist)
postcss.config.js         → autoprefixer
*.mjs                     → ручные утилиты WebP/оптимизации
dist/                     → результат сборки (гитигнорится)
```

## Зависимости (devDependencies)

- `vite` — сборка и dev-сервер
- `sass` — SCSS → CSS
- `autoprefixer` — вендорные префиксы (конфиг: `.browserslistrc`)
- `sharp` — ручные скрипты WebP/оптимизации
- `@playwright/test` — визуальное тестирование

Сторонние библиотеки (swiper, chart.js) — локальные файлы в `public/assets/vendor/`, без npm-зависимостей.

## Тестирование

Визуальные тесты на Playwright проверяют вёрстку на всех ключевых вьюпортах (1920, 1024, 768, 375) и работу интерактивных элементов (табы, слайдеры, выпадашки).

### Установка браузеров (один раз)

```bash
npx playwright install chromium
```

### Запуск тестов

```bash
npx playwright test
```

### Полезные команды

```bash
npx playwright test --ui      # интерактивный режим с браузером
npx playwright test --debug  # пошаговая отладка
npx playwright show-report   # открыть HTML-отчёт после прогона
```

Тесты автоматически собирают проект (`pnpm build`) и запускают preview-сервер на порту 4173.

