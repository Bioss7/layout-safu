import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

// Ожидания берутся только из сохранённых контекстов Figma.
const audit = JSON.parse(
  await readFile(new URL("../abiturient/typography-audit.json", import.meta.url), "utf8"),
);
const widths = audit.widths;
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32" ? { channel: "chrome" } : {}),
});
const base = process.env.ABITURIENT_BASE_URL || "http://127.0.0.1:4173";
const failures = [],
  coverage = [];
try {
  const page = await browser.newPage();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1080 });
    await page.mouse.move(0, 0);
    await page.goto(base + "/abiturient/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const fonts = await page.evaluate(() =>
      ["Montserrat", "Unbounded"].filter(
        (family) =>
          ![...document.fonts].some(
            (font) => font.family.replace(/["']/g, "") === family && font.status === "loaded",
          ),
      ),
    );
    if (fonts.length) failures.push({ width, fontsNotLoaded: fonts });
    for (const entry of audit.entries) {
      assert.ok(entry.expected[width], `Нет Figma-эталона ${entry.selector} на ${width}`);
      const result = await page.locator(entry.selector).evaluateAll(
        (elements, { entry, width }) => {
          const results = [];
          let visible = 0;
          for (const [index, element] of elements.entries()) {
            if (
              !element.checkVisibility({ checkVisibilityCSS: true }) ||
              !element.getClientRects().length
            )
              continue;
            visible++;
            const props = { ...entry.expected[width] };
            for (const override of entry.overrides || []) {
              if (element.matches(override.selector))
                Object.assign(props, override.expected[width]);
            }
            const actual = getComputedStyle(element),
              sample = document.createElement("span");
            for (const [key, value] of Object.entries(props)) sample.style.setProperty(key, value);
            document.body.append(sample);
            const expected = getComputedStyle(sample);
            const mismatches = Object.keys(props).flatMap((property) => {
              const a = actual.getPropertyValue(property),
                b = expected.getPropertyValue(property);
              const numeric = ["font-size", "line-height", "letter-spacing"].includes(property);
              const number = (value) =>
                property === "letter-spacing" && value === "normal"
                  ? 0
                  : value.endsWith("px")
                    ? parseFloat(value)
                    : NaN;
              const close =
                numeric &&
                Number.isFinite(number(a)) &&
                Number.isFinite(number(b)) &&
                Math.abs(number(a) - number(b)) < 0.05;
              const shadowClose =
                property === "text-shadow" &&
                a.replace(/[\d.]+/g, "#") === b.replace(/[\d.]+/g, "#") &&
                (a.match(/[\d.]+/g) || []).every(
                  (v, i) => Math.abs(Number(v) - Number(b.match(/[\d.]+/g)[i])) < 0.05,
                );
              return a === b || close || shadowClose ? [] : [{ property, actual: a, expected: b }];
            });
            sample.remove();
            if (mismatches.length)
              results.push({
                index,
                id: element.id || undefined,
                text: element.textContent.trim().replace(/\s+/g, " ").slice(0, 90),
                mismatches,
              });
          }
          return { matched: elements.length, visible, results };
        },
        { entry, width },
      );
      coverage.push({
        width,
        selector: entry.selector,
        matched: result.matched,
        checked: result.visible,
      });
      if (!result.visible)
        failures.push({ width, selector: entry.selector, error: "Нет видимых экземпляров" });
      for (const resultEntry of result.results)
        failures.push({ width, selector: entry.selector, ...resultEntry });
    }
    for (const selector of [".js-review-all", ".answers-card .button--text"]) {
      await page.locator(selector).hover();
      await page.waitForTimeout(250);
      const color = await page.locator(selector).evaluate((el) => getComputedStyle(el).color);
      if (color !== "rgb(0, 174, 239)") failures.push({ width, selector, state: "hover", color });
    }
    const count = page.locator(".education-card--accent .education-card__count");
    const color = await count.evaluate((el) => getComputedStyle(el).color);
    if (color !== "rgb(255, 255, 255)")
      failures.push({ width, selector: ".education-card--accent .education-card__count", color });
    await page.locator(".education-card--accent").hover();
    const shadow = await count.evaluate((el) => getComputedStyle(el).textShadow);
    if (shadow !== "none")
      failures.push({
        width,
        selector: ".education-card--accent .education-card__count",
        state: "hover",
        shadow,
      });
  }
  await mkdir(new URL("../screenshots/abiturient/typography/", import.meta.url), {
    recursive: true,
  });
  await writeFile(
    new URL("../screenshots/abiturient/typography/audit-result.json", import.meta.url),
    JSON.stringify({ widths, coverage, failures }, null, 2),
  );
  assert.deepEqual(failures, [], JSON.stringify(failures, null, 2));
  console.log(
    `Типографика: ${audit.entries.length} селекторов × ${widths.length} ширин, ${coverage.reduce((sum, row) => sum + row.checked, 0)} видимых экземпляров, шрифты и hover — OK.`,
  );
} finally {
  await browser.close();
}
