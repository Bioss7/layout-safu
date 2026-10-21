import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const baseURL = process.env.ABITURIENT_BASE_URL || "http://127.0.0.1:4173";
const output = new URL("../screenshots/abiturient/adaptives/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32" ? { channel: "chrome" } : {}),
});
const page = await browser.newPage();
const measurements = [];
try {
  for (const width of [1920, 1440, 1200, 390]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto(`${baseURL}/abiturient/`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.evaluate(() => {
      const box = (selector) => {
        const element = document.querySelector(selector);
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      };
      const style = (selector, property) =>
        getComputedStyle(document.querySelector(selector))[property];
      return {
        width: innerWidth,
        hero: box(".applicant-hero"),
        banner: box(".apply-banner"),
        education: box(".education-list > .education-card"),
        international: box(".education-card--international"),
        admission: box(".study-card"),
        admissionGap: parseFloat(style(".admission-list", "gap")),
        admissionIcons: [...document.querySelectorAll(".study-card__icon img")].map((image) => {
          const rect = image.getBoundingClientRect();
          return [rect.width, rect.height];
        }),
        review: box(".swiper-slide-active .review-card"),
        reviewCount: document.querySelectorAll(".swiper-slide-active .review-card").length,
        faq: box("#faq"),
        faqBackground: style("#faq", "backgroundColor"),
        faqContentBackground: style(".faq__content", "backgroundColor"),
        faqPadding: parseFloat(style("#faq", "paddingTop")),
        faqTitleGap: parseFloat(style("#faq .section-header", "marginBottom")),
        faqPanelGap: parseFloat(style(".faq__panel:not([hidden])", "marginTop")),
        faqColumnGap: parseFloat(style(".faq__columns", "gap")),
        question: box(".question__surface"),
        questionBottom: style(".question-form__bottom", "flexDirection"),
        sections: [...document.querySelectorAll("main > section")].map((element) => ({
          class: element.className,
          height: element.getBoundingClientRect().height,
        })),
      };
    });
    measurements.push(metrics);
    for (const [name, selector] of Object.entries({
      hero: ".applicant-hero",
      banner: ".section--banner",
      education: ".section--education",
      admission: ".section--admission",
      opportunities: ".section--opportunities",
      contacts: ".section--contacts",
      reviews: ".section--reviews",
      faq: "#faq",
      question: ".section--question",
      header: ".header",
      footer: ".footer",
    })) {
      await page
        .locator(selector)
        .screenshot({
          path: fileURLToPath(new URL(`${name}-${width}.png`, output)),
          animations: "disabled",
        });
    }
  }
  await writeFile(new URL("metrics.json", output), JSON.stringify(measurements, null, 2));
  console.log(
    JSON.stringify(
      measurements
        .filter((item) => item.width === 1440 || item.width === 1200)
        .map(({ width, banner, education, admission, review, faq, question }) => ({
          width,
          banner: banner.height,
          education: education.height,
          admission: admission.width,
          review: review.height,
          faq: faq.height,
          question: question.height,
        })),
    ),
  );
  for (const metric of measurements.filter((item) => item.width === 1440 || item.width === 1200)) {
    const large = metric.width === 1440;
    const near = (actual, expected, message) =>
      assert.ok(
        Math.abs(actual - expected) <= 2,
        `${metric.width}: ${message}: ${actual}, ожидается ${expected}`,
      );
    near(metric.banner.x, large ? 64 : 48, "Поля содержимого");
    near(metric.banner.height, large ? 134 : 138, "Баннер");
    near(metric.education.height, large ? 256 : 328, "Карточки образования");
    near(metric.international.height, large ? 532 : 328, "Иностранным гражданам");
    near(metric.admission.width, large ? 316 : 264, "Четыре позиции поступления");
    assert.equal(metric.admissionGap, 16);
    // Геометрия видимых SVG, а не только их обёрток.
    const iconReference = large
      ? [
          [74.392, 56.178],
          [48.006, 61.133],
          [59.242, 56.178],
          [53.114, 61.205],
          [55.667, 61.285],
          [55.156, 61.285],
        ]
      : [
          [62.15, 46.933],
          [40.107, 51.073],
          [49.493, 46.933],
          [44.373, 51.133],
          [46.507, 51.2],
          [46.08, 51.2],
        ];
    metric.admissionIcons.forEach((size, index) =>
      size.forEach((value, axis) =>
        near(value, iconReference[index][axis], "Размер иконки поступления " + index),
      ),
    );
    near(metric.review.height, large ? 398 : 500, "Карточка отзыва");
    assert.equal(metric.reviewCount, large ? 4 : 3);
    assert.equal(metric.faqBackground, large ? "rgb(255, 255, 255)" : "rgba(0, 0, 0, 0)");
    assert.equal(metric.faqContentBackground, "rgb(255, 255, 255)");
    assert.equal(metric.faqPadding, large ? 40 : 0);
    assert.equal(metric.faqTitleGap, 48);
    assert.equal(metric.faqPanelGap, large ? 32 : 40);
    assert.equal(metric.faqColumnGap, large ? 24 : 16);
    near(metric.faq.height, large ? 824 : 778, "Высота FAQ с открытым ответом");
    near(metric.question.height, large ? 774 : 888, "Содержимое формы");
    assert.equal(metric.questionBottom, large ? "row" : "column");
  }
  // Проверяем размеры и разметку: вертикальная позиция подвала зависит от высоты страницы.
  const baseline = new URL("../screenshots/abiturient/adaptive-baseline/", import.meta.url);
  const geometry = await readFile(new URL("geometry.json", baseline), "utf8")
    .then(JSON.parse)
    .catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
  for (const width of [1920, 1440, 1200, 390]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto(`${baseURL}/abiturient/`, { waitUntil: "networkidle" });
    for (const name of ["header", "footer"]) {
      if (geometry) {
        const actual = await page.locator(`.${name}`).evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height, html: element.outerHTML };
        });
        assert.deepEqual(
          actual,
          geometry[width][`.${name}`],
          `${name} ${width}: разметка и размеры сохраняются`,
        );
      }
      const old = await readFile(new URL(`${width}-${name}.png`, baseline)).catch((error) => {
        if (error.code !== "ENOENT") throw error;
        return null;
      });
      // Пиксельный снимок подвала зависит от дробной координаты его начала после изменений.
      if (old && name === "header") {
        const current = await sharp(await readFile(new URL(`${name}-${width}.png`, output)))
          .raw()
          .toBuffer();
        const reference = await sharp(old).raw().toBuffer();
        assert.ok(
          current.equals(reference),
          `${name} ${width}: пиксели совпадают с исходным снимком`,
        );
      }
    }
  }
  console.log("Адаптивы 1440/1200 и неизменность шапки/подвала проверены.");
} finally {
  await browser.close();
}
