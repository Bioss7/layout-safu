import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

// Локальная имитация панели, без обращения к серверу Битрикс.
const css = await readFile(
  new URL("../../local/templates/safu/integration/bitrix.css", import.meta.url),
  "utf8",
);
const js = await readFile(
  new URL("../../local/templates/safu/integration/bitrix.js", import.meta.url),
  "utf8",
);
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32" ? { channel: "chrome" } : {}),
});
let checks = 0;
try {
  for (const [route, layout] of [
    ["/", "home"],
    ["/abiturient/", "abiturient"],
    ["/students/", "students"],
  ]) {
    for (const width of [1920, 1440, 1200, 992, 768, 576, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await page.goto("http://127.0.0.1:4173" + route, { waitUntil: "networkidle" });
      await page.addStyleTag({ content: css });
      await page.evaluate(
        ({ js, layout }) => {
          document.body.dataset.safuLayout = layout;
          document.querySelector("main").id = "main";
          const panel = document.createElement("div");
          panel.id = "bx-panel";
          panel.style.height = "40px";
          document.body.prepend(panel);
          // Повторное событие затронуло бы компоненты: запускаем только обработчик интеграции.
          const script = document.createElement("script");
          script.textContent = js
            .replace("document.addEventListener('DOMContentLoaded', () => {", "(() => {")
            .replace(/\}\);\s*$/, "})();");
          document.body.append(script);
        },
        { js, layout },
      );
      for (const position of ["static", "fixed"]) {
        for (const height of [40, 80, 81]) {
          await page.evaluate(
            ({ position, height }) => {
              const panel = document.getElementById("bx-panel");
              panel.style.position = position;
              panel.style.height = height + "px";
            },
            { position, height },
          );
          await page.waitForFunction(
            (height) =>
              document.body.style.getPropertyValue("--safu-panel-offset") === height + "px",
            height,
          );
          const metrics = await page.evaluate(() => ({
            header: document.querySelector(".header").getBoundingClientRect().top,
            main: document.querySelector("main").getBoundingClientRect().top,
            padding: parseFloat(getComputedStyle(document.querySelector("main")).paddingTop),
          }));
          assert.equal(
            metrics.header,
            height,
            `${layout} ${width} ${position} ${height}: header ${JSON.stringify(await page.evaluate(() => ({ body: document.body.getBoundingClientRect().top, panel: document.getElementById("bx-panel").getBoundingClientRect().top, top: getComputedStyle(document.querySelector(".header")).top, position: getComputedStyle(document.querySelector(".header")).position, margin: getComputedStyle(document.querySelector(".header")).margin, bodyPosition: getComputedStyle(document.body).position, main: document.querySelector("main").getBoundingClientRect().top })))}`,
          );
          if (layout === "students")
            assert.equal(
              metrics.main + metrics.padding,
              height,
              "Панель сдвигает содержимое один раз",
            );
          checks++;
        }
      }
      await page.close();
    }
  }
  console.log(`Bitrix panel simulation: ${checks} checks passed.`);
} finally {
  await browser.close();
}
