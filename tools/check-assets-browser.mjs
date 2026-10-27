import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const base = process.env.ASSETS_BASE_URL || "http://127.0.0.1:4173";
const mode = process.argv.includes("--baseline") ? "before" : "after";
const output = new URL("../screenshots/asset-migration/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32" ? { channel: "chrome" } : {}),
});
const routes = ["/", "/about/", "/programs/", "/programs/detail/", "/abiturient/", "/students/"];
const widths = [1920, 1440, 1200, 992, 768, 576, 390];
const results = [];
const errors = [];
try {
  for (const route of routes) {
    const page = await browser.newPage();
    page.on("pageerror", (error) => errors.push(`${route}: ${error.message}`));
    page.on("response", (response) => {
      if (response.status() >= 400 && response.url().startsWith(base))
        errors.push(`${response.status()} ${response.url()}`);
    });
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + route, { waitUntil: "networkidle" });
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images].map((image) => {
            image.loading = "eager";
            return image.decode().catch(() => {});
          }),
        );
      });
      await page.evaluate(() => document.fonts.ready);
      const metrics = await page.evaluate(() => {
        const main = document.querySelector("main");
        const rect = main.getBoundingClientRect();
        return {
          text: main.textContent.replace(/\s+/g, " ").trim(),
          width: rect.width,
          height: rect.height,
          overflow: document.documentElement.scrollWidth > innerWidth,
          children: [...main.children].map((element) => {
            const r = element.getBoundingClientRect();
            return {
              tag: element.className || element.tagName,
              x: r.x,
              y: r.y - rect.y,
              width: r.width,
              height: r.height,
            };
          }),
          missingImages: [...document.images]
            .filter((image) => !image.complete || !image.naturalWidth)
            .map((image) => image.getAttribute("src")),
        };
      });
      results.push({ route, width, ...metrics });
      if ([1440, 390].includes(width))
        await page.screenshot({
          path: fileURLToPath(
            new URL(`${mode}-${route.replaceAll("/", "_")}-${width}.png`, output),
          ),
          fullPage: true,
        });
    }
    if (mode === "after") {
      assert.equal(await page.locator("header.header").count(), 1, route);
      assert.equal(await page.locator("footer.footer").count(), 1, route);
      const menu = page.locator('[data-header-toggle="menu"]');
      await menu.click();
      assert.equal(await menu.getAttribute("aria-expanded"), "true", route + " menu opens");
      await page.keyboard.press("Escape");
      assert.equal(await menu.getAttribute("aria-expanded"), "false", route + " Escape");
      const footer = page.locator("[data-footer-toggle]");
      await footer.click();
      assert.equal(
        await footer.getAttribute("aria-expanded"),
        "true",
        route + " footer opens once",
      );
      await footer.click();
      assert.equal(
        await footer.getAttribute("aria-expanded"),
        "false",
        route + " footer closes once",
      );
    }
    await page.close();
  }
  await writeFile(new URL(`${mode}.json`, output), JSON.stringify({ results, errors }, null, 2));
  if (mode === "after") {
    let baseline;
    try {
      baseline = JSON.parse(await readFile(new URL("before.json", output), "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const changes = baseline
      ? results.map((result, index) => {
          const before = baseline.results[index];
          assert.equal(
            result.text.replace(/\s/g, ""),
            before.text.replace(/\s/g, ""),
            `${result.route} ${result.width}: content preserved`,
          );
          assert.ok(
            Math.abs(result.width - before.width) <= 0.1 &&
              Math.abs(result.height - before.height) <= 0.1,
            `${result.route} ${result.width}: main geometry`,
          );
          result.children.forEach((child, i) => {
            for (const key of ["x", "y", "width", "height"])
              assert.ok(
                Math.abs(child[key] - before.children[i][key]) <= 0.1,
                `${result.route} ${result.width}: ${child.tag} ${key}`,
              );
          });
          return {
            route: result.route,
            width: result.width,
            heightDelta: result.height - before.height,
            children: result.children.map((child, i) => ({
              tag: child.tag,
              heightDelta: child.height - (before.children[i]?.height ?? 0),
              yDelta: child.y - (before.children[i]?.y ?? 0),
            })),
            overflow: result.overflow,
            missingImages: result.missingImages,
          };
        })
      : [];
    await writeFile(new URL("comparison.json", output), JSON.stringify(changes, null, 2));
    assert.deepEqual(errors, [], "No browser or resource errors");
    assert.ok(
      results.every((result) => !result.overflow),
      "No horizontal overflow",
    );
    assert.ok(
      results.every((result) => !result.missingImages.length),
      "All images load",
    );
  }
  console.log(
    `${mode}: ${results.length} page/viewport checks, ${errors.length} browser/resource errors`,
  );
} finally {
  await browser.close();
}
