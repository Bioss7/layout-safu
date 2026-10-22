import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

// Эталоны: Figma 4209:32247 и 4209:32851, проверены 2026-10-22.
// Позиции отсчитываются от hero: шапка остаётся вне задачи.
const baseURL = process.env.ABITURIENT_BASE_URL || 'http://127.0.0.1:4173';
const output = new URL('../screenshots/abiturient/current-audit/', import.meta.url);
await mkdir(output, { recursive: true });
const sections = {
  hero: '.applicant-hero',
  banner: '.apply-banner',
  education: '.section--education > .container',
  admission: '.section--admission',
  opportunities: '.section--opportunities > .container',
  contacts: '.section--contacts',
  reviews: '.section--reviews > .container',
  faq: '#faq',
  question: '.question__surface',
};
const references = {
  992: [
    [0, 741], [805, 138], [1007, 937], [2008, 2128], [4200, 576],
    [4840, 608], [5512, 702], [6278, 814], [7156, 1290.239],
  ],
  768: [
    [0, 1146.671], [1210.671, 138], [1412.671, 804], [2280.671, 1656],
    [4000.671, 1484], [5548.671, 1014.709], [6627.38, 562.667],
    [7254.046, 1260], [8578.047, 1146.687],
  ],
};
const near = (actual, expected, message) => assert.ok(
  Math.abs(actual - expected) < 0.6, `${message}: ${actual}, ожидается ${expected}`,
);
const baseline = await readFile(new URL('baseline.json', output), 'utf8')
  .then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'chrome' } : {}) });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  if (response.url().startsWith(baseURL) && response.status() >= 400) errors.push(response.url());
});
const measurements = {};
try {
  for (const width of [992, 768]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto(`${baseURL}/abiturient/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every(image => image.complete));
    await page.mouse.move(0, 0);
    const origin = (await page.locator('.applicant-hero').boundingBox()).y;
    measurements[width] = {};
    let index = 0;
    for (const [name, selector] of Object.entries(sections)) {
      const box = await page.locator(selector).boundingBox();
      const absoluteY = box.y + await page.evaluate(() => scrollY);
      const [y, height] = references[width][index++];
      near(absoluteY - origin, y, `${width}: ${name}, положение`);
      near(box.height, height, `${width}: ${name}, высота`);
      measurements[width][name] = { ...box, y: absoluteY };
      await page.locator(selector).screenshot({
        path: fileURLToPath(new URL(`${name}-after-${width}.png`, output)), animations: 'disabled',
      });
    }
    const box = selector => page.locator(selector).first().evaluate(element => {
      const r = element.getBoundingClientRect(); return [r.x, r.width, r.height];
    });
    const education = await box('.education-card');
    const card = await box('.study-card');
    const map = await box('.contact-map');
    const review = await box('.swiper-slide-active .review-card');
    near(education[1], width === 992 ? 456 : 352, `${width}: ширина образования`);
    near(education[2], width === 992 ? 275 : 220, `${width}: высота образования`);
    near(card[1], width === 992 ? 452 : 352, `${width}: карточки поступления`);
    near(card[2], card[1], `${width}: квадратные карточки поступления`);
    near(map[1], width === 992 ? 312 : 352, `${width}: карта`);
    near(review[1], width === 992 ? 449 : 348, `${width}: ширина отзыва`);
    near(review[2], width === 992 ? 536 : 404.667, `${width}: высота отзыва`);
    const firstTab = page.locator('.contacts__content .tabs__tab').first();
    await firstTab.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('.contacts__content .tabs__tab').nth(1).getAttribute('aria-selected'), 'true');
    await firstTab.click();
    const budget = page.locator('#faq-tab-budget');
    await budget.click();
    const question = page.locator('#faq-panel-budget .accordion__trigger').first();
    await question.click();
    const expanded = await question.getAttribute('aria-expanded');
    await page.locator('#faq-tab-contract').click();
    await budget.click();
    assert.equal(await question.getAttribute('aria-expanded'), expanded, 'FAQ сохраняет состояние');
    const first = await page.locator('.js-reviews').evaluate(element => element.swiper.realIndex);
    await page.locator('.js-reviews-next').click();
    await page.waitForFunction(index => document.querySelector('.js-reviews').swiper.realIndex !== index, first);
    await page.locator('.question-form__submit').click();
    assert.ok(await page.locator('.form-field--error').count(), 'Пустая форма показывает ошибки');
  }
  // Проверяем границы точек, промежутки и исходные варианты без перестройки макетов.
  for (const width of [1920, 1440, 1200, 993, 992, 991, 950, 901, 900, 899, 769, 768, 767, 600, 460, 391, 390]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto(`${baseURL}/abiturient/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every(image => image.complete));
    await page.mouse.move(0, 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Переполнение ${width}`);
    assert.equal(await page.locator('img').evaluateAll(images => images.filter(image => !image.complete || !image.naturalWidth).length), 0, `Ресурсы ${width}`);
    if (!baseline?.[width]) continue;
    for (const selector of ['.header', '.footer']) {
      const actual = await page.locator(selector).evaluate(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height, html: element.outerHTML }));
      assert.deepEqual(actual, baseline[width][selector], `${selector} сохранён на ${width}`);
    }
    if ([1920, 1440, 1200, 390].includes(width)) {
      for (const [selector, expected] of Object.entries(baseline[width])) {
        const actual = await page.locator(selector).boundingBox();
        near(actual.width, expected.width, `${width}: ширина ${selector}`);
        near(actual.height, expected.height, `${width}: высота ${selector}`);
      }
      for (const [name, selector] of Object.entries({ hero: '.applicant-hero', banner: '.apply-banner', education: '.section--education', admission: '.section--admission', opportunities: '.section--opportunities', contacts: '.section--contacts', reviews: '.section--reviews', faq: '#faq', question: '.section--question' })) {
        const screenshot = await page.locator(selector).screenshot({ animations: 'disabled' });
        const original = await readFile(new URL(`${name}-before-${width}.png`, output));
        const currentPixels = await sharp(screenshot).ensureAlpha().raw().toBuffer();
        const originalPixels = await sharp(original).ensureAlpha().raw().toBuffer();
        assert.equal(currentPixels.length, originalPixels.length, `${width}: размер снимка ${name}`);
        let changed = 0;
        for (let i = 0; i < currentPixels.length; i += 4) {
          if ([0, 1, 2].some(channel => currentPixels[i + channel] !== originalPixels[i + channel])) changed++;
        }
        // Chrome иногда иначе растеризует несколько пикселей SVG при том же масштабе.
        // Геометрия выше проверяется отдельно; допускается не более 0.02% пикселей.
        assert.ok(changed / (currentPixels.length / 4) <= 0.0002, `${width}: пиксели ${name}: изменено ${changed}`);
      }
    }
  }
  await writeFile(new URL('measurements.json', output), JSON.stringify(measurements, null, 2));
  assert.deepEqual(errors, []);
  console.log('Passed: Figma 992/768, navigation/FAQ/slider/form, 17 widths, resources, header/footer and baseline regressions.');
} finally { await browser.close(); }
