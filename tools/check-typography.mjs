import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

// Эталонные значения зафиксированы по Figma, а не вычислены из SCSS реализации.
const audit = JSON.parse(
  await readFile(new URL("../abiturient/typography-audit.json", import.meta.url), "utf8"),
);
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32" ? { channel: "chrome" } : {}),
});
const base = process.env.ABITURIENT_BASE_URL || "http://127.0.0.1:4173";
const failures = [];
try {
  const page = await browser.newPage();
  for (const width of [1920, 1440, 1200, 390]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto(base + "/abiturient/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    for (const entry of audit.entries) {
      const mismatches = await page
        .locator(entry.sampleSelector || entry.selector)
        .first()
        .evaluate((element, props) => {
          const actual = getComputedStyle(element);
          const sample = document.createElement("span");
          // Нормализуем CSS-значения браузером: em, семейства и запись text-shadow.
          for (const [key, value] of Object.entries(props)) sample.style.setProperty(key, value);
          document.body.append(sample);
          const expected = getComputedStyle(sample);
          const differences = Object.keys(props).flatMap((key) => {
            const a = actual.getPropertyValue(key),
              b = expected.getPropertyValue(key);
            const numeric =
              ["font-size", "line-height", "letter-spacing"].includes(key) &&
              a.endsWith("px") &&
              b.endsWith("px");
            return (numeric ? Math.abs(parseFloat(a) - parseFloat(b)) < 0.05 : a === b)
              ? []
              : [{ property: key, actual: a, expected: b }];
          });
          sample.remove();
          return differences;
        }, entry.expected[width]);
      if (mismatches.length) failures.push({ width, selector: entry.selector, mismatches });
    }
    for (const selector of [".js-review-all", ".answers-card .button--text"]) {
      await page.locator(selector).hover();
      await page.waitForTimeout(250);
      assert.equal(
        await page.locator(selector).evaluate((el) => getComputedStyle(el).color),
        "rgb(0, 174, 239)",
        "Акцентный hover ссылки сохраняется",
      );
    }
    const count = page.locator(".education-card--accent .education-card__count");
    assert.equal(await count.evaluate((el) => getComputedStyle(el).color), "rgb(255, 255, 255)");
    await page.locator(".education-card--accent").hover();
    assert.equal(
      await count.evaluate((el) => getComputedStyle(el).textShadow),
      "none",
      "В hover текстовая тень убрана по UI-kit",
    );
  }
  await mkdir(new URL("../screenshots/abiturient/typography/", import.meta.url), {
    recursive: true,
  });
  await writeFile(
    new URL("../screenshots/abiturient/typography/audit-result.json", import.meta.url),
    JSON.stringify({ failures }, null, 2),
  );
  assert.deepEqual(failures, [], JSON.stringify(failures, null, 2));
  console.log(
    "Типографика: " + audit.entries.length + " селекторов × 4 ширины, белый счётчик и hover — OK.",
  );
} finally {
  await browser.close();
}
