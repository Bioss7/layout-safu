import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// Проверяет готовую сборку, dev и размещение во вложенном каталоге.
const bases = (
  process.env.ASSETS_TEST_URLS ||
  "http://127.0.0.1:4173,http://127.0.0.1:5174,http://127.0.0.1:4175/nested"
).split(",");
const output = new URL("../screenshots/asset-migration/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32" ? { channel: "chrome" } : {}),
});
const errors = [];
const results = [];
try {
  for (const base of bases) {
    for (const route of [
      "/",
      "/about/",
      "/programs/",
      "/programs/detail/",
      "/abiturient/",
      "/students/",
    ]) {
      const page = await browser.newPage();
      page.on("pageerror", (error) => errors.push(`${base}${route}: ${error.message}`));
      page.on("response", (response) => {
        if (response.status() >= 400 && response.url().startsWith(base))
          errors.push(`${response.status()} ${response.url()}`);
      });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(base + route, { waitUntil: "networkidle" });
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator("header.header").count(), 1);
        assert.equal(await page.locator("footer.footer").count(), 1);
        const menu = page.locator('[data-header-toggle="menu"]');
        await menu.click();
        assert.equal(await menu.getAttribute("aria-expanded"), "true");
        assert.equal(
          await page
            .locator("header.header")
            .evaluate((element) => getComputedStyle(element).position),
          "static",
          "Открытая шапка занимает место над панелью меню",
        );
        await page.keyboard.press("Escape");
        assert.equal(await menu.getAttribute("aria-expanded"), "false");
        await page.locator('[data-header-toggle="search"]').click();
        await page.locator("[data-header-query]").fill("поступление");
        await page.waitForFunction(() =>
          document.querySelector("[data-header-search-count]").textContent.includes("Найдено"),
        );
        await page.keyboard.press("Escape");
        const footer = page.locator("[data-footer-toggle]");
        await footer.click();
        assert.equal(await footer.getAttribute("aria-expanded"), "true");
        await footer.click();
        assert.equal(await footer.getAttribute("aria-expanded"), "false");
        if (route === "/students/") {
          const tab = page.locator(".js-student-services-tab").nth(1);
          await tab.click();
          assert.equal(await tab.getAttribute("aria-selected"), "true");
        }
        if (route === "/abiturient/") {
          await page.locator("#contacts-tab-severodvinsk").click();
          assert.ok(await page.locator("#contacts-panel-severodvinsk").isVisible());
          await page.locator(".js-contact-map-image").evaluate((image) => image.decode());
          assert.match(
            await page.locator(".js-contact-map-image").getAttribute("src"),
            /map-severodvinsk/,
          );
          await page.locator("#faq-tab-budget").click();
          await page.locator("#question-budget-0").click();
          assert.ok(await page.locator("#answer-budget-0").isVisible());
          const sliderReady = await page
            .locator(".js-reviews")
            .evaluate((element) => Boolean(element.swiper));
          assert.ok(sliderReady, "Общий Swiper инициализирует отзывы");
          await page.locator(".js-info").first().click();
          assert.ok(await page.locator(".js-info-dialog").isVisible());
          await page.keyboard.press("Escape");
        }
        await page.evaluate(() => scrollTo(0, 0));
        if (base === bases[0]) {
          const name = route.replaceAll("/", "_");
          await page
            .locator("header.header")
            .screenshot({ path: fileURLToPath(new URL(`header-${name}-${width}.png`, output)) });
          await page
            .locator("footer.footer")
            .screenshot({ path: fileURLToPath(new URL(`footer-${name}-${width}.png`, output)) });
        }
        results.push({ base, route, width });
      }
      await page.close();
    }
  }
  await writeFile(new URL("runtime.json", output), JSON.stringify({ results, errors }, null, 2));
  assert.deepEqual(errors, [], "Ресурсы и JavaScript во всех режимах");
  console.log(
    `Runtime: ${results.length} checks, menu/search/footer, tabs/maps/FAQ/dialog/Swiper; no errors.`,
  );
} finally {
  await browser.close();
}
