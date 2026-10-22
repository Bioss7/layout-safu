import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const baseline = process.argv.includes('--baseline');
const out = new URL('../screenshots/abiturient/390/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400 && r.url().startsWith('http://127.0.0.1:4173')) errors.push(`${r.status()} ${r.url()}`); });
const results = [];
try {
  for (const width of [390, 391, 576, 768, 992, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('http://127.0.0.1:4173/abiturient/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every(i => i.complete));
    const result = await page.evaluate(() => {
      const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
      const sections = [...document.querySelectorAll('main > section')].map(el => ({ selector: el.className, ...rect(el), paddingTop: getComputedStyle(el).paddingTop, paddingBottom: getComputedStyle(el).paddingBottom }));
      const protectedRegion = selector => {
        const root = document.querySelector(selector); const origin = root.getBoundingClientRect();
        return [...root.querySelectorAll('*')].map(el => {
          const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
          return { tag: el.tagName, class: el.className, x: r.x, y: Math.round((r.y - origin.y) * 100) / 100, width: r.width, height: r.height, font: s.font, color: s.color, background: s.background, padding: s.padding, margin: s.margin, display: s.display };
        });
      };
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, sections, header: protectedRegion('.header'), footer: protectedRegion('.footer'), brokenImages: [...document.images].filter(i => !i.naturalWidth).map(i => i.src) };
    });
    if (width === 390) {
      await page.screenshot({ path: fileURLToPath(new URL(baseline ? 'before.png' : 'after.png', out)), fullPage: true });
      if (!baseline) for (const [name, selector] of Object.entries({ hero: '.applicant-hero', banner: '.section--banner', education: '.section--education', admission: '.section--admission', opportunities: '.section--opportunities', contacts: '.section--contacts', reviews: '.section--reviews', faq: '.section--faq', question: '.section--question' })) await page.locator(selector).screenshot({ path: fileURLToPath(new URL(name + '.png', out)) });
    }
    results.push(result);
  }
  await writeFile(new URL(baseline ? 'baseline.json' : 'metrics.json', out), JSON.stringify(results, null, 2));
  assert.deepEqual(errors, [], 'No JS or local HTTP errors');
  if (!baseline) {
    const before = JSON.parse(await readFile(new URL('baseline.json', out)));
    for (const r of results) {
      assert.ok(r.scrollWidth <= r.width, `No overflow at ${r.width}`);
      assert.deepEqual(r.brokenImages, [], `Images loaded at ${r.width}`);
      const b = before.find(b => b.width === r.width);
      // У скрытых элементов и SVG defs нулевая геометрия не привязана к родителю.
      const visibleGeometry = items => items.map(item => item.width === 0 && item.height === 0 ? { ...item, y: 0 } : item);
      assert.deepEqual(visibleGeometry(r.header), visibleGeometry(b.header), `Header unchanged at ${r.width}`);
      assert.deepEqual(visibleGeometry(r.footer), visibleGeometry(b.footer), `Footer unchanged at ${r.width}`);
      if (r.width !== 390) assert.deepEqual(r.sections, b.sections, `Other viewport unchanged at ${r.width}`);
      if (r.width === 390) {
        // У бакалавриата сохранён содержательный текст: карточка выше эталона на 20px.
        const heights = [1147, 232, 1422, 3267, 1628, 1546, 585, 1480, 1427];
        r.sections.forEach((section, index) => {
          assert.ok(Math.abs(section.height - heights[index]) <= 1, `Figma height: ${section.selector}`);
          if (index) {
            const previous = r.sections[index - 1];
            assert.equal(section.y - previous.y - previous.height, 70, `Section gap: ${section.selector}`);
          }
        });
      }
    }
  }
  console.log(JSON.stringify(results.map(({ width, scrollWidth, sections }) => ({ width, scrollWidth, sections })), null, 2));
} finally { await browser.close(); }

