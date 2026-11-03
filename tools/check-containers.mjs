import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const baseline = process.argv.includes("--baseline");
const output = "screenshots/containers";
const widths = [
  320, 389, 390, 391, 480, 575, 576, 577, 640, 767, 768, 769, 880, 991, 992, 993, 1100, 1199, 1200,
  1201, 1300, 1439, 1440, 1441, 1600, 1920, 2560,
];
const pages = JSON.parse(await readFile("ui/data/pages.json", "utf8"));
const port = "4196";
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
  { stdio: "pipe", windowsHide: true },
);
let browser;
const report = { results: [], failures: [], errors: [] };
const before = baseline
  ? null
  : await readFile(`${output}/before.json`, "utf8")
      .then(JSON.parse)
      .catch((error) => {
        if (error.code !== "ENOENT") throw error;
        return null;
      });
const near = (a, b) => Math.abs(a - b) <= 1;
try {
  await new Promise((resolve, reject) => {
    server.on("error", reject);
    server.on("exit", (code) => reject(new Error(`Preview exited: ${code}`)));
    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Local:")) resolve();
    });
  });
  browser = await chromium.launch();
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1:4196\/)/, (route) => route.abort());
  await mkdir(output, { recursive: true });
  for (const entry of pages) {
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push({ page: entry.id, error: error.message }));
    await page.goto(`http://127.0.0.1:${port}${entry.url}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      // Full-page screenshots can leave cached vw values after a viewport resize.
      await page.reload({ waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => window.scrollTo(0, 0));
      const data = await page.evaluate(() => ({
        availableWidth: document.body.getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        containers: [...document.querySelectorAll(".container")].map((node) => {
          const rect = node.getBoundingClientRect(),
            css = getComputedStyle(node);
          return {
            classes: node.className,
            shell: !!node.closest(".header, .header-panels, .footer"),
            visible: !!node.getClientRects().length,
            x: rect.x,
            width: rect.width,
            paddingLeft: css.paddingLeft,
            paddingRight: css.paddingRight,
          };
        }),
      }));
      const result = { page: entry.id, width, ...data };
      report.results.push(result);
      if (!baseline) {
        const old = before?.results.find((r) => r.page === entry.id && r.width === width);
        const expected =
          width <= 390
            ? Math.min(width - 32, 358)
            : width <= 768
              ? width - 32
              : width <= 992
                ? width - 48
                : width <= 1200
                  ? width - 64
                  : width <= 1440
                    ? Math.min(data.availableWidth, 1280)
                    : Math.min(data.availableWidth, 1720);
        for (const [index, container] of data.containers.entries()) {
          if (!container.visible) continue;
          const special =
            /container--(?:pulse|banner|opportunities|contacts|template)\b/.test(
              container.classes,
            ) ||
            (width <= 576 && container.classes.includes("container--development"));
          const reference = old?.containers[index];
          const expectedWidth = special ? (reference?.width ?? container.width) : expected;
          const expectedX = special
            ? (reference?.x ?? (width - container.width) / 2)
            : (data.availableWidth - expected) / 2;
          if (
            !near(container.width, expectedWidth) ||
            !near(container.x, expectedX) ||
            (!special && (container.paddingLeft !== "0px" || container.paddingRight !== "0px"))
          ) {
            report.failures.push({
              page: entry.id,
              width,
              index,
              container,
              expectedWidth,
              expectedX,
            });
          }
          if (reference && (container.shell || entry.id === "main")) {
            if (!near(container.width, reference.width) || !near(container.x, reference.x)) {
              report.failures.push({
                page: entry.id,
                width,
                index,
                reason: "baseline geometry changed",
              });
            }
          }
        }
        if (data.overflow > Math.max(1, old?.overflow ?? 0)) {
          report.failures.push({
            page: entry.id,
            width,
            overflow: data.overflow,
            before: old?.overflow ?? 0,
          });
        }
      }
      if ([390, 1440, 1920].includes(width)) {
        await page.screenshot({
          path: `${output}/${baseline ? "before" : "after"}-${entry.id}-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    }
    console.log(`${entry.id}: ${widths.length} widths checked`);
    await page.close();
  }
  await writeFile(
    `${output}/${baseline ? "before" : "after"}.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      cases: report.results.length,
      failures: report.failures.length,
      errors: report.errors,
      overflow: report.results
        .filter((r) => r.overflow > 1)
        .map((r) => ({ page: r.page, width: r.width, overflow: r.overflow })),
    }),
  );
  assert.equal(report.failures.length, 0, "Container geometry or overflow changed unexpectedly");
  assert.equal(report.errors.length, 0, "Browser JavaScript errors");
} finally {
  await browser?.close();
  server.kill();
}
