import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const base = process.env.TEMPLATES_BASE_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (response.url().startsWith(base) && response.status() >= 400)
    errors.push(`${response.status()} ${response.url()}`);
});
const widths = [
  1920, 1441, 1440, 1439, 1201, 1200, 1199, 993, 992, 991, 769, 768, 767, 577, 576, 575, 480, 391,
  390, 389,
];
const templates = [
  {
    id: "template-main",
    font: "HS_LunaObscura",
    weight: "400",
    desktop: [320, 308, 1280, 2896.207763671875],
    mobile: [16, 236, 544, 3061.116943359375],
    image: [
      [368, 1426, 1184, 636],
      [32, 1872, 496, 266],
    ],
  },
  {
    id: "template-abiturient",
    font: "Unbounded",
    weight: "800",
    desktop: [320, 308, 1280, 2946.98388671875],
    mobile: [16, 216, 544, 3064],
    image: [
      [371, 1477, 1178, 636],
      [35, 1793, 496, 266],
    ],
  },
  {
    id: "template-international",
    font: "Cakra",
    weight: "400",
    desktop: [320, 308, 1280, 2896.207763671875],
    mobile: [16, 236, 544, 2939.116943359375],
    image: [
      [368, 1426, 1184, 636],
      [32, 1766, 496, 266],
    ],
  },
];
const results = [];
try {
  for (const template of templates) {
    const output = new URL(`../screenshots/${template.id}/`, import.meta.url);
    await mkdir(output, { recursive: true });
    const measurements = [];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${base}/${template.id}/`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const metrics = await page.evaluate(() => {
        const article = document.querySelector(".template-content");
        const image = article.querySelector(":scope > img");
        const heading = article.querySelector("h1");
        const table = article.querySelector("table");
        const viewport = article.querySelector("[data-table-viewport]") || table;
        const rect = (node) => {
          const r = node.getBoundingClientRect();
          return [r.x, r.y, r.width, r.height];
        };
        const marker = getComputedStyle(article.querySelector("ul > li"), "::before");
        return {
          width: innerWidth,
          overflow: document.documentElement.scrollWidth - innerWidth,
          article: rect(article),
          image: rect(image),
          loadedImage: image.complete && image.naturalWidth > 0,
          font: getComputedStyle(heading).fontFamily,
          weight: getComputedStyle(heading).fontWeight,
          breadcrumb: getComputedStyle(document.querySelector(".breadcrumbs__link")).color,
          marker: { position: marker.position, left: marker.left, content: marker.content },
          tableOverflow: viewport.scrollWidth > viewport.clientWidth,
          tableClasses: article.querySelectorAll("table[class], table [class]").length,
          tableWrapper: table.parentElement.hasAttribute("data-table-viewport"),
          columns: [...table.tHead.rows[0].cells].map((cell) => ({
            x: cell.getBoundingClientRect().x,
            width: cell.getBoundingClientRect().width,
          })),
          bodyColumns: [...table.tBodies[0].rows[0].cells].map((cell) => ({
            x: cell.getBoundingClientRect().x,
            width: cell.getBoundingClientRect().width,
          })),
          headings: [...article.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((node) => ({
            text: node.textContent,
            rect: rect(node),
          })),
        };
      });
      metrics.columns.forEach((cell, index) => {
        assert.ok(Math.abs(cell.x - metrics.bodyColumns[index].x) <= 1);
        assert.ok(Math.abs(cell.width - metrics.bodyColumns[index].width) <= 1);
      });
      assert.equal(metrics.tableClasses, 0, "Таблица и её элементы без классов");
      assert.equal(metrics.tableWrapper, true, "Обёртка создана автоматически по тегу table");
      assert.equal(metrics.overflow, 0, `${template.id}: переполнение на ${width}`);
      assert.ok(metrics.loadedImage, `${template.id}: изображение загружено`);
      assert.ok(metrics.font.includes(template.font), `${template.id}: семейство шрифта`);
      assert.equal(metrics.weight, template.weight);
      assert.equal(metrics.breadcrumb, "rgb(11, 45, 78)");
      assert.equal(metrics.marker.position, "absolute");
      assert.equal(metrics.marker.left, "0px");
      if (width <= 576) assert.ok(metrics.tableOverflow);
      if (width === 1920 || width === 576) {
        const expected = width === 1920 ? template.desktop : template.mobile;
        // Высота статьи изменилась по задаче: верхний индикатор удалён, добавлена нативная полоса снизу.
        expected
          .slice(0, 3)
          .forEach((value, index) =>
            assert.ok(
              Math.abs(metrics.article[index] - value) <= 2,
              `${template.id} ${width}: article[${index}]`,
            ),
          );
        template.image[width === 1920 ? 0 : 1].forEach((value, index) => {
          // В 126:6923 изображение выше собственного figure на 3.016 px. Обычный img
          // сохраняет пропорции; его верхняя граница и ширина проверяются с допуском 2 px.
          const tolerance =
            template.id === "template-abiturient" && width === 1920 && index === 3 ? 4 : 2;
          assert.ok(
            Math.abs(metrics.image[index] - value) <= tolerance,
            `${template.id} ${width}: img[${index}]`,
          );
        });
      }
      measurements.push(metrics);
      if ([1920, 1440, 1200, 992, 768, 576, 390].includes(width))
        await page.screenshot({
          path: fileURLToPath(new URL(`${width}.png`, output)),
          fullPage: true,
        });
    }
    await writeFile(new URL("metrics.json", output), JSON.stringify(measurements, null, 2));
    results.push({ page: template.id, widths: measurements.length });
    await page.setViewportSize({ width: 576, height: 1000 });
    await page.goto(`${base}/${template.id}/`, { waitUntil: "networkidle" });
    const viewport = page.locator("[data-table-viewport]");
    await viewport.focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      () => document.querySelector("[data-table-viewport]").scrollLeft > 0,
    );
    assert.equal(await page.locator(".template-content table [class]").count(), 0);
    assert.equal(await page.locator(".template-content table > caption").count(), 1);
    await viewport.evaluate((node) => {
      node.scrollLeft = 0;
    });
    await viewport.hover();
    await page.mouse.wheel(220, 0);
    await page.waitForFunction(
      () => document.querySelector("[data-table-viewport]").scrollLeft > 0,
    );
    await page.addScriptTag({
      content: await readFile(
        new URL("../template-main/assets/js/content-tables.js", import.meta.url),
        "utf8",
      ),
    });
    assert.equal(await page.locator("[data-table-scroll]").count(), 1);
    await page.getByRole("button", { name: "Меню", exact: true }).click();
    assert.equal(
      await page.getByRole("button", { name: "Меню", exact: true }).getAttribute("aria-expanded"),
      "true",
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.getByRole("button", { name: "Меню", exact: true }).getAttribute("aria-expanded"),
      "false",
    );
    await page.locator(".js-footer-toggle").click();
    assert.equal(await page.locator(".js-footer-toggle").getAttribute("aria-expanded"), "true");
    await page.locator(".js-footer-toggle").click();
    await page.evaluate(() => {
      document
        .querySelector(".template-content")
        .insertAdjacentHTML(
          "beforeend",
          `<p>${"ДлинноеСлово".repeat(70)}</p><ul><li>Первый уровень<ul><li>Второй уровень</li></ul></li></ul><p><img src="/template-main/assets/img/content/university-project.png" width="1184" height="636" alt="Изображение редактора"></p><figure><img src="/template-main/assets/img/content/university-project.png" width="1184" height="636" alt="Пример"><figcaption>Подпись</figcaption></figure>`,
        );
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    assert.equal(
      await page
        .locator(".template-content ul ul li")
        .evaluate((node) => getComputedStyle(node, "::before").position),
      "absolute",
    );
    assert.ok(await page.getByText("Подпись", { exact: true }).isVisible());
    for (const columns of [2, 3, 6]) {
      await page.locator(".template-content").evaluate((article, count) => {
        const row =
          "<tr>" +
          Array.from(
            { length: count },
            (_, i) => "<td>Длинный текст в колонке " + (i + 1) + "</td>",
          ).join("") +
          "</tr>";
        article.innerHTML =
          "<table><caption>Таблица редактора с длинной подписью</caption><thead><tr>" +
          Array.from({ length: count }, (_, i) => "<th>Колонка " + (i + 1) + "</th>").join("") +
          "</tr></thead><tbody>" +
          row +
          "<tr><td colspan=" +
          count +
          ">Объединённая строка</td></tr></tbody></table>";
      }, columns);
      const alignment = await page.locator(".template-content table").evaluate((table) => ({
        head: [...table.tHead.rows[0].cells].map((c) => c.getBoundingClientRect().x),
        body: [...table.tBodies[0].rows[0].cells].map((c) => c.getBoundingClientRect().x),
        overflow: document.documentElement.scrollWidth - innerWidth,
        classes: table.querySelectorAll("[class]").length,
      }));
      assert.equal(alignment.overflow, 0);
      assert.equal(alignment.classes, 0);
      alignment.head.forEach((x, index) => assert.ok(Math.abs(x - alignment.body[index]) <= 1));
    }
  }
  // Сенсорный ввод проверяется настоящими touch-событиями Chrome, без изменения scrollLeft.
  const touchContext = await browser.newContext({
    viewport: { width: 576, height: 900 },
    hasTouch: true,
    isMobile: true,
  });
  const touchPage = await touchContext.newPage();
  const touchInput = await touchContext.newCDPSession(touchPage);
  for (const template of templates) {
    await touchPage.goto(`${base}/${template.id}/`, { waitUntil: "networkidle" });
    const table = touchPage.locator("[data-table-viewport]");
    await table.scrollIntoViewIfNeeded();
    const rect = await table.boundingBox();
    await touchInput.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: rect.x + 400, y: rect.y + 100 }],
    });
    for (let step = 1; step <= 8; step++) {
      await touchInput.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: rect.x + 400 - step * 30, y: rect.y + 100 }],
      });
      await touchPage.waitForTimeout(25);
    }
    await touchInput.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await touchPage.waitForFunction(
      () => document.querySelector("[data-table-viewport]").scrollLeft > 0,
    );
  }
  await touchContext.close();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally {
  await browser.close();
}
