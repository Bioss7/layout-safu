import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32" ? { channel: "chrome" } : {}),
});
const page = await browser.newPage();
const baseURL = process.env.ABITURIENT_BASE_URL || "http://127.0.0.1:4174";
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const near = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) <= 1, `${label}: ${actual}, expected ${expected}`);
const rect = (selector) => page.locator(selector).first().evaluate((element) => {
  const r = element.getBoundingClientRect();
  return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height };
});

try {
  for (const width of [576, 390]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto(`${baseURL}/abiturient/`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const hero = await rect(".applicant-hero");
    near(hero.height, width === 390 ? 1289 : 1253, `${width}: hero`);
    // Figma 4209:32079–32081 / 4209:33498–33500.
    near((await rect(".hero-link")).height, width === 390 ? 48 : 64, `${width}: hero link`);
    if (width === 390) {
      near((await rect(".applicant-hero__art")).y - hero.y, 826, "390: hero art");
      const card = await rect(".answers-card");
      near((await rect(".answers-card__header")).x - card.x, 16, "390: answers inset");
      near((await rect(".answers-card__header")).width, 326, "390: answers content");
    } else {
      // Figma 4244:11634–11636 / 4270:6080.
      const title = await rect(".education-card--accent .education-card__title");
      const description = await rect(".education-card--accent .education-card__description");
      near(description.y - title.y - title.height, 16, "576: bachelor gap");
    }
    near((await rect(".feature-card .card-arrow")).width, width === 390 ? 40 : 32, `${width}: feature arrow`);
    const transform = await page.locator(".section--admission").evaluate((element) =>
      getComputedStyle(element, "::before").transform);
    assert.equal(transform, "matrix(1, 0, 0, -1, 0, 0)", `${width}: admission transition`);
    // Figma 4272:6309–6329 / 4209:32178–32191.
    const review = await rect(".swiper-slide-active .review-card");
    near(review.width, 348, `${width}: review width`);
    near(review.height, 404.6667, `${width}: review height`);
    const text = await rect(".swiper-slide-active .review-card__text");
    near(text.height, 66, `${width}: review excerpt`);
    near((await rect(".swiper-slide-active .review-card__link")).y - review.y, 359.6667, `${width}: review link`);
    assert.equal(await page.locator(".review-card__media").first().evaluate((element) =>
      getComputedStyle(element, "::before").display), "block", `${width}: orbit visible`);

    const firstTab = page.locator(".contacts__content .tabs__tab").first();
    await firstTab.focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator(".contacts__content .tabs__tab").nth(1).getAttribute("aria-selected"), "true");
    await firstTab.click();
    const trigger = page.locator("#faq-panel-budget .accordion__trigger").first();
    await page.locator("#faq-tab-budget").click();
    await trigger.click();
    const expanded = await trigger.getAttribute("aria-expanded");
    await page.locator("#faq-tab-contract").click();
    await page.locator("#faq-tab-budget").click();
    assert.equal(await trigger.getAttribute("aria-expanded"), expanded);
    const index = await page.locator(".js-reviews").evaluate((element) => element.swiper.realIndex);
    await page.locator(".js-reviews-next").click();
    await page.waitForFunction((previous) => document.querySelector(".js-reviews").swiper.realIndex !== previous, index);
    await page.locator(".question-form__submit").click();
    assert.ok(await page.locator(".form-field--error").count());
  }
  assert.deepEqual(errors, []);
  console.log("Passed: Figma mobile geometry, contacts keyboard, FAQ, slider, empty form validation (576/390).");
} finally {
  await browser.close();
}
