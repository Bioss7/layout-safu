import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium, expect } from "@playwright/test";

const source = JSON.parse(await readFile("schoolchildren/figma/verification.json", "utf8"));
const output = "screenshots/schoolchildren";
await mkdir(output, { recursive: true });
const port = "4185";
const base = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    port,
    "--strictPort",
  ],
  { windowsHide: true, stdio: "pipe" },
);
const report = { widths: [], geometry: {}, states: {}, errors: [], assetFailures: [] };
const widths = [
  360, 390, 460, 540, 575, 576, 577, 680, 767, 768, 769, 991, 992, 993, 1150, 1199, 1200, 1201,
  1399, 1400, 1401, 1600, 1920, 2560,
];
let browser;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      report.assetFailures.push(`${response.status()} ${response.url()}`);
  });
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}/schoolchildren/`, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      document
        .querySelectorAll('img[loading="lazy"]')
        .forEach((image) => (image.loading = "eager"));
      await Promise.all([
        document.fonts.ready,
        ...[...document.images].map((image) => image.decode()),
      ]);
    });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert(scrollWidth <= width, `Horizontal overflow at ${width}: ${scrollWidth}`);
    assert.equal(await page.locator("h1").count(), 1);
    const broken = await page
      .locator("img")
      .evaluateAll((images) =>
        images.filter((image) => !image.naturalWidth).map((image) => image.currentSrc),
      );
    assert.deepEqual(broken, []);
    report.widths.push({ width, scrollWidth });
    if ([577, 768, 992, 1400].includes(width)) {
      await page
        .locator(".school-hero")
        .screenshot({ path: `${output}/adaptive-${width}-hero.png` });
      await page
        .locator(".school-nav__grid")
        .screenshot({ path: `${output}/adaptive-${width}-nav.png` });
    }
    if (!source.frames[width]) continue;
    report.geometry[width] = [];
    for (const expected of source.frames[width]) {
      const actual = await page
        .locator(expected.selector)
        .first()
        .evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return [rect.x, rect.y + scrollY, rect.width, rect.height];
        });
      actual.forEach((value, index) =>
        assert(
          Math.abs(value - expected.rect[index]) <= source.tolerance,
          `${width} ${expected.selector}[${index}]: ${value} vs Figma ${expected.rect[index]}`,
        ),
      );
      report.geometry[width].push({ ...expected, actual });
    }
    const mobile = width === 390;
    await expect(page.locator(".school-nav__title").first()).toHaveCSS(
      "font-size",
      mobile ? "16px" : "32px",
    );
    await expect(page.locator(".school-nav__title").first()).toHaveCSS(
      "line-height",
      mobile ? "24px" : "52px",
    );
    await expect(page.locator(".student-life-card__title").first()).toHaveCSS("font-size", "20px");
    await expect(page.locator(".student-life-card__arrow").first()).toHaveCSS("width", "48px");
    await page.screenshot({ path: `${output}/${width}-loaded.png`, fullPage: true });
    const cases = [
      ["primary", ".school-hero__actions .button--primary", "rgb(0, 174, 239)", "rgb(35, 66, 96)"],
      [
        "secondary",
        ".school-nav__button.button--light",
        mobile ? "rgb(35, 66, 96)" : "rgb(0, 174, 239)",
        "rgb(182, 192, 202)",
      ],
    ];
    report.states[width] = {};
    for (const [name, selector, hover, active] of cases) {
      const button = page.locator(selector).first();
      await button.hover();
      await expect(button).toHaveCSS("background-color", hover);
      await page.mouse.down();
      await expect(button).toHaveCSS("background-color", active);
      await page.mouse.up();
      report.states[width][name] = { hover, active };
    }
    const tag = page.locator(".school-links__tag").first();
    await tag.hover();
    await expect(tag).toHaveCSS("background-color", "rgb(0, 174, 239)");
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toHaveCSS("outline-style", "solid");
    await expect(focused).toHaveCSS("outline-width", "3px");
    await page.locator(".header__menu-btn").click();
    await expect(page.locator(".header")).toHaveClass(/header--menu-open/);
    await expect(page.locator(".header")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await page.keyboard.press("Escape");
    await expect(page.locator(".header")).not.toHaveClass(/header--open/);
    await expect(page.locator(".header")).toHaveCSS("background-color", "rgba(255, 255, 255, 0.7)");
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.assetFailures, []);
  console.log(
    `Schoolchildren: ${widths.length} widths, Figma geometry, images, button states, focus and menu passed.`,
  );
} finally {
  await writeFile(`${output}/check-report.json`, JSON.stringify(report, null, 2) + "\n");
  await browser?.close();
  server.kill();
}
