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

- **HTML**: `index.html` — точка входа Vite. Подключения файлов — явные теги прямо в разметке (видно при переносе в шаблоны):
  - `<link rel="stylesheet" href="/src/scss/style.scss">` — SCSS-вход;
  - `<link rel="stylesheet" href="/assets/vendor/swiper-bundle.min.css">` + `<script src="/assets/vendor/...">` — локальные вендоры;
  - `<script type="module" src="/src/js/<block>.js">` — скрипты блоков.
- **SCSS → CSS**: Vite компилирует `src/scss/style.scss` (`sass`), прогоняет через PostCSS/`autoprefixer` (браузеры из `.browserslistrc`), минифицирует и кладёт в `dist/assets/css/style.css`. `url()` в SCSS указывают на `/assets/...`.
- **JS**: каждый файл из `src/js/` собирается в отдельный `dist/assets/js/<name>.js` (минифицированный). Сторонние swiper/chart.js остаются локальными файлами в `public/assets/vendor/` и копируются как есть.
- **Ассеты**: `public/assets/{css,img,fonts,vendor}` копируются в `dist/assets/` как есть (файлы в `public/` не хэшируются).

При переносе в Bitrix достаточно взять разметку из собранного `dist/index.html` и подключить файлы из `dist/assets/` своими штатными методами (или скопировать `assets/` как есть).

## Структура исходников

```
index.html           → точка входа Vite; здесь явные подключения CSS/JS
src/
  scss/              → style.scss (вход), blocks/, _vars, _mixins, _fonts, reset
  js/                → скрипты блоков (каждый подключается в index.html отдельно)
public/assets/
  css/               → accessibility.css (подключается на страницах отдельно)
  img/               → изображения (PNG/SVG)
  fonts/             → шрифты
  vendor/            → swiper-bundle, chart.js (локальные файлы)
vite.config.js       → конфиг Vite (publicDir: public, outDir: dist)
postcss.config.js    → autoprefixer
*.mjs                → ручные утилиты WebP/оптимизации
dist/                → результат сборки (гитигнорится)
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

