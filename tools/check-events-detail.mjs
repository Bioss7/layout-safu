import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium, expect } from "@playwright/test";

const base = "http://127.0.0.1:4186";
// Прямые координаты Figma: 27:1957 / 2002:2438 / 2002:2462 и
// 70:888 / 2002:2385 / 2002:2409. Не пересчитывать из текущего CSS.
const figmaFrames = {
  1920: {
    ".hero__card": [100, 320, 1720, 650],
    ".contacts": [0, 4206, 1920, 725],
    ".contact-form": [903, 4306, 917, 525],
  },
  390: {
    ".hero__card": [16, 216, 358, 1114],
    ".contacts": [0, 6833, 390, 1444],
    ".contact-form": [16, 7461, 358, 792],
  },
};
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4186",
    "--strictPort",
  ],
  { stdio: "pipe" },
);
let browser;
const errors = [],
  catalogWarnings = [],
  writes = [],
  geometry = [];
try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (data) => {
      if (data.toString().includes("4186")) resolve();
    });
    server.on("error", reject);
    server.on("exit", (code) => reject(new Error(`Preview завершился: ${code}`)));
  });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const url = message.location().url;
    // У исходного каталога нет favicon. Существующий ответ 404 общей
    // точки /favicon.ico записывается отдельно от ресурсов детальной.
    if (url === `${base}/favicon.ico` && message.text().includes("404")) {
      catalogWarnings.push(`${message.text()} ${url}`);
    } else errors.push(`${message.text()} ${url}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  await mkdir("screenshots/events-detail", { recursive: true });
  const widths = [
    320, 390, 480, 575, 576, 577, 672, 767, 768, 769, 880, 991, 992, 993, 1100, 1199, 1200, 1201,
    1300, 1399, 1400, 1401, 1600, 1920, 2560,
  ];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}/events/detail/`);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map(async (image) => {
          image.loading = "eager";
          await image.decode();
        }),
      );
    });
    assert.equal(
      await page.locator("h1").count(),
      1,
      "Детальная страница должна открываться из сборки",
    );
    assert.equal(await page.locator(".js-registration-form").count(), 1);
    assert.equal(await page.locator(".event-card:visible").count(), width <= 576 ? 3 : 4);
    assert.equal(await page.locator(".js-registration-form .js-field-input").count(), 5);
    assert.equal(
      await page.locator(".js-registration-form select, .js-registration-form textarea").count(),
      0,
    );
    const bounds = await page.evaluate(() => {
      const root = document.documentElement;
      const selectors = [
        ".hero__card",
        ".event-about",
        ".event-benefits",
        ".event-steps",
        ".event-location",
        ".related-events",
        ".contacts",
        ".contact-form",
        ".js-submit",
        "h1",
      ];
      return {
        viewport: innerWidth,
        scrollWidth: root.scrollWidth,
        blocks: Object.fromEntries(
          selectors.map((selector) => {
            const element = document.querySelector(selector),
              rect = element.getBoundingClientRect(),
              css = getComputedStyle(element);
            return [
              selector,
              {
                x: rect.x,
                y: rect.y + scrollY,
                width: rect.width,
                height: rect.height,
                fontSize: css.fontSize,
                lineHeight: css.lineHeight,
                padding: css.padding,
              },
            ];
          }),
        ),
      };
    });
    assert.ok(
      bounds.scrollWidth <= width + 1,
      `Горизонтальное переполнение на ${width}: ${bounds.scrollWidth}`,
    );
    geometry.push(bounds);
    for (const [selector, expected] of Object.entries(figmaFrames[width] || {})) {
      for (const [index, property] of ["x", "y", "width", "height"].entries()) {
        assert.ok(
          Math.abs(bounds.blocks[selector][property] - expected[index]) <= 1,
          `Figma ${width}, ${selector}, ${property}: ${bounds.blocks[selector][property]} вместо ${expected[index]}`,
        );
      }
    }
    if ([390, 1920].includes(width)) {
      await page.locator(".demo-menu").evaluate((menu) => (menu.style.visibility = "hidden"));
      await page.screenshot({ path: `screenshots/events-detail/${width}.png`, fullPage: true });
    }
    // Итоговая панель должна помещаться и между ширинами кадров Figma.
    await page.locator(".demo-menu").evaluate((menu) => (menu.style.visibility = ""));
    await page.locator(".demo-menu__toggle").click();
    await page.locator("[data-state=error]").click();
    await expect(page.locator(".contact-form")).toHaveClass(/contact-form--error/);
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `Переполнение результата на ${width}`,
    );
  }
  await writeFile(
    "screenshots/events-detail/geometry.json",
    JSON.stringify(geometry, null, 2) + "\n",
  );
  for (const width of [1920, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}/events/detail/?form-demo=error`);
    const form = page.locator(".js-registration-form");
    await page.locator(".hero__apply").click();
    await page.locator(".js-submit").click();
    assert.equal(await form.locator('[aria-invalid="true"]').count(), 5);
    assert.equal(await page.evaluate(() => document.activeElement.name), "surname");
    for (const [name, value] of Object.entries({
      surname: "Иванов",
      name: "Сергей",
      phone: "+7 (952) 125-15-48",
      email: "test@example.org",
    }))
      await form.locator(`[name=${name}]`).fill(value);
    await form.locator("[name=consent]").check();
    await form.locator("[name=phone]").fill("123");
    await page.locator(".js-submit").click();
    assert.equal(await form.locator("[name=phone]").getAttribute("aria-invalid"), "true");
    await form.locator("[name=phone]").fill("+7 (952) 125-15-48");
    await form.locator("[name=email]").fill("неверная почта");
    await page.locator(".js-submit").click();
    assert.equal(await form.locator("[name=email]").getAttribute("aria-invalid"), "true");
    await form.locator("[name=email]").fill("test@example.org");
    await page.locator(".js-submit").click();
    assert.equal(await form.getAttribute("aria-busy"), "true");
    assert.equal(await page.locator(".js-submit").isDisabled(), true);
    await page.locator(".contact-form--error").waitFor();
    assert.equal(await form.locator("[name=surname]").inputValue(), "Иванов");
    await page.locator(".js-form-again").click();
    await page.locator(".js-result-title").filter({ hasText: "Спасибо за заявку!" }).waitFor();
    await page.screenshot({
      path: `screenshots/events-detail/success-${width}.png`,
      fullPage: true,
    });
    await page.locator(".js-form-again").click();
    assert.equal(await form.locator("[name=surname]").inputValue(), "");
    assert.equal(await page.evaluate(() => document.activeElement.name), "surname");
    await page.locator(".demo-menu__toggle").click();
    for (const state of ["filled", "invalid", "pending", "success", "error", "default"]) {
      await page.locator(`[data-state=${state}]`).click();
      if (state === "filled") await expect(form.locator("[name=surname]")).toHaveValue("Иванов");
      if (state === "invalid")
        await expect(form.locator("[name=surname]")).toHaveAttribute("aria-invalid", "true");
      if (state === "pending") await expect(form).toHaveAttribute("aria-busy", "true");
      if (["success", "error"].includes(state))
        await expect(page.locator(".js-form-result")).toBeVisible();
      if (state === "error")
        await expect(page.locator(".contact-form")).toHaveClass(/contact-form--error/);
      if (state === "default") await expect(form).toBeVisible();
      if (state === "default" && width === 390) {
        assert.match(await page.locator(".js-hint-text").innerText(), /связь\s*\nв течение/);
      }
      if (["invalid", "pending", "success", "error"].includes(state)) {
        await page.locator(".demo-menu").evaluate((menu) => (menu.style.visibility = "hidden"));
        await page
          .locator(".contact-form")
          .screenshot({ path: `screenshots/events-detail/form-${state}-${width}.png` });
        await page.locator(".demo-menu").evaluate((menu) => (menu.style.visibility = ""));
        if (["success", "error"].includes(state) && width === 1920) {
          assert.equal(
            await page
              .locator(".contact-form")
              .evaluate((element) => element.getBoundingClientRect().height),
            613,
          );
        }
      }
    }
    await page.locator("[data-state=filled]").click();
    await page.locator(".js-submit").click();
    await page.locator("[data-state=default]").click();
    await page.waitForTimeout(1300);
    assert.equal(
      await form.isVisible(),
      true,
      "Устаревший ответ не должен менять выбранное состояние",
    );
    await page.locator(".demo-menu__toggle").focus();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".demo-menu").evaluate((menu) => menu.open), false);
    await page.locator(".breadcrumbs__link").filter({ hasText: "Мероприятия" }).click();
    await page.waitForURL("**/events/");
    await page.locator(".event-card__link").first().click();
    await page.waitForURL("**/events/detail/");
    assert.deepEqual(
      await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
      { local: 0, session: 0 },
    );
  }
  assert.deepEqual(errors, [], "Ошибки браузера и ресурсов");
  assert.deepEqual(writes, [], "Демоформа не отправляет данные");
  await writeFile(
    "screenshots/events-detail/verification.json",
    JSON.stringify(
      { widths, errors, catalogWarnings, writes, formWidths: [1920, 390], resultWidths: widths },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    "screenshots/events-detail/geometry.json",
    JSON.stringify(geometry, null, 2) + "\n",
  );
  console.log(
    `Детальная мероприятия: ${widths.length} ширин, форма на 1920/390, переходы, запросы и хранилища — OK`,
  );
} finally {
  await browser?.close();
  server.kill();
}
