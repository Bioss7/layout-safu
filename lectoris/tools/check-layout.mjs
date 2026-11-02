import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const browser = await chromium.launch({ headless: true, args: ["--disable-logging"] });
const errors = [];
const failures = [];
const results = [];
const sliderStates = [];
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) failures.push({ url: r.url(), status: r.status() });
  });
  page.on("requestfailed", (r) => failures.push({ url: r.url(), reason: r.failure()?.errorText }));
  await page.goto("http://127.0.0.1:4178/", { waitUntil: "load", timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  for (const width of [
    1920, 390, 320, 575, 576, 577, 767, 768, 769, 991, 992, 993, 1199, 1200, 1201, 1399, 1400, 1401,
    480, 672, 880, 1100, 1300, 1600, 2560,
  ]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.waitForTimeout(60);
    await page.evaluate(() =>
      Promise.all([...document.images].map((n) => n.decode().catch(() => {}))),
    );
    const result = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fontLoaded: [...document.fonts].some(
        (f) => f.family.replaceAll('"', "") === "Onest" && f.status === "loaded",
      ),
      fontFaces: [...document.fonts]
        .filter((f) => f.status === "loaded")
        .map((f) => ({ family: f.family, weight: f.weight, status: f.status })),
      brokenImages: [...document.images]
        .filter((n) => !n.complete || !n.naturalWidth)
        .map((n) => n.getAttribute("src")),
      blocks: [...document.querySelectorAll(".event-card,.community,.footer")].map((n) => ({
        class: n.className,
        y: n.getBoundingClientRect().y + scrollY,
        h: n.getBoundingClientRect().height,
      })),
      headings: [...document.querySelectorAll("h1,h2.section__title")].map((n) => ({
        text: n.textContent,
        x: n.getBoundingClientRect().x,
        y: n.getBoundingClientRect().y + scrollY,
        w: n.getBoundingClientRect().width,
        h: n.getBoundingClientRect().height,
        size: getComputedStyle(n).fontSize,
      })),
      overflowing: [...document.querySelectorAll("main *,header *,footer *")]
        .filter((n) => {
          const r = n.getBoundingClientRect();
          return (
            n.checkVisibility({ visibilityProperty: true }) &&
            r.right > innerWidth + 1 &&
            r.width > 0 &&
            getComputedStyle(n).position !== "absolute" &&
            !n.closest(".hero__visual")
          );
        })
        .slice(0, 10)
        .map((n) => n.className),
    }));
    results.push(result);
    if ([1920, 390].includes(width)) {
      await page.screenshot({
        path: fileURLToPath(new URL("../screenshots/browser-" + width + ".png", import.meta.url)),
        fullPage: true,
      });
      for (let index = 0; index < 5; index++) {
        await page.locator(".js-review-dot").nth(index).click();
        await page.waitForTimeout(310);
        const state = await page.evaluate(() => {
          const card = document.querySelector(".speaker-card--active");
          const caption = card.querySelector(".speaker-card__caption");
          const description = card.querySelector(".speaker-card__description");
          const quote = document.querySelector(".hero__quote");
          const quoteText = document.querySelector(".js-hero-quote-text");
          const box = (n) => {
            const r = n.getBoundingClientRect();
            return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height };
          };
          return {
            width: innerWidth,
            id: card.dataset.speaker,
            name: card.querySelector(".speaker-card__name").innerText,
            quote: quoteText.innerText.replace(/\s+/g, " ").trim(),
            card: box(card),
            caption: box(caption),
            description: box(description),
            quoteBox: box(quote),
            quoteText: box(quoteText),
            controls: box(document.querySelector(".reviews-slider__controls")),
            dots: box(document.querySelector(".slider-dots")),
            previous: document.querySelector(".speaker-card--previous").dataset.speaker,
            next: document.querySelector(".speaker-card--next").dataset.speaker,
            dotCount: document.querySelectorAll(".js-review-dot").length,
          };
        });
        sliderStates.push(state);
        const near = (value, target, label) =>
          assert.ok(Math.abs(value - target) <= 1.5, label + ": " + value + " != " + target);
        assert.equal(state.dotCount, 5);
        near(state.card.width, 300, "Ширина центральной карточки");
        near(state.card.height, 404, "Высота центральной карточки");
        near(state.caption.height, 74, "Высота нижней панели");
        near(state.caption.width, 300, "Ширина нижней панели");
        assert.ok(
          state.description.y + state.description.height <=
            state.caption.y + state.caption.height + 1,
          "Подпись обрезана",
        );
        assert.ok(
          state.quoteText.y + state.quoteText.height <=
            state.quoteBox.y + state.quoteBox.height + 1,
          "Цитата обрезана",
        );
        near(state.dots.width, 146.6557159423828, "Ширина точек Figma");
        if (index === 0) {
          assert.equal(state.previous, "alexey");
          assert.equal(state.next, "gulnaz");
        }
        if (width === 390) {
          near(state.card.x, 37, "Положение карточки X");
          near(state.card.y, 570, "Положение карточки Y");
          near(state.quoteBox.x, 16, "Положение цитаты X");
          near(state.quoteBox.y, 499, "Положение цитаты Y");
          near(state.controls.x, 45, "Положение управления X");
          near(state.controls.y, 990, "Положение управления Y");
          near(state.quoteBox.height, 84, "Высота цитаты");
        }
        await page.locator(".hero").screenshot({
          path: fileURLToPath(
            new URL("../screenshots/slider-" + width + "-" + state.id + ".png", import.meta.url),
          ),
        });
      }
      await page.locator(".js-review-dot").first().click();
      await page.waitForTimeout(310);
    }
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator(".feature-card--network").hover();
  await page.waitForTimeout(220);
  await page.locator(".feature-card--network").screenshot({
    path: fileURLToPath(new URL("../screenshots/browser-network-hover.png", import.meta.url)),
  });
  const report = { errors, failures, results, sliderStates };
  await writeFile(
    new URL("../screenshots/check-report.json", import.meta.url),
    JSON.stringify(report, null, 2),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  for (const result of results) {
    assert.equal(result.scrollWidth, result.width, "Переполнение на " + result.width);
    assert.equal(result.fontLoaded, true, "Onest не загрузился");
    assert.deepEqual(result.brokenImages, []);
  }
  console.log(
    JSON.stringify(
      {
        errors,
        failures,
        viewports: results.map((r) => ({
          width: r.width,
          scrollWidth: r.scrollWidth,
          fontLoaded: r.fontLoaded,
          broken: r.brokenImages.length,
          overflow: r.overflowing,
        })),
        sliderStates: sliderStates.map((s) => ({
          width: s.width,
          id: s.id,
          captionHeight: s.caption.height,
          quoteHeight: s.quoteBox.height,
        })),
        geometry: results
          .filter((r) => [1920, 390].includes(r.width))
          .map((r) => ({ width: r.width, headings: r.headings })),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
