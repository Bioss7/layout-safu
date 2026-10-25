import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32" ? { channel: "chrome" } : {}),
});
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  for (const width of [1920, 1200, 768, 390]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto(`${process.env.ABITURIENT_BASE_URL || "http://127.0.0.1:4173"}/abiturient/`, {
      waitUntil: "networkidle",
    });
    const dots = page.locator(".js-review-dot");
    const center = width === 390 ? 1 : 2;
    assert.equal(
      await page.locator(".js-reviews").evaluate((e) => e.swiper.realIndex),
      0,
      "First review remains first",
    );
    assert.equal(
      await dots.nth(center).getAttribute("aria-current"),
      "true",
      `Figma center indicator at ${width}`,
    );
    assert.equal(
      await dots.nth(center).evaluate((e) => getComputedStyle(e).backgroundColor),
      "rgb(0, 174, 239)",
    );
    for (let i = 0; i < (await dots.count()); i++) {
      const expected = Number((await dots.nth(i).getAttribute("aria-label")).match(/\d+/)[0]) - 1;
      await dots.nth(i).click();
      await page.waitForFunction(
        (expected) => document.querySelector(".js-reviews").swiper.realIndex === expected,
        expected,
      );
      assert.equal(await page.locator('.js-review-dot[aria-current="true"]').count(), 1);
    }
    await dots.nth(center).click();
    await page.waitForFunction(() => document.querySelector(".js-reviews").swiper.realIndex === 0);
    const firstReview = await page
      .locator(".swiper-slide-active .review-card__video")
      .first()
      .getAttribute("src");
    await page.setViewportSize({ width: width === 390 ? 768 : 390, height: 1080 });
    assert.equal(
      await page.locator(".swiper-slide-active .review-card__video").first().getAttribute("src"),
      firstReview,
      "First visible review survives regrouping",
    );
  }
  console.log(
    "Pagination: Figma state, colors, every dot target, accessible labels and resize — OK.",
  );
} finally {
  await browser.close();
}
