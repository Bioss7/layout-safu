import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const source = JSON.parse(
  await readFile(new URL("../abiturient/alignment-audit.json", import.meta.url), "utf8"),
);
const output = new URL("../screenshots/abiturient/figma-alignment/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32" ? { channel: "chrome" } : {}),
});
const baseURL = process.env.ABITURIENT_BASE_URL || "http://127.0.0.1:4173";
const widths = [1920, 1440, 1200, 992, 768, 576, 390];
const selectors = [
  ".applicant-hero",
  ".section--banner .apply-banner",
  ".section--education > .container",
  ".section--admission",
  ".section--opportunities > .container",
  ".section--contacts",
  ".section--reviews > .container",
  "#faq",
  ".section--question .question__surface",
];
const failures = [];
const metrics = [];
const errors = [];
const metricsOnly = process.argv.includes("--metrics-only");

function compare(width, selector, property, actual, expected) {
  if (Math.abs(actual - expected) > 2)
    failures.push({ width, selector, property, actual, expected });
}

try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(baseURL) && response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto(`${baseURL}/abiturient/`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every((image) => image.complete));
    const result = await page.evaluate((selectors) => {
      const rect = (element) => {
        const value = element.getBoundingClientRect();
        return { x: value.x, y: value.y + scrollY, width: value.width, height: value.height };
      };
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        sections: selectors.map((selector) => ({
          selector,
          ...rect(document.querySelector(selector)),
        })),
        anchors: [
          ".header",
          ".marquee",
          ".breadcrumbs__list",
          ".applicant-hero__status",
          ".applicant-hero__links",
        ].map((selector) => ({ selector, ...rect(document.querySelector(selector)) })),
        footer: rect(document.querySelector(".footer")),
        brokenImages: [...document.images]
          .filter((image) => !image.naturalWidth)
          .map((image) => image.src),
      };
    }, selectors);
    const frame = source.frames.find((frame) => frame.width === width);
    let roundedY = 0;
    for (const [index, section] of result.sections.entries()) {
      const expected = frame.sections[index];
      if (index) {
        const previous = frame.sections[index - 1];
        roundedY +=
          Math.round(previous.height) + Math.round(expected.y - previous.y - previous.height);
      }
      // The existing bachelor description is deliberately retained on mobile;
      // unlike the duplicated SPO copy in Figma it requires an extra text line.
      const copyShift = width === 390 && index >= 3 ? 20 : 0;
      compare(width, section.selector, "y", section.y, roundedY + copyShift);
      compare(
        width,
        section.selector,
        "height",
        section.height,
        expected.height + (width === 390 && index === 2 ? 20 : 0),
      );
    }
    assert.equal(result.scrollWidth, width, `No horizontal overflow at ${width}`);
    assert.deepEqual(result.brokenImages, [], `All local images load at ${width}`);
    compare(
      width,
      ".marquee",
      "top equals header bottom",
      result.anchors[1].y,
      result.anchors[0].y + result.anchors[0].height,
    );
    const hero = frame.sections[0];
    const status = hero.children.find(
      (child) => child.name === "LeftBox" || (width === 390 && child.name === "Content Block"),
    );
    const breadcrumbs = hero.children.find((child) => child.name === "Breadcrumbs");
    compare(width, "hero status", "y", result.anchors[3].y, status.y);
    compare(width, "hero breadcrumbs", "y", result.anchors[2].y, breadcrumbs.y);
    if (!metricsOnly) {
      await page.screenshot({
        path: fileURLToPath(new URL(`page-${width}.png`, output)),
        fullPage: true,
      });
      await page
        .locator(".applicant-hero")
        .screenshot({ path: fileURLToPath(new URL(`hero-${width}.png`, output)) });
    }
    metrics.push(result);
  }
  for (const width of metricsOnly
    ? []
    : [
        2560, 1921, 1441, 1439, 1201, 1199, 1151, 1150, 1149, 993, 991, 901, 900, 899, 769, 767,
        681, 680, 679, 577, 575, 541, 540, 539, 461, 460, 459, 391,
      ]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto(`${baseURL}/abiturient/`, { waitUntil: "networkidle" });
    const geometry = await page.evaluate(() => {
      const hero = document.querySelector(".applicant-hero").getBoundingClientRect();
      const links = document.querySelector(".applicant-hero__links").getBoundingClientRect();
      const header = document.querySelector(".header").getBoundingClientRect();
      const marquee = document.querySelector(".marquee").getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        heroBottom: hero.bottom,
        linksBottom: links.bottom,
        bodyWidth: document.body.getBoundingClientRect().width,
        headerBottom: header.bottom,
        marqueeTop: marquee.top,
      };
    });
    if (geometry.overflow)
      failures.push({ width, selector: "document", property: "horizontal overflow" });
    if (geometry.linksBottom > geometry.heroBottom)
      failures.push({ width, selector: ".hero-link", property: "clipped below hero" });
    if (geometry.bodyWidth > 1920)
      failures.push({ width, selector: "body", property: "width above 1920" });
    compare(
      width,
      ".marquee",
      "top equals header bottom",
      geometry.marqueeTop,
      geometry.headerBottom,
    );
  }
  await writeFile(new URL("metrics.json", output), JSON.stringify(metrics, null, 2));
  await writeFile(
    new URL("result.json", output),
    JSON.stringify({ source: "alignment-audit.json", widths, failures, errors }, null, 2),
  );
  assert.deepEqual(errors, [], "No JavaScript or local resource errors");
  assert.deepEqual(failures, [], JSON.stringify(failures, null, 2));
  console.log(
    `Figma alignment: seven frames${metricsOnly ? "" : " and 28 neighboring widths"} — OK. Footer geometry recorded for review only.`,
  );
} finally {
  await browser.close();
}
