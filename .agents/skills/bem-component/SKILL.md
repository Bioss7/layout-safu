---
name: bem-component
description: Использовать при любой верстке и стилях в layout-safu — создание/изменение секций index.html, БЭМ-классов, SCSS-блоков в src/scss/blocks/, JS-компонентов в src/js/. Содержит правила БЭМ, Sass, семантической разметки и компонентного подхода.
---

# БЭМ + Sass + семантика + компонентный подход (layout-safu)

## Компонент — из чего состоит

Один компонент затрагивает до трёх файлов:

1. Секция в `index.html` — `<section class="block-name">…</section>` в общем потоке страницы.
2. `src/scss/blocks/<block-name>.scss` — стили блока.
3. `src/js/<block-name>.js` — только если нужна логика (табы, слайдер, модалка); подключается отдельным `<script type="module" src="/src/js/<block-name>.js">` в `index.html` (в конец `<body>`, рядом с другими скриптами).

Новый блок обязательно подключается в `src/scss/style.scss`:

```scss
@use "blocks/<block-name>";
```

Подключение идёт в конец файла, стили компилируются только из `style.scss`.

## БЭМ

- Блок — один класс `.hero`, в одном файле `blocks/hero.scss`, вложен через `&__`, `&--`:

```scss
.hero {
  &__title { … }
  &__tab {
    &--active { … }
  }
}
```

- Модификатор только меняет состояние (`--active`, `--primary`, `--secondary`), не дублирует базовые стили.
- JS переключает исключительно модификаторы через `classList.toggle/add/remove`, ничего не считает и не пишет в style.
- Связь HTML ↔ JS — через `data-*`-атрибуты (`data-life-tab`, `data-life-panel`), а не через хрупкие селекторы.
- Состояния `:hover`, `:active`, `:focus-visible`, `:disabled` объявляются внутри элемента (`&:hover { … }`).
- Вложенные селекторы сторонних библиотек (`.swiper-slide`) — только внутри блока, к которым они относятся.

## Sass

- Каждый блок начинается с:

```scss
@use "../_mixins" as *;
@use "../_vars" as *;
```

- Только `@use`, без `@import`. Переменные и миксины — из `_vars.scss` / `_mixins.scss`.
- Вложенность максимум 2–3 уровня; глубже — плоские селекторы или `&`.
- Цвета/шрифты-токены — только через `var(--main-...)` из `:root` в `_vars.scss`. Новый токен из Figma добавляется туда же.
- Скругления, контейнер, размеры кнопок — SCSS-переменные из `_vars.scss` (`$container-max-width`, `$button-radius`), не хардкод.
- Брейкпоинты только миксином, сверху вниз от большего к меньшему:

```scss
@include breakpoint($bp-1440) { … }
@include breakpoint($bp-1200) { … }
```

Доступны `$bp-390`, `$bp-768`, `$bp-992`, `$bp-1200`, `$bp-1440` (max-width).

## Семантическая разметка

- Теги по смыслу: `header`, `nav`, `main`, `section`, `article`, `footer`, `ul/li`, `table`; `div` — только как обёрстка для сетки/внутренности.
- Заголовки по уровню без пропусков: один `h1` на страницу, дальше `h2`/`h3` по иерархии.
- Интерактив — `button` (действия) или `a` (переходы), никогда не `div onclick`.
- У иконок-кнопок — `aria-label`; у табов — `aria-selected`, `aria-hidden` на неактивных панелях; видимый фокус — `:focus-visible`.
- Изображения — `alt`; декоративные SVG — `aria-hidden="true"`.

## JS-компонент

Шаблон (пример — `src/js/life-tabs.js`):

```js
document.addEventListener('DOMContentLoaded', () => {
  const block = document.querySelector('.block-name');
  if (!block) return;              // ранний выход, если блока нет на странице
  // поиск строго внутри block/section, не глобальный
  // работа через data-атрибуты и classList.toggle('block__el--active')
});
```

- Один файл — один блок; без библиотек (swiper/chart.js — локальные файлы `public/assets/vendor/`, подключаются обычными `<script>` до скриптов блоков и доступны как глобали `Swiper`/`Chart`).
- aria-состояния синхронизируются вместе с модификаторами.

## Чек-лист нового компонента

1. Секция в `index.html` (семантические теги, классы по БЭМ).
2. `src/scss/blocks/<block>.scss` (подключить в `style.scss`).
3. Токены — в `_vars.scss`, если их там ещё нет.
4. `src/js/<block>.js` — при необходимости логики; добавить `<script type="module" src="/src/js/<block>.js">` в `index.html`.
5. Проверка: `pnpm build` (не `pnpm dev`).
6. Пути к ассетам в HTML и SCSS — `/assets/...`.
