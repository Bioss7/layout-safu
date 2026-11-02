import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const port = 4193;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  { stdio: "pipe" },
);
let browser;
const errors = [];
const metricsFile = process.argv.includes("--capture")
  ? "screenshots/international/capture-metrics.json"
  : "screenshots/international/metrics.json";
try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (data) => {
      if (data.toString().includes(String(port))) resolve();
    });
    server.on("error", reject);
    server.on("exit", (code) => reject(new Error("Preview завершился: " + code)));
  });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1000 },
    reducedMotion: "reduce",
  });
  if (process.argv.includes("--capture"))
    await page.emulateMedia({ reducedMotion: "no-preference" });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(response.status() + " " + response.url());
  });
  await mkdir("screenshots/international", { recursive: true });
  const metrics = [];
  const widths = process.argv.includes("--capture")
    ? [320, 1920, 390]
    : [
        320, 390, 480, 575, 576, 577, 672, 767, 768, 769, 880, 991, 992, 993, 1100, 1199, 1200,
        1201, 1300, 1399, 1400, 1401, 1600, 1920, 2560,
      ];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("http://127.0.0.1:" + port + "/international/");
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images]
          .filter((image) => !image.closest("[hidden]"))
          .map((image) => {
            image.loading = "eager";
            return image.decode().catch(() => {});
          }),
      );
    });
    const result = await page.evaluate(() => {
      const rect = (element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y + scrollY, width: box.width, height: box.height };
      };
      return {
        width: innerWidth,
        overflow: document.documentElement.scrollWidth - innerWidth,
        heroTextOverflow:
          document.querySelector(".hero__title").scrollWidth -
          document.querySelector(".hero__title").clientWidth,
        textOverflow: [...document.querySelectorAll("body *")]
          .filter((element) => {
            if (
              !element.getClientRects().length ||
              element.closest(".marquee, .partner-logos, .swiper")
            )
              return false;
            return (
              element.scrollWidth > element.clientWidth + 1 &&
              getComputedStyle(element).overflowX === "visible"
            );
          })
          .map((element) => ({
            class: element.className,
            width: element.clientWidth,
            scroll: element.scrollWidth,
          })),
        overflowing: [...document.querySelectorAll("body *")]
          .filter((element) => {
            if (
              !element.getClientRects().length ||
              element.closest(".marquee, .partner-logos, .swiper")
            )
              return false;
            const box = element.getBoundingClientRect();
            return box.right > innerWidth + 1;
          })
          .map((element) => ({
            class: element.className,
            right: element.getBoundingClientRect().right,
          })),
        sections: [...document.querySelectorAll("main > section")].map((element) => ({
          name: element.className,
          ...rect(element),
        })),
        blocks: Object.fromEntries(
          [
            ".header",
            ".hero__text",
            ".hero__picture",
            ".hero__controls",
            ".statistics__cards",
            ".information",
            ".info-card--1 .info-card__links",
            ".info-card--1 .link-arrow",
            ".info-card--2 .info-card__links",
            ".life-tabs",
            ".life-panel--active",
            ".contacts",
            ".partner-network__tabs",
            ".partner-logos",
            ".people__layout",
            ".people__tabs",
            ".person-card",
            ".footer",
          ].map((selector) => [selector, rect(document.querySelector(selector))]),
        ),
        brokenImages: [...document.images]
          .filter((image) => !image.closest("[hidden]") && (!image.complete || !image.naturalWidth))
          .map((image) => image.currentSrc),
        fonts: ["500 16px Montserrat", "400 24px HS_LunaObscura"].map((font) => [
          font,
          document.fonts.check(font),
        ]),
        duplicateIds: [...document.querySelectorAll("[id]")]
          .map((element) => element.id)
          .filter((id, index, ids) => ids.indexOf(id) !== index),
      };
    });
    if (process.argv.includes("--capture"))
      await page.evaluate(() => {
        document.getAnimations().forEach((animation) => {
          animation.pause();
          animation.currentTime = 0;
        });
      });
    metrics.push(result);
    await writeFile(metricsFile, JSON.stringify(metrics, null, 2));
    if ([1920, 390].includes(width))
      await page.screenshot({
        path: "screenshots/international/page-" + width + ".png",
        fullPage: true,
      });
    if (!process.argv.includes("--capture")) {
      assert.equal(result.overflow, 0, "Горизонтальное переполнение на " + width);
      assert.ok(result.heroTextOverflow <= 1, "Переполнение заголовка hero на " + width);
      assert.deepEqual(result.brokenImages, [], "Незагруженные изображения на " + width);
      assert.deepEqual(result.duplicateIds, [], "Повторяющиеся ID");
      assert.ok(
        result.fonts.every(([, ready]) => ready),
        "Шрифты не загружены",
      );
      const expected =
        width === 1920
          ? [900, 2022, 3208, 3932, 5400, 6446]
          : width === 390
            ? [935, 2465, 3935, 5235, 8107, 8755]
            : null;
      if (expected)
        expected.forEach((y, index) => {
          assert.ok(
            Math.abs(result.sections[index + 1].y - y) <= 2,
            "Положение секции " + (index + 1) + " на " + width,
          );
        });
    }
  }
  await writeFile(metricsFile, JSON.stringify(metrics, null, 2));
  if (!process.argv.includes("--capture")) {
    await page.setViewportSize({ width: 1920, height: 1000 });
    await page.goto("http://127.0.0.1:" + port + "/international/");
    await page.locator(".js-hero-page").nth(3).click();
    assert.equal(await page.locator(".js-hero-current").textContent(), "04");
    for (const width of [1920, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const expectedImages = [
        width === 390 ? "/hero/hero-390.png" : "/hero/hero-1920.png",
        "/news/03.png",
        "/news/02.png",
        "/news/04.png",
      ];
      for (let index = 0; index < 4; index++) {
        await page.locator(".js-hero-page").nth(index).click();
        await page.waitForFunction(
          (expected) => {
            const image = document.querySelector(".hero__image");
            return image.complete && image.naturalWidth > 0 && image.currentSrc.endsWith(expected);
          },
          expectedImages[index],
          { timeout: 3000 },
        );
        const title = await page.locator(".hero__slide").nth(index).getAttribute("data-title");
        assert.equal(await page.locator(".js-hero-label").textContent(), title);
      }
    }
    await page.setViewportSize({ width: 1920, height: 1000 });
    assert.ok(await page.locator(".js-hero-next").isDisabled());
    await page.locator(".js-hero-prev").click();
    assert.equal(await page.locator(".js-hero-current").textContent(), "03");
    await page.locator(".js-life-tab").nth(1).click();
    assert.ok(await page.locator("#news-panel-1").isVisible());
    await page.locator(".js-life-tab").nth(1).press("Home");
    assert.equal(await page.locator(".js-life-tab").first().getAttribute("aria-selected"), "true");
    for (let tab = 0; tab < 4; tab++) {
      await page.locator(".js-partner-tab").nth(tab).click();
      assert.ok(await page.locator("#partners-panel-" + tab).isVisible());
    }
    await page.locator(".js-partner-tab").last().press("Home");
    assert.equal(
      await page.locator(".js-partner-tab").first().getAttribute("aria-selected"),
      "true",
    );
    for (let tab = 0; tab < 5; tab++) {
      await page.locator(".js-people-tab").nth(tab).click();
      for (let sheet = 0; sheet < 4; sheet++) {
        await page.locator(".js-people-page").nth(sheet).click();
        assert.equal(
          await page
            .locator("#department-panel-" + tab + " .js-people-sheet:visible")
            .getAttribute("data-page"),
          String(sheet),
        );
      }
    }
    await page.locator(".js-people-tab").last().press("Home");
    assert.equal(
      await page.locator(".js-people-tab").first().getAttribute("aria-selected"),
      "true",
    );
    assert.ok(await page.locator(".js-people-prev").isDisabled());
    await page.locator('[data-header-toggle="menu"]').click();
    assert.equal(
      await page.locator('[data-header-toggle="menu"]').getAttribute("aria-expanded"),
      "true",
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator('[data-header-toggle="menu"]').getAttribute("aria-expanded"),
      "false",
    );
    await page.locator("[data-footer-toggle]").click();
    assert.equal(await page.locator("[data-footer-toggle]").getAttribute("aria-expanded"), "true");
    await page.locator("[data-footer-toggle]").click();
    assert.equal(await page.locator("[data-footer-toggle]").getAttribute("aria-expanded"), "false");

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 900 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const touchPage = await mobile.newPage();
    await touchPage.goto("http://127.0.0.1:" + port + "/international/");
    const session = await mobile.newCDPSession(touchPage);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 340, y: 330 }],
    });
    for (const x of [280, 220, 160, 100, 40]) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: 330 }],
      });
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await touchPage.waitForFunction(
      () => document.querySelector(".js-hero-current").textContent === "02",
    );
    await touchPage.locator(".js-hero-page").first().tap();
    await touchPage.locator(".js-people-tab").nth(4).tap();
    assert.ok(await touchPage.locator("#department-panel-4").isVisible());
    await mobile.close();
    assert.deepEqual(errors, [], "Ошибки браузера и загрузки ресурсов");
    console.log(
      "International: 25 ширин, четыре слайда, все вкладки и страницы сотрудников проверены.",
    );
  } else
    console.log(
      JSON.stringify({
        metrics: metrics.map(({ width, overflow, sections, brokenImages }) => ({
          width,
          overflow,
          sections,
          brokenImages,
        })),
        errors,
      }),
    );
} finally {
  await browser?.close();
  server.kill();
}
