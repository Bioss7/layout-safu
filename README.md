# Лендинг ИТ-стажировки в Московском транспорте

Сборка проекта на **[Gulp 5](https://gulpjs.com/)**. Все собранные и оптимизированные файлы попадают в папку `dist/`.

## Запуск

1. Установи зависимости (один раз):
   ```bash
   npm install
   ```

2. Режим разработки — сборка в `dist/` + live server с автоперезагрузкой (browser-sync):
   ```bash
   npm run dev
   ```
   Первый запуск пересобирает проект, открывает локальный сервер и следит за изменениями исходников (SCSS, JS, картинки, HTML).

3. Одноразовая сборка без сервера:
   ```bash
   npm run build
   ```

4. Только live server (без пересборки):
   ```bash
   npm run serve
   ```

## Задачи Gulp

Все задачи можно запустить напрямую: `npx gulp <задача>`.

| Задача | Что делает |
| --- | --- |
| `default` | `build` + `serve` (полный рабочий процесс) |
| `build` | очищает `dist/` и собирает всё |
| `clean` | удаляет папку `dist/` |
| `styles` | компилирует `src/scss/style.scss` → `dist/assets/css/style.css` (SCSS → CSS, автопрефиксы, минификация) + неминфицированная копия в `dist/original/css/` |
| `accessibility` | минифицирует `public/assets/css/accessibility.css` → `dist/assets/css/accessibility.css` + неминфицированная копия в `dist/original/css/` |
| `scripts` | минифицирует `public/assets/js/*.js` → `dist/assets/js/` + исходники в `dist/original/js/` |
| `images` | копирует `public/assets/img/` (кроме `optimized/`) → `dist/assets/img/` |
| `webp` | конвертирует PNG → WebP (quality 95, как раньше) в `dist/assets/img/webp/`, пропускает уже существующие |
| `fonts` | копирует `public/assets/fonts/` → `dist/assets/fonts/` |
| `vendor` | копирует `public/assets/vendor/` → `dist/assets/vendor/` |
| `html` | копирует `*.html` и `*.php` в `dist/`, переписывая пути `../public/assets/` → `assets/` |
| `serve` | поднимает live server на `dist/` + watch |

## Что собирается

- **SCSS → CSS**: `src/scss/style.scss` — единственный канонический SCSS-источник. Сборка: `gulp-sass`, затем `gulp-autoprefixer` (конфиг браузеров в `.browserslistrc`), затем минификация `gulp-clean-css`.
- **CSS**: файл доступности `public/assets/css/accessibility.css` минифицируется как есть (production-версия, подключается на страницах отдельно).
- **JS**: каждый файл из `public/assets/js/` минифицируется через `gulp-terser`.
- **WebP**: конвертация через `sharp` (как в прежних `convert-to-webp.mjs`/`optimize-images.mjs`). Качество 95, `effort: 4`. Существующие webp в `public/assets/img/webp/` копируются как есть; новые PNG без webp-копии дописываются.
- Live server проверяет `dist/` и перезагружается при любом изменении сборки.

### Неминфицированные копии (`dist/original/`)

В папку `dist/original/` на всякий случай складываются исходные (до минификации) версии, чтобы было удобно смотреть «как было»:

```
dist/original/css/style.css          → SCSS после компиляции и автопрефиксов (без сжатия)
dist/original/css/accessibility.css  → исходный production accessiblity.css
dist/original/js/*.js                → исходные JS-файлы
```

## Структура исходников

```
src/scss/            → исходные SCSS (style.scss, _vars, _mixins, _fonts, reset, blocks/)
public/assets/
  css/               → style.css (собранный), accessibility.css (production), accessibility.scss (legacy, не используется)
  js/                → исходники и рабочие JS-файлы
  fonts/             → шрифты
  img/               → изображения (PNG/SVG/webp/, optimized/, carousel/ и т.д.)
  vendor/            → сторонние библиотеки (swiper)
*.html, *.php        → страницы в корне
dist/                → результат сборки (гитигнорится)
dist/original/       → неминфицированные копии CSS/JS «на всякий случай»
```

## Используемые пакеты (devDependencies)

- `gulp`, `gulp-sass`, `sass` — SCSS → CSS
- `gulp-autoprefixer`, `autoprefixer` — вендорные префиксы (конфиг: `.browserslistrc`)
- `gulp-clean-css` — минификация CSS
- `gulp-terser` — минификация JS
- `gulp-replace` — перепись путей в HTML
- `del` — очистка `dist/`
- `browser-sync` — live server
- `sharp` — WebP-конвертация

Пример сайта: https://moscowcareer.mguu.ru/itgorod/