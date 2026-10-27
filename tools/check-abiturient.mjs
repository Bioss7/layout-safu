import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Запускать после сборки: pnpm build, затем pnpm preview --port 4173.
const baseURL = process.env.ABITURIENT_BASE_URL || 'http://127.0.0.1:4173';
const output = new URL('../screenshots/abiturient/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'chrome' } : {}) });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  if (response.status() >= 400 && response.url().startsWith(baseURL)) errors.push(`${response.status()} ${response.url()}`);
});

try {
  await page.goto(`${baseURL}/abiturient/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('#applicant-question').inputValue(), '', 'An empty textarea must display its placeholder');
  const expectedScripts = [
    'tabs', 'drag-scroll', 'accordion', 'topic-select',
    'question-form', 'reviews', 'info-dialog',
  ].map(name => '/abiturient/assets/js/' + name + '.js');
  expectedScripts.splice(5, 0, '/assets/vendor/swiper-bundle.min.js');
  expectedScripts.push('/assets/js/header.js', '/assets/js/footer.js');
  const scripts = await page.locator('script[src]').evaluateAll(elements => elements.map(element => ({
    path: new URL(element.src).pathname,
    type: element.getAttribute('type'),
    defer: element.defer,
    async: element.async,
  })));
  assert.deepEqual(scripts.map(script => script.path), expectedScripts, 'Компоненты подключены отдельно, Swiper перед отзывами');
  assert.ok(scripts.every(script => script.type === null && script.defer && !script.async), 'Обычные defer-скрипты выполняются в порядке разметки');
  for (const script of scripts) {
    const response = await page.request.get(baseURL + script.path);
    assert.ok(response.ok(), 'Скрипт доступен: ' + script.path);
    // Парсер обычного скрипта отвергает import/export и проверяет самодостаточность сборки.
    new Script(await response.text(), { filename: script.path });
  }
  const viewports = [1920, 1600, 1441, 1440, 1439, 1201, 1200, 1199, 1151, 1150, 1149, 993, 992, 991, 901, 900, 899, 769, 768, 767, 460, 391, 390];
  const metrics = [];
  const layoutFailures = [];
  for (const width of viewports) {
    await page.setViewportSize({ width, height: 1080 });
    await page.waitForTimeout(100);
    // picture меняет источник на брейкпоинте; ждём загрузку, а не фиксированную задержку.
    await page.waitForFunction(() => [...document.images].every(image => image.complete));
    const metric = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      hero: Math.round(document.querySelector('.applicant-hero').getBoundingClientRect().height),
      contacts: (() => {
        const section = document.querySelector('#contacts');
        const title = section.querySelector('.section-header');
        const map = section.querySelector('.contact-map');
        const style = getComputedStyle(section);
        return {
          background: style.backgroundColor,
          paddingTop: parseFloat(style.paddingTop),
          paddingBottom: parseFloat(style.paddingBottom),
          titleGap: parseFloat(getComputedStyle(title).marginBottom),
          containerLeft: section.querySelector('.container').getBoundingClientRect().left,
          mapWidth: map.offsetWidth,
          height: section.offsetHeight,
          linksDirection: getComputedStyle(section.querySelector('.contacts__links')).flexDirection,
        };
      })(),
      questionBackground: getComputedStyle(document.querySelector('.question__surface')).backgroundColor,
      answersCard: (() => {
        const card = document.querySelector('.answers-card');
        const title = card.querySelector('.answers-card__title');
        const text = card.querySelector('.answers-card__links li:last-child span');
        return {
          width: card.offsetWidth,
          height: card.offsetHeight,
          titleSize: parseFloat(getComputedStyle(title).fontSize),
          textWidth: text.clientWidth,
          textHeight: text.offsetHeight,
          truncated: text.scrollWidth > text.clientWidth,
        };
      })(),
      studyCardsHaveTransparentCorners: [...document.querySelectorAll(".study-card")].every(element => {
        const style = getComputedStyle(element);
        return style.backgroundColor === "rgba(0, 0, 0, 0)" && style.appearance === "none";
      }),
      educationDisplay: getComputedStyle(document.querySelector('.education-layout')).display,
      loadedImages: [...document.images].every(image => image.complete && image.naturalWidth > 0),
      reviewDotIndex: [...document.querySelectorAll('.js-review-dot')].findIndex(dot => dot.getAttribute('aria-current') === 'true'),
      reviewShadow: (() => {
        const slider = document.querySelector('.js-reviews');
        const active = slider.querySelector('.swiper-slide-active');
        const last = active.querySelector('.review-card:last-child');
        const next = active.nextElementSibling;
        const offset = parseFloat(getComputedStyle(last).boxShadow.match(/(-?[\d.]+)px/)[1]);
        return {
          shadowRight: last.getBoundingClientRect().right + offset,
          clipRight: slider.getBoundingClientRect().right,
          nextLeft: next ? next.getBoundingClientRect().left : null,
        };
      })(),
      fontReady: document.fonts.check('800 28px Unbounded'),
      scripts: [...document.scripts].filter(script => script.src).map(script => new URL(script.src).pathname),
    }));
    metrics.push(metric);
    // Figma 4200:19303: central active item (third of five; second of three at 390).
    assert.equal(metric.reviewDotIndex, width <= 390 ? 1 : 2, 'Начальный индикатор отзывов соответствует Figma');
    assert.equal(metric.contacts.background, 'rgb(255, 255, 255)', 'Белый фон контактов поверх сетки');
    // Figma 4209:33349 is transparent at 768; 4209:33953 and 4209:32220 are white.
    assert.equal(metric.questionBackground, width > 576 && width <= 768 ? 'rgba(0, 0, 0, 0)' : 'rgb(255, 255, 255)', 'Фон вопроса соответствует адаптиву Figma');
    assert.equal(metric.contacts.paddingTop, width <= 576 ? 20 : width <= 768 ? 24 : 40);
    assert.equal(metric.contacts.paddingBottom, width <= 576 ? 20 : width <= 768 ? 24 : 40);
    const contactsReference = {
      1920: { titleGap: 80, containerLeft: 100, mapWidth: 560, height: 778, linksDirection: 'row' },
      1440: { titleGap: 48, containerLeft: 64, mapWidth: 420, height: 630, linksDirection: 'row' },
      1200: { titleGap: 48, containerLeft: 48, mapWidth: 352, height: 760, linksDirection: 'column' },
    }[width];
    if (contactsReference) {
      for (const [key, value] of Object.entries(contactsReference)) {
        if (key === 'height') {
          assert.ok(Math.abs(metric.contacts[key] - value) <= 2, 'Высота контактов с допуском округления 2px: ' + width);
        } else {
          assert.equal(metric.contacts[key], value, 'Геометрия контактов ' + width + ': ' + key);
        }
      }
    }
    // Геометрия и обрезка подтверждены отдельными макетами Figma.
    const answersReference = {
      1920: { width: 680, height: 617, titleSize: 20, textWidth: 544, textHeight: 26, truncated: true },
      1440: { width: 640, height: 545, titleSize: 24, textWidth: 568, textHeight: 52, truncated: false },
      // Figma 4193:7360 / I4224:36700;82:3105: two lines at 18/26, no truncation.
      1200: { width: 536, height: 441, titleSize: 18, textWidth: 480, textHeight: 52, truncated: false },
    }[width];
    if (answersReference) assert.deepEqual(metric.answersCard, answersReference, 'Карточка ответов соответствует макету ' + width);
    if (metric.scrollWidth > width + 1) {
      const overflowing = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width && rect.right > innerWidth + 1 && !element.closest('.marquee, .applicant-hero, .tabs, .reviews-slider, [hidden]');
      }).map(element => ({ class: element.className, right: Math.round(element.getBoundingClientRect().right) })).slice(0, 15));
      layoutFailures.push({ width, scrollWidth: metric.scrollWidth, overflowing });
    }
    assert.ok(metric.reviewShadow.shadowRight <= metric.reviewShadow.clipRight + 0.1, 'Правая тень последней карточки не обрезана на ' + width);
    assert.ok(metric.reviewShadow.nextLeft === null || metric.reviewShadow.shadowRight <= metric.reviewShadow.nextLeft + 0.1, 'Следующий слайд не перекрывает тень на ' + width);
    assert.ok(metric.studyCardsHaveTransparentCorners, "Нативная заливка не перекрывает срезы карточек на " + width);
    assert.ok(metric.loadedImages, `Missing image at ${width}`);
    assert.ok(metric.fontReady, `Unbounded unavailable at ${width}`);
    assert.deepEqual(metric.scripts, expectedScripts, 'На всех ширинах подключён одинаковый набор компонентов');
    if ([1920, 1440, 1200, 390].includes(width)) {
      await page.screenshot({ path: fileURLToPath(new URL(`${width}.png`, output)), fullPage: true, animations: 'disabled' });
      await page.locator('.applicant-hero').screenshot({ path: fileURLToPath(new URL(`hero-${width}.png`, output)), animations: 'disabled' });
    }
  }
  assert.deepEqual(layoutFailures, [], JSON.stringify(layoutFailures, null, 2));

  assert.equal(await page.locator('img:not(picture img)').count(), 0, 'Изображения размечены через picture');
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(element => getComputedStyle(element).display === 'grid').length), 0);
  assert.ok(await page.locator('.section').evaluateAll(elements => elements.every(element => {
    const style = getComputedStyle(element); return parseFloat(style.marginTop) === 0 && parseFloat(style.marginBottom) === 0;
  })), 'Вертикальные отступы секций задаются padding');

  const opportunityLinks = page.locator('.opportunities-list a.feature-card');
  assert.equal(await opportunityLinks.count(), 4, 'Возможности оформлены ссылками');
  assert.ok(await opportunityLinks.evaluateAll(links => links.every(link => link.getAttribute('href') === '#' && !link.classList.contains('js-info'))), 'Согласованные заглушки без открытия диалога');
  await opportunityLinks.first().click();
  assert.ok(await page.locator('.js-info-dialog').isHidden(), 'Ссылка возможностей не открывает диалог');

  assert.equal(await page.locator('.answers-card__arrow').count(), 3, 'Стрелки ответов — маски, без текстовых символов');
  const graphics = await page.evaluate(() => {
    const arrow = document.querySelector('.hero-link .card-arrow');
    const answers = document.querySelector('.answers-card__arrow');
    const all = document.querySelector('.js-review-all');
    const map = document.querySelector('.contact-map');
    return {
      hero: getComputedStyle(arrow).filter,
      heroMask: getComputedStyle(arrow, '::before').maskImage,
      answersMask: getComputedStyle(answers).maskImage,
      stories: getComputedStyle(all, '::after').maskImage,
      storiesSize: getComputedStyle(all, '::after').width,
      mapShadow: getComputedStyle(map).boxShadow,
      mapSize: document.querySelector('.contact-map__image').naturalWidth,
    };
  });
  assert.match(graphics.hero, /2px 2px/);
  assert.match(graphics.heroMask, /hero\/icon-arrow-up-right.svg/);
  assert.match(graphics.answersMask, /question\/icon-chevron-right.svg/);
  assert.match(graphics.stories, /reviews\/icon-arrow-up-right.svg/);
  assert.equal(graphics.storiesSize, '16px', 'Мобильная стрелка историй соответствует адаптиву 390');
  assert.match(graphics.mapShadow, /3px 3px 0px 0px/, 'Тень карты на адаптиве 390');
  assert.equal(graphics.mapSize, 560, 'Карта без запечённой внешней тени');

  const strip = page.locator('.tabs--line.js-drag-scroll');
  await strip.scrollIntoViewIfNeeded();
  await strip.evaluate(element => { element.scrollLeft = 0; });
  const selectedBeforeDrag = await page.locator('.tabs--line [aria-selected="true"]').getAttribute('id');
  const bounds = await strip.boundingBox();
  await page.mouse.move(bounds.x + bounds.width - 24, bounds.y + 20);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 24, bounds.y + 20, { steps: 12 });
  await page.mouse.up();
  assert.ok(await strip.evaluate(element => element.scrollLeft > 100), 'Перетаскивание прокручивает вкладки');
  assert.equal(await page.locator('.tabs--line [aria-selected="true"]').getAttribute('id'), selectedBeforeDrag, 'Перетаскивание не выбирает вкладку');
  await strip.evaluate(element => { element.scrollLeft = 0; });
  await strip.hover();
  await page.mouse.wheel(240, 0);
  await page.waitForTimeout(160);
  assert.ok(await strip.evaluate(element => element.scrollLeft > 0), 'Горизонтальная прокрутка колёсиком/тачпадом');
  await strip.evaluate(element => { element.scrollLeft = 0; });
  await page.locator('.tabs--line .js-tab').first().press('End');
  assert.ok(await strip.evaluate(element => element.scrollLeft > 0), 'Клавиатура открывает скрытую вкладку');
  await page.locator('.tabs--line .js-tab').last().press('Home');

  await page.locator('.education-card').first().hover();
  await page.waitForTimeout(220);
  assert.equal(await page.locator('.education-card .card-arrow').first().evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(255, 255, 255)');
  await page.locator('.study-card--paid').hover();
  await page.waitForTimeout(220);
  assert.equal(await page.locator('.study-card--paid .card-arrow').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(0, 174, 239)');

  // Панель контактов и изображение карты переключаются вместе, в том числе с клавиатуры.
  await page.locator('#contacts-tab-severodvinsk').click();
  assert.ok(await page.locator('#contacts-panel-severodvinsk').isVisible());
  assert.match(await page.locator('.js-contact-map-image').getAttribute('src'), /map-severodvinsk/);
  await page.locator('#contacts-tab-severodvinsk').press('ArrowRight');
  assert.ok(await page.locator('#contacts-panel-naryan-mar').isVisible());
  await page.locator('#contacts-tab-naryan-mar').press('Home');
  assert.ok(await page.locator('#contacts-panel-arkhangelsk').isVisible());

  // FAQ сохраняет раскрытые вопросы при переключении категории.
  await page.locator('#faq-tab-budget').click();
  const budgetQuestion = page.locator('#question-budget-0');
  await budgetQuestion.click();
  assert.ok(await page.locator('#answer-budget-0').isVisible());
  await page.locator('#faq-tab-contract').click();
  assert.ok(await page.locator('#faq-panel-contract').isVisible());
  await page.locator('#faq-tab-budget').click();
  assert.ok(await page.locator('#answer-budget-0').isVisible());

  const slideBefore = await page.locator('.js-reviews').evaluate(element => element.swiper.realIndex);
  await page.locator('.js-reviews-next').click();
  await page.waitForTimeout(650);
  const slideAfter = await page.locator('.js-reviews').evaluate(element => element.swiper.realIndex);
  assert.notEqual(slideAfter, slideBefore, 'Review navigation must change the slide');

  // Ошибки проверяются локально; заполненная форма не отправляется без обработчика.
  let submissions = 0;
  page.on('request', request => { if (request.method() === 'POST') submissions += 1; });
  await page.locator('.js-question-submit').click();
  assert.equal(await page.locator('.js-topic-trigger').getAttribute('aria-invalid'), 'true');
  await page.locator('.js-topic-trigger').click();
  await page.locator('.js-topic-trigger').press('ArrowDown');
  await page.locator('.js-topic-trigger').press('Enter');
  assert.ok(await page.locator('.js-topic-list').isVisible(), 'Мультиселект остаётся открытым после выбора');
  await page.locator('.js-topic-trigger').press('End');
  await page.locator('.js-topic-trigger').press('Space');
  assert.equal(await page.locator('.js-topic .js-field-input').inputValue(), 'budget,quota');
  await page.locator('#topic-option-budget').click();
  assert.equal(await page.locator('.js-topic .js-field-input').inputValue(), 'quota');
  await page.locator('.js-topic-trigger').press('Escape');
  await page.locator('#applicant-name').fill('Тестовый абитуриент');
  await page.locator('#applicant-email').fill('invalid');
  await page.locator('#applicant-question').fill('Как подать документы?');
  await page.locator('.js-question-submit').click();
  assert.equal(await page.locator('#applicant-email').getAttribute('aria-invalid'), 'true');
  await page.locator('#applicant-email').fill('applicant@example.com');
  await page.locator('.js-question-submit').click();
  assert.match(await page.locator('.js-form-status').textContent(), /не отправлено/);
  assert.equal(submissions, 0);
  await page.locator('#applicant-question').fill('Длинный вопрос\n'.repeat(60));
  assert.ok(await page.locator('#applicant-question').evaluate(element => {
    element.scrollTop = 100; return element.scrollTop > 0 && getComputedStyle(element).overflowY === 'auto';
  }), 'Textarea прокручивается при переполнении');
  await page.locator('.js-topic-trigger').click();
  assert.equal(await page.locator('.js-topic-list').evaluate(element => getComputedStyle(element).overflowY), 'auto');
  assert.ok(await page.locator('.js-topic-list').evaluate(element => {
    return getComputedStyle(element).position === 'absolute' && element.scrollHeight === element.clientHeight;
  }), 'Список тем раскрывается поверх полей формы и показывает все пункты');
  await page.locator('.js-topic-trigger').press('Escape');

  await page.locator('.js-footer-toggle').click();
  assert.ok(await page.locator('.js-footer-details').isVisible());
  await page.locator('.js-footer-toggle').click();
  await page.locator('.js-header-toggle[data-header-toggle="menu"]').click();
  assert.ok(await page.locator('.js-header-panel[data-header-panel="menu"]').isVisible());
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('.js-header-panel[data-header-panel="menu"]').isHidden());
  await page.locator('.js-info').first().click();
  assert.ok(await page.locator('.js-info-dialog').isVisible());
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('.js-info-dialog').isHidden());

  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.marquee__track').evaluate(element => getComputedStyle(element).animationName), 'none');
  assert.deepEqual(errors, []);

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(`${baseURL}/abiturient/`, { waitUntil: 'networkidle' });
  const touchStrip = touchPage.locator('.tabs--line.js-drag-scroll');
  await touchStrip.scrollIntoViewIfNeeded();
  await touchStrip.evaluate(element => { element.scrollLeft = 0; });
  const touchBounds = await touchStrip.boundingBox();
  const cdp = await touchContext.newCDPSession(touchPage);
  const touchPoint = x => [{ x, y: touchBounds.y + 20 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchPoint(340) });
  for (const x of [300, 240, 180, 120, 60]) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touchPoint(x) });
    await touchPage.waitForTimeout(30);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touchPage.waitForTimeout(160);
  assert.ok(await touchStrip.evaluate(element => element.scrollLeft > 0), 'Нативная сенсорная прокрутка');
  await touchContext.close();
  await writeFile(new URL('metrics.json', output), JSON.stringify(metrics, null, 2));
  console.log(`Passed: ${viewports.length} viewports, pictures/fonts, Flexbox, padding, masks, drag/keyboard/textarea scroll, separate deferred component scripts, contacts/maps, FAQ, slider, form, header/footer, dialog, reduced motion.`);
  console.log(JSON.stringify(metrics, null, 2));
} finally {
  await browser.close();
}
