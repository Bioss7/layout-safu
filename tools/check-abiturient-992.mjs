import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Эталон Figma 4209:32247. Шапка и подвал проверяются по локальному снимку до правок.
const baseURL = process.env.ABITURIENT_BASE_URL || 'http://127.0.0.1:4173';
const output = new URL('../screenshots/abiturient/adaptive-992/', import.meta.url);
await mkdir(output, { recursive: true });
const references = {
  hero: ['.applicant-hero', 0, 935],
  banner: ['.apply-banner', 999, 138],
  education: ['.section--education > .container', 1201, 937],
  admission: ['.section--admission', 2202, 2170],
  opportunities: ['.section--opportunities > .container', 4436, 576],
  contacts: ['.section--contacts', 5076, 608],
  reviews: ['.section--reviews > .container', 5748, 702],
  faq: ['#faq', 6514, 814],
  question: ['.question__surface', 7392, 1290.239],
};
// Independently rounded CSS dimensions may differ from fractional Figma geometry by 2px.
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) <= 2, `${message}: ${actual} / ${expected}`);
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'chrome' } : {}) });
const page = await browser.newPage();
const failures = [];
page.on('pageerror', error => failures.push(error.message));
page.on('response', response => { if (response.url().startsWith(baseURL) && response.status() >= 400) failures.push(response.url()); });
try {
  await page.setViewportSize({ width: 992, height: 1080 });
  await page.goto(`${baseURL}/abiturient/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  for (const [name, [selector, y, height]] of Object.entries(references)) {
    const box = await page.locator(selector).boundingBox();
    near(box.y + await page.evaluate(() => scrollY), y, `${name}: положение`);
    near(box.height, height, `${name}: высота`);
    await page.locator(selector).screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)) });
  }
  const geometry = await page.evaluate(() => {
    const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return [r.x, r.width, r.height]; };
    const style = (selector, property) => getComputedStyle(document.querySelector(selector))[property];
    return {
      education: box('.education-card'), international: box('.education-card--international'),
      admission: box('.study-card'), review: box('.swiper-slide-active .review-card'),
      map: box('.contact-map'), links: box('.contacts__links'),
      faqGap: style('.faq__panel:not([hidden]) .faq__columns', 'gap'),
      titleGap: style('#faq .section-header', 'marginBottom'),
      questionDirection: style('.question__layout', 'flexDirection'),
      cards: document.querySelectorAll('.swiper-slide-active .review-card').length,
      titleFont: style('.section--education .title-2', 'fontSize'),
      form: box('.question-form'), answers: box('.answers-card'),
    };
  });
  assert.deepEqual(geometry.education, [32, 456, 275]);
  assert.deepEqual(geometry.international, [32, 928, 275]);
  assert.deepEqual(geometry.admission, [32, 452, 452]);
  near(geometry.review[1], 449, 'Ширина отзыва');
  near(geometry.review[2], 536, 'Высота отзыва');
  assert.equal(geometry.cards, 2);
  assert.deepEqual(geometry.map, [32, 312, 312]);
  assert.deepEqual(geometry.links, [32, 928, 88]);
  assert.equal(geometry.faqGap, '24px');
  assert.equal(geometry.titleGap, '40px');
  assert.equal(geometry.titleFont, '32px');
  assert.equal(geometry.questionDirection, 'column');
  near(geometry.form[2], 662, 'Высота формы');
  near(geometry.answers[2], 444.239, 'Высота ответов');
  await writeFile(new URL('geometry.json', output), JSON.stringify(geometry, null, 2));

  // На 992 проверяем работу двух колонок FAQ и сохранение раскрытого ответа.
  await page.locator('#faq-tab-budget').click();
  const trigger = page.locator('#faq-panel-budget .accordion__trigger').first();
  await trigger.click();
  const expanded = await trigger.getAttribute('aria-expanded');
  await page.locator('#faq-tab-contract').click();
  await page.locator('#faq-tab-budget').click();
  assert.equal(await trigger.getAttribute('aria-expanded'), expanded);
  const before = await page.locator('.js-reviews').evaluate(element => element.swiper.realIndex);
  await page.locator('.js-reviews .arrow-btn').last().click();
  await page.waitForTimeout(500);
  assert.notEqual(await page.locator('.js-reviews').evaluate(element => element.swiper.realIndex), before);

  const baseline = JSON.parse(await readFile(new URL('../screenshots/abiturient/before-992/chrome.json', import.meta.url), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return '{}';
    throw error;
  }));
  for (const width of [1920, 1440, 1200, 993, 992, 991, 950, 901, 900, 899, 769, 768, 767, 390]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto(`${baseURL}/abiturient/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Переполнение на ${width}`);
    if (baseline[width]) for (const selector of ['header', 'footer']) {
      const actual = await page.locator(`.${selector}`).evaluate(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height, html: element.outerHTML }));
      assert.deepEqual(actual, baseline[width][`.${selector}`], `${selector} не изменился на ${width}`);
    }
    assert.equal(await page.locator('img').evaluateAll(images => images.filter(image => !image.complete || !image.naturalWidth).length), 0, `Изображения ${width}`);
  }
  const styles = new URL('../abiturient/assets/scss/blocks/', import.meta.url);
  for (const name of await readdir(styles)) if (name.endsWith('.scss')) assert.doesNotMatch(await readFile(new URL(name, styles), 'utf8'), /\bclamp\s*\(/, name);
  assert.deepEqual(failures, []);
  console.log('Passed: Figma 992 geometry, FAQ/Swiper, 14 widths, resources, unchanged header/footer, no clamp.');
} finally { await browser.close(); }
