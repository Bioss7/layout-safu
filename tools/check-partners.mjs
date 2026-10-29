import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const base = "http://127.0.0.1:4178";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4178",
    "--strictPort",
  ],
  { stdio: "pipe" },
);
let browser;
const errors = [];
const output = "screenshots/partners";
try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (data) => {
      if (data.toString().includes("4178")) resolve();
    });
    server.on("exit", (code) => reject(new Error(`Preview exited: ${code}`)));
    server.on("error", reject);
  });
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1000 } });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().startsWith(base))
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(`${base}/partners/`, { waitUntil: "networkidle" });
  assert.equal(await page.locator("h1").textContent(), "Станьте партнером САФУ");
  await mkdir(output, { recursive: true });
  const tabs = page.getByRole("tab");
  assert.equal(await tabs.count(), 4);
  for (let i = 0; i < 4; i++) {
    await tabs.nth(i).click();
    assert.equal(await tabs.nth(i).getAttribute("aria-selected"), "true");
    assert.equal(await page.getByRole("tabpanel").count(), 1);
    assert.equal(await page.getByRole("tabpanel").locator(".partner-logos__row").count(), 2);
  }
  await tabs.nth(0).focus();
  await page.keyboard.press("End");
  assert.equal(await tabs.nth(3).getAttribute("aria-selected"), "true");
  await page.keyboard.press("Home");
  assert.equal(await tabs.nth(0).getAttribute("aria-selected"), "true");
  const tracks = page.getByRole("tabpanel").locator(".partner-logos__track");
  await page.mouse.move(0, 0);
  const positions = () =>
    tracks.evaluateAll((nodes) =>
      nodes.map((node) => new DOMMatrix(getComputedStyle(node).transform).m41),
    );
  const before = await positions();
  await page.waitForTimeout(200);
  const after = await positions();
  assert(
    after[0] < before[0] && after[1] > before[1],
    "Строки должны двигаться в противоположные стороны",
  );
  await page
    .getByRole("tabpanel")
    .locator(".partner-logos__card")
    .filter({ visible: true })
    .nth(2)
    .hover({ force: true });
  const paused = await positions();
  await page.waitForTimeout(200);
  const still = await positions();
  assert(
    still.every((value, i) => Math.abs(value - paused[i]) < 0.1),
    "Наведение останавливает обе строки",
  );
  await page.mouse.move(0, 0);
  await page.waitForTimeout(100);
  assert.notDeepEqual(await positions(), still);
  await page.getByRole("tabpanel").focus();
  await page.waitForTimeout(50);
  assert.deepEqual(
    await tracks.evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).animationPlayState),
    ),
    ["paused", "paused"],
  );
  const focused = await positions();
  await page.waitForTimeout(100);
  assert.deepEqual(await positions(), focused, "Фокус останавливает обе строки");
  await tabs.first().focus();
  const cycles = await tracks.evaluateAll((nodes) =>
    nodes.map((node) => {
      const groups = [...node.children];
      const width = groups[0].getBoundingClientRect().width;
      return {
        width,
        repeatedWidth: groups[1].getBoundingClientRect().width,
        duration: parseFloat(getComputedStyle(node).animationDuration),
        inert: groups[1].inert,
        hidden: groups[1].getAttribute("aria-hidden"),
      };
    }),
  );
  cycles.forEach((cycle) => {
    assert(
      Math.abs(cycle.width - cycle.repeatedWidth) < 0.01,
      "Повтор совпадает с исходным набором",
    );
    assert(Math.abs(cycle.width / cycle.duration - 40) < 0.01);
    assert(cycle.inert && cycle.hidden === "true");
  });
  // Стык цикла проверяется с двух сторон; периодический сдвиг на ширину набора визуально равнозначен.
  const seam = await tracks.evaluateAll((nodes) =>
    nodes.map((node) => {
      const animation = node.getAnimations()[0];
      const duration = animation.effect.getTiming().duration;
      animation.pause();
      animation.currentTime = duration - 1;
      const before = new DOMMatrix(getComputedStyle(node).transform).m41;
      animation.currentTime = duration + 1;
      const after = new DOMMatrix(getComputedStyle(node).transform).m41;
      animation.play();
      return { before, after, width: node.firstElementChild.getBoundingClientRect().width };
    }),
  );
  seam.forEach(({ before, after, width }) =>
    assert(Math.abs(Math.abs(after - before) - width) < 0.1),
  );
  const metrics = [];
  for (const width of [
    320, 390, 575, 576, 577, 767, 768, 769, 991, 992, 993, 1199, 1200, 1201, 1399, 1400, 1401, 1920,
    1921, 2560, 3440,
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => document.fonts.ready);
    const result = await page.evaluate(() => ({
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
      sections: [...document.querySelector("main").children].map((node) => {
        const r = node.getBoundingClientRect();
        return {
          selector: node.className,
          x: r.x,
          y: r.y + scrollY,
          width: r.width,
          height: r.height,
        };
      }),
      missingImages: [...document.images]
        .filter((img) => !img.complete || !img.naturalWidth)
        .map((img) => img.src),
    }));
    metrics.push(result);
    assert.equal(result.overflow, false, `Переполнение на ${width}px`);
    assert.deepEqual(result.missingImages, []);
    // Эталоны сохраняют прежнюю геометрию планшета и десктопа при мобильной доработке.
    if (width === 768)
      assert.deepEqual(
        result.sections.map((s) => s.height),
        [659, 64, 768, 294, 1556, 816, 690],
      );
    if (width === 1920)
      assert.deepEqual(
        result.sections.map((s) => s.height),
        [802, 90, 1284, 368, 1512, 1102, 540],
      );
    if (width === 390) {
      // Кадр 9:941: семантические секции включают межсекционные padding.
      assert.deepEqual(
        result.sections.map((s) => [s.y, s.height]),
        [
          [0, 779],
          [779, 58],
          [837, 1716],
          [2553, 368],
          [2921, 2736],
          [5657, 914],
          [6571, 806],
        ],
      );
      const mobile = await page.evaluate(() => {
        const size = (selector) => {
          const rect = document.querySelector(selector).getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        };
        const tabs = document.querySelector(".js-partner-tabs");
        return {
          practice: size(".partner-practice__card"),
          opportunity: size(".partner-opportunity"),
          banner: size(".partner-development"),
          heroText: [...document.querySelectorAll(".partner-hero__text")]
            .filter((n) => getComputedStyle(n).display !== "none")
            .map((n) => n.textContent.replace(/\s+/g, " ").trim())
            .join(""),
          tabRows: new Set([...tabs.children].map((n) => n.offsetTop)).size,
          overflow: tabs.scrollWidth > tabs.clientWidth,
          titleLineHeight: getComputedStyle(document.querySelector(".partner-hero__title"))
            .lineHeight,
        };
      });
      assert.equal(mobile.practice.width, 358);
      assert.equal(mobile.practice.height, 358);
      assert.equal(mobile.opportunity.height, 400);
      assert.equal(mobile.banner.width, 358);
      assert.equal(mobile.titleLineHeight, "40px");
      assert(mobile.heroText.startsWith("Всё необходимое студенту"));
      assert.equal(mobile.tabRows, 3);
      assert.equal(mobile.overflow, false);
    }
    if ([390, 768, 1920].includes(width)) {
      await page.evaluate(() => {
        document
          .querySelectorAll(".partner-logos__track, .partner-marquee__track")
          .forEach((node) =>
            node.getAnimations().forEach((animation) => {
              animation.pause();
              animation.currentTime = 0;
            }),
          );
      });
      await page.screenshot({ path: `${output}/${width}.png`, fullPage: true });
    }
    if ([390, 576, 1920, 1921, 2560, 3440].includes(width)) {
      for (const block of ["development", "cta", "network"]) {
        await page
          .locator(`.partner-${block}`)
          .screenshot({ path: `${output}/${block}-${width}.png` });
      }
    }
  }
  for (const width of [1920, 1921, 2560, 3440]) {
    await page.setViewportSize({ width, height: 900 });
    for (let tab = 0; tab < 4; tab++) {
      await tabs.nth(tab).click();
      await page.waitForTimeout(50);
      const coverage = await page.getByRole("tabpanel").evaluate((panel) => {
        const bounds = panel.getBoundingClientRect();
        return [...panel.querySelectorAll(".partner-logos__track")].flatMap((track) => {
          const animation = track.getAnimations()[0];
          animation.pause();
          return [0, 0.25, 0.5, 0.75, 0.999].map((phase) => {
            animation.currentTime = animation.effect.getTiming().duration * phase;
            const first = track.firstElementChild.firstElementChild.getBoundingClientRect();
            const last = track.lastElementChild.lastElementChild.getBoundingClientRect();
            return { phase, left: first.left - bounds.left, right: last.right - bounds.right };
          });
        });
      });
      assert(
        coverage.every(({ left, right }) => left <= 1 && right >= -1),
        `Пустой край ленты: ${width}px, вкладка ${tab}: ${JSON.stringify(coverage)}`,
      );
    }
  }
  await tabs.first().click();
  await page.setViewportSize({ width: 768, height: 900 });
  await tabs.first().focus();
  const list = page.locator(".js-partner-tabs");
  await list.scrollIntoViewIfNeeded();
  await list.evaluate((node) => {
    node.scrollLeft = 0;
  });
  const bounds = await list.boundingBox();
  await page.mouse.move(bounds.x + 250, bounds.y + 16);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 40, bounds.y + 16, { steps: 8 });
  await page.mouse.up();
  assert(await list.evaluate((node) => node.scrollLeft > 100), "Drag прокручивает вкладки");
  assert.equal(
    await tabs.first().getAttribute("aria-selected"),
    "true",
    "После drag нет случайного переключения",
  );
  await list.dispatchEvent("pointercancel", { pointerId: 1 });
  assert.equal(
    await list.evaluate((node) => node.classList.contains("partner-network__tabs--dragging")),
    false,
  );
  await tabs.nth(1).click();
  assert.equal(await tabs.nth(1).getAttribute("aria-selected"), "true");
  await tabs.first().click();
  await page.setViewportSize({ width: 390, height: 900 });
  await tabs.nth(2).click();
  assert.equal(await tabs.nth(2).getAttribute("aria-selected"), "true");
  assert.equal(await list.evaluate((node) => node.scrollLeft), 0);
  await page.keyboard.press("ArrowRight");
  assert.equal(await tabs.nth(3).getAttribute("aria-selected"), "true");
  await page.setViewportSize({ width: 577, height: 900 });
  assert.equal(await list.evaluate((node) => getComputedStyle(node).flexWrap), "nowrap");
  await page.setViewportSize({ width: 390, height: 900 });
  assert.equal(await list.evaluate((node) => getComputedStyle(node).flexWrap), "wrap");
  assert.equal(await tabs.nth(3).getAttribute("aria-selected"), "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await tracks.first().evaluate((node) => getComputedStyle(node).animationName),
    "none",
  );
  const row = page.getByRole("tabpanel").locator(".partner-logos__row").first();
  assert.equal(await row.evaluate((node) => getComputedStyle(node).overflowX), "auto");
  assert(
    await row.evaluate((node) => {
      node.scrollLeft = 100;
      return node.scrollLeft > 0;
    }),
  );
  for (const route of ["partners", "students"]) {
    await page.goto(`${base}/${route}/`, { waitUntil: "networkidle" });
    const toggle = page.locator(".js-footer-toggle");
    assert.equal(await toggle.evaluate((node) => getComputedStyle(node).borderBottomWidth), "1px");
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator(".js-footer-details").isVisible(), true);
    await toggle.click();
    assert.equal(await page.locator(".js-footer-details").isVisible(), false);
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/metrics.json`, JSON.stringify(metrics, null, 2) + "\n");
  console.log(
    `Partners: ${metrics.length} widths, tabs, keyboard, motion, hover, reduced motion and footer passed.`,
  );
} finally {
  await browser?.close();
  server.kill();
}
