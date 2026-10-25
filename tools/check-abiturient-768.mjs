import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const fixture = JSON.parse(
  await readFile(new URL("../abiturient/audit-768.json", import.meta.url), "utf8"),
);
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32" ? { channel: "chrome" } : {}),
});
const page = await browser.newPage({ viewport: { width: fixture.width, height: 1080 } });
const failures = [];
const measurements = [];
try {
  await page.goto(`${process.env.ABITURIENT_BASE_URL || "http://127.0.0.1:4173"}/abiturient/`, {
    waitUntil: "networkidle",
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  for (const expected of fixture.entries) {
    const actual = await page
      .locator(expected.selector)
      .first()
      .evaluate((e, origin) => {
        const r = e.getBoundingClientRect();
        const s = getComputedStyle(e);
        return {
          originY: document.querySelector(origin).getBoundingClientRect().y + scrollY,
          rect: { x: r.x, y: r.y + scrollY, width: r.width, height: r.height },
          typography: {
            fontFamily: s.fontFamily,
            fontSize: parseFloat(s.fontSize),
            fontWeight: +s.fontWeight,
            lineHeight: parseFloat(s.lineHeight),
            letterSpacing: parseFloat(s.letterSpacing) || 0,
          },
        };
      }, expected.origin.selector);
    measurements.push({ ...expected, actual });
    for (const key of expected.fields) {
      // Compare internal Y relative to its section, independently of preceding sections.
      const tolerance = key === "y" ? 2 : 1;
      const delta =
        key === "y"
          ? actual.rect.y - actual.originY - expected.rect.y + expected.origin.y
          : actual.rect[key] - expected.rect[key];
      if (Math.abs(delta) > tolerance)
        failures.push({
          selector: expected.selector,
          nodeId: expected.nodeId,
          key,
          expected: expected.rect[key],
          actual: actual.rect[key],
          delta,
        });
    }
    for (const [key, value] of Object.entries(expected.typography || {})) {
      if (
        key === "fontFamily"
          ? !actual.typography[key].includes(value)
          : Math.abs(actual.typography[key] - value) > 0.05
      )
        failures.push({
          selector: expected.selector,
          nodeId: expected.nodeId,
          key,
          expected: value,
          actual: actual.typography[key],
        });
    }
  }
  const details = await page.evaluate(() => ({
    heroLinkRight: getComputedStyle(document.querySelector(".hero-link")).paddingRight,
    transitionTop: getComputedStyle(document.querySelector(".section--admission"), "::before")
      .height,
    transitionBottom: getComputedStyle(document.querySelector(".section--admission"), "::after")
      .height,
    heroPeople: document.querySelector(".applicant-hero__people").getBoundingClientRect().toJSON(),
    icons: [...document.querySelectorAll(".study-card__icon img")].map((i) => ({
      src: i.currentSrc,
      width: i.getBoundingClientRect().width,
      height: i.getBoundingClientRect().height,
    })),
  }));
  assert.equal(details.heroLinkRight, "16px");
  assert.equal(details.transitionTop, "74px");
  assert.equal(details.transitionBottom, "73px");
  assert.ok(Math.abs(details.heroPeople.y - 804.6582641601562) < 1);
  assert.ok(details.icons.every((i) => i.src.endsWith("-768.svg")));
  await mkdir("screenshots/abiturient/audit-768", { recursive: true });
  await writeFile(
    "screenshots/abiturient/audit-768/node-comparison.json",
    JSON.stringify({ source: fixture.frameId, measurements, details, failures }, null, 2),
  );
  console.log(JSON.stringify({ nodes: measurements.length, failures }, null, 2));
  assert.deepEqual(failures, []);
} finally {
  await browser.close();
}
