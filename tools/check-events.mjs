import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const port = 4183;
const base = `http://127.0.0.1:${port}`;
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
const posts = [];
try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (data) => {
      if (data.toString().includes(String(port))) resolve();
    });
    server.on("error", reject);
    server.on("exit", (code) => reject(new Error(`Preview завершился: ${code}`)));
  });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1000 } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  page.on("request", (r) => {
    if (r.method() !== "GET") posts.push(r.url());
  });
  await mkdir("screenshots/events", { recursive: true });
  const geometry = [];
  for (const width of [
    320, 390, 575, 576, 577, 768, 991, 992, 993, 1200, 1439, 1440, 1441, 1920, 2560,
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}/events/`);
    await page.evaluate(() => document.fonts.ready);
    // Загружаем и декодируем в том числе изображения ниже первого экрана.
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) => {
          image.loading = "eager";
          return image.decode().catch(() => {});
        }),
      );
    });
    assert.equal(await page.locator(".event-card:visible").count(), width <= 576 ? 3 : 9);
    const submitGeometry = await page.locator(".js-submit").evaluate((button) => {
      const css = getComputedStyle(button),
        label = button.querySelector(".js-submit-label");
      const bounds = button.getBoundingClientRect(),
        text = label.getBoundingClientRect();
      return {
        height: bounds.height,
        padding: [css.paddingTop, css.paddingRight, css.paddingBottom, css.paddingLeft],
        size: css.fontSize,
        weight: css.fontWeight,
        lineHeight: css.lineHeight,
        gap: css.gap,
        textY: text.y - bounds.y,
      };
    });
    // Figma 113:3002 и 110:2147: padding одинаковый, меняется размер текста и line-height.
    // Верх line-box 18px + измеренная поправка метрик глифов 3px, padding не меняется.
    const mobile = width <= 576;
    assert.deepEqual(submitGeometry, {
      height: mobile ? 48 : 52,
      padding: ["18px", "24px", "18px", "24px"],
      size: mobile ? "12px" : "16px",
      weight: "400",
      lineHeight: mobile ? "12px" : "16px",
      gap: "10px",
      textY: 21,
    });
    const metrics = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      images: [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src),
      boxes: Object.fromEntries(
        [
          ".breadcrumbs",
          ".hero__text",
          ".hero__figure",
          ".filters",
          ".catalog__toolbar",
          ".event-card",
          ".section--contacts",
          ".contact-form",
        ].map((selector) => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return [selector, { x: r.x, y: r.y, width: r.width, height: r.height }];
        }),
      ),
    }));
    assert.ok(metrics.scrollWidth <= width, `Переполнение на ${width}`);
    assert.deepEqual(metrics.images, []);
    geometry.push(metrics);
    if ([390, 1920].includes(width))
      await page.screenshot({ path: `screenshots/events/page-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(`${base}/events/`);
  // Проверяем поиск, отсутствие результатов, очистку и фильтры с несколькими значениями.
  await page.locator(".js-search").fill("Несуществующее мероприятие");
  assert.equal(await page.locator(".js-empty").isVisible(), true);
  await page.locator(".js-search-clear").click();
  assert.equal(await page.locator(".event-card:visible").count(), 9);
  const filter = page.locator(".filters .js-topic").first();
  await filter.locator(".js-topic-trigger").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal(await filter.locator('[aria-selected="true"]').count(), 1);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal(await filter.locator('[aria-selected="true"]').count(), 2);
  await page.keyboard.press("Escape");
  assert.equal(await filter.locator(".js-topic-trigger").getAttribute("aria-expanded"), "false");
  await page.getByRole("button", { name: "Сбросить", exact: true }).click();
  assert.equal(await filter.locator("input").inputValue(), "");
  const sort = page.locator(".topic-select--sort");
  await sort.locator(".js-topic-trigger").click();
  const sortGeometry = await sort.locator(".js-topic-list").evaluate((list) => {
    const r = list.getBoundingClientRect(),
      s = getComputedStyle(list);
    return {
      width: r.width,
      height: r.height,
      padding: s.padding,
      gap: s.gap,
      border: s.borderWidth,
      rows: [...list.children].map((row) => row.getBoundingClientRect().height),
    };
  });
  // Figma 110:1522–1526: список 164×190; выбранный пункт 34px, остальные по 40px.
  assert.deepEqual(sortGeometry, {
    width: 164,
    height: 190,
    padding: "12px",
    gap: "4px",
    border: "0px",
    rows: [34, 40, 40, 40],
  });
  await sort.locator(".js-topic-list").screenshot({
    path: "screenshots/events/sort-list-1920.png",
    style: ".demo-menu{visibility:hidden}",
  });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal(await sort.locator("input").inputValue(), "По названию");
  assert.equal(await sort.locator("#sort-1").getAttribute("aria-selected"), "true");
  await sort.locator(".js-topic-trigger").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  assert.equal(await sort.locator("input").inputValue(), "");
  assert.equal(await sort.locator(".js-topic-value").textContent(), "Сортировка");
  assert.equal(await sort.locator("#sort-0").getAttribute("aria-selected"), "true");
  await page.locator('.js-page[data-page="2"]').click();
  assert.equal(await page.locator('.js-page[data-page="2"]').getAttribute("aria-current"), "page");
  // Пустая форма, неверные значения, затем отправка; никаких внешних POST-запросов.
  await page.locator(".js-submit").click();
  assert.equal(await page.locator(".js-contact-form [aria-invalid=true]").count(), 8);
  await page
    .locator(".js-contact-form")
    .screenshot({ path: "screenshots/events/form-validation.png" });
  const topic = page.locator(".contact-form .js-topic-trigger");
  await topic.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  assert.equal(await topic.getAttribute("aria-expanded"), "false");
  await page.locator("#event-surname").fill("Иванов 545");
  await page.locator("#event-name").fill("Сергей");
  await page.locator("#event-phone").fill("+7 952 125-15-48");
  await page.locator("#event-email").fill("test@example.org");
  await page.locator("#event-question").fill("Как записаться на мероприятие?");
  await page.locator(".js-consent").check();
  await page.locator(".js-submit").click();
  assert.equal(await page.locator("#event-surname").getAttribute("aria-invalid"), "true");
  const fieldGeometry = await page
    .locator("#event-surname")
    .locator("..")
    .evaluate((field) => {
      const r = field.getBoundingClientRect(),
        error = field.querySelector(".form-field__error"),
        e = error.getBoundingClientRect(),
        s = getComputedStyle(error),
        icon = getComputedStyle(error, "::before");
      return {
        height: r.height,
        errorX: e.x - r.x,
        errorY: e.y - r.y,
        errorHeight: e.height,
        padding: s.padding,
        gap: s.gap,
        color: s.color,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        lineHeight: s.lineHeight,
        icon: [icon.width, icon.height],
        clearHidden: field.querySelector(".js-field-clear").hidden,
      };
    });
  // Figma 110:2330: сообщение y=54, 18px высотой, icon 12×12, padding по 16 и gap 4.
  assert.deepEqual(fieldGeometry, {
    height: 72,
    errorX: 0,
    errorY: 54,
    errorHeight: 18,
    padding: "0px 16px",
    gap: "4px",
    color: "rgb(217, 75, 75)",
    fontSize: "12px",
    fontWeight: "500",
    lineHeight: "18px",
    icon: ["12px", "12px"],
    clearHidden: true,
  });
  await page.locator("#event-surname").locator("..").screenshot({
    path: "screenshots/events/field-error-1920.png",
    style: ".demo-menu{visibility:hidden}",
  });
  await page.locator("#event-surname").fill("Иванов");
  await page.locator(".js-submit").click();
  assert.equal(await page.locator(".js-submit").isDisabled(), true);
  await page
    .locator(".js-contact-form")
    .screenshot({ path: "screenshots/events/form-pending.png" });
  await page.locator(".js-form-result").waitFor({ state: "visible" });
  assert.match(await page.locator(".js-result-title").textContent(), /Спасибо/);
  await page
    .locator(".js-contact-form")
    .screenshot({ path: "screenshots/events/form-success.png" });
  await page.locator(".js-form-again").click();
  assert.equal(await page.locator("#event-name").inputValue(), "");
  // Ошибка имитации сохраняет введённые значения и позволяет повторить отправку.
  await page.goto(`${base}/events/?form-demo=error`);
  await topic.click();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  for (const [name, value] of Object.entries({
    surname: "Иванов",
    name: "Сергей",
    phone: "+79521251548",
    email: "test@example.org",
    question: "Как записаться?",
  }))
    await page.locator(`#event-${name}`).fill(value);
  await page.locator(".js-consent").check();
  await page.locator(".js-submit").click();
  await page.locator(".contact-form--error").waitFor();
  await page
    .locator(".js-contact-form")
    .screenshot({ path: "screenshots/events/form-send-error.png" });
  assert.equal(await page.locator("#event-name").inputValue(), "Сергей");
  await page.locator(".js-form-again").click();
  await page.locator(".js-form-result").waitFor({ state: "visible" });
  assert.match(await page.locator(".js-result-title").textContent(), /Спасибо/);
  assert.deepEqual(posts, []);
  // Меню удерживает выбранные состояния и не позволяет старому таймеру их перезаписать.
  await page.goto(`${base}/events/`);
  await page.locator(".demo-menu__toggle").click();
  const choose = async (target, state) => {
    await page.locator(`.js-demo-state[data-target="${target}"][data-state="${state}"]`).click();
    await page.waitForTimeout(60);
  };
  assert.equal(
    await page.locator(".js-demo-menu").evaluate((e) => getComputedStyle(e).position),
    "absolute",
  );
  for (const width of [1920, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator(".js-demo-menu").evaluate((e) => {
      e.open = false;
    });
    await sort.scrollIntoViewIfNeeded();
    await sort.locator(".js-topic-trigger").click();
    assert.equal(
      await sort.locator(".js-topic-list").evaluate((e) => e.getBoundingClientRect().height),
      190,
    );
    await sort.locator(".js-topic-list").screenshot({
      path: `screenshots/events/sort-list-${width}.png`,
      style: ".demo-menu{visibility:hidden}",
    });
    await sort.locator("#sort-2").click();
    const selectedLabel = await sort.locator(".js-topic-value").evaluate((e) => {
      const css = getComputedStyle(e);
      return {
        text: e.textContent.trim(),
        overflow: css.overflow,
        textOverflow: css.textOverflow,
        whiteSpace: css.whiteSpace,
      };
    });
    assert.deepEqual(selectedLabel, {
      text: "Сначала новые",
      overflow: "visible",
      textOverflow: "clip",
      whiteSpace: "normal",
    });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await sort.locator(".js-topic-trigger").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.locator(".js-demo-menu").evaluate((e) => {
      e.open = true;
    });
    for (const state of ["default", "filled", "select", "invalid", "pending", "success", "error"]) {
      await choose("form", state);
      if (state === "default") assert.equal(await page.locator("#event-name").inputValue(), "");
      if (state === "filled")
        assert.equal(await page.locator("#event-name").inputValue(), "Сергей");
      if (state === "select") assert.equal(await topic.getAttribute("aria-expanded"), "true");
      if (state === "invalid")
        assert.equal(await page.locator("#event-surname").getAttribute("aria-invalid"), "true");
      if (state === "invalid") {
        assert.equal(
          await page.locator("#error-surname").evaluate((e) => e.getBoundingClientRect().height),
          18,
        );
        assert.equal(
          await page
            .locator("#error-surname")
            .evaluate((e) => getComputedStyle(e, "::before").width),
          "12px",
        );
        await page
          .locator("#event-surname")
          .locator("..")
          .screenshot({
            path: `screenshots/events/field-error-${width}.png`,
            style: ".demo-menu{visibility:hidden}",
          });
      }
      if (state === "pending") {
        await page.waitForTimeout(1300);
        assert.equal(await page.locator(".js-submit").isDisabled(), true);
        assert.equal(
          await page.locator(".js-submit").evaluate((e) => e.getBoundingClientRect().height),
          56,
        );
      }
      if (state === "success" || state === "error")
        assert.equal(await page.locator(".js-form-result").isVisible(), true);
      if ((state === "success" || state === "error") && width === 1920) {
        const resultGeometry = await page.locator(".js-contact-form").evaluate((root) => {
          const panel = root.getBoundingClientRect();
          const box = (selector) => {
            const r = root.querySelector(selector).getBoundingClientRect();
            return { x: r.x - panel.x, y: r.y - panel.y, width: r.width, height: r.height };
          };
          return {
            height: panel.height,
            padding: getComputedStyle(root).padding,
            group: box(".js-form-result"),
            icon: box(".contact-form__result-icon"),
            title: box(".js-result-title"),
            text: box(".js-result-text"),
            button: box(".js-form-again"),
          };
        });
        // Прямые свойства Figma 110:2235/2237/2238/2245/2246/2249; допуск 1px на растрирование текста.
        assert.equal(resultGeometry.height, 613);
        assert.equal(resultGeometry.padding, "40px");
        const expected = {
          group: { x: 108, y: 121, width: 700, height: 371 },
          icon: { y: 121, width: 129, height: 129 },
          title: { x: 108, y: 282, width: 700, height: 44 },
          text: { x: 108, y: 350, width: 700, height: 58 },
          button: { x: 108, y: 440, width: 700, height: 52 },
        };
        for (const [part, properties] of Object.entries(expected))
          for (const [property, value] of Object.entries(properties))
            assert.ok(
              Math.abs(resultGeometry[part][property] - value) <= 1,
              `${state} ${part}.${property}: ${resultGeometry[part][property]} вместо ${value}`,
            );
        await page.locator(".js-contact-form").screenshot({
          path: `screenshots/events/form-${state}-geometry.png`,
          style: ".demo-menu{visibility:hidden}",
        });
      }
    }
    for (const state of ["default", "hover", "focus", "filled", "empty", "invalid"]) {
      await choose("search", state);
      if (state === "default") assert.equal(await page.locator(".js-search").inputValue(), "");
      if (state === "hover")
        assert.equal(await page.locator(".filters__search--demo-hover").count(), 1);
      if (state === "focus")
        assert.equal(
          await page.locator(".js-search").evaluate((e) => e === document.activeElement),
          true,
        );
      if (state === "filled") assert.ok(await page.locator(".event-card:visible").count());
      if (state === "empty") assert.equal(await page.locator(".js-empty").isVisible(), true);
      if (state === "invalid")
        assert.equal(await page.locator(".js-search").getAttribute("aria-invalid"), "true");
      if (state === "invalid") {
        const geometry = await page.locator(".filters__search").evaluate((root) => {
          const r = root.getBoundingClientRect(),
            error = root.querySelector(".js-search-error").getBoundingClientRect(),
            input = root.querySelector("input").getBoundingClientRect();
          return {
            height: r.height,
            errorX: error.x - r.x,
            errorY: error.y - r.y,
            inputY: input.y - r.y,
            alert: !root.querySelector(".js-search-alert").hidden,
            clear: root.querySelector(".js-search-clear").hidden,
          };
        });
        // Свойства узла 110:1632: высота 46, текст x=9.5/y=4.5 и y=21.5.
        assert.deepEqual(geometry, {
          height: 46,
          errorX: 9.5,
          errorY: 4.5,
          inputY: 21.5,
          alert: true,
          clear: true,
        });
        await page.locator(".filters__search").screenshot({
          path: `screenshots/events/search-error-${width}.png`,
          style: ".demo-menu { visibility: hidden; }",
        });
        await page.locator(".js-search").fill("интеллект");
        assert.equal(await page.locator(".js-search-error").isVisible(), false);
        assert.equal(await page.locator(".js-search-alert").isVisible(), false);
      }
    }
    await page
      .locator(".js-demo-menu")
      .screenshot({ path: `screenshots/events/demo-menu-${width}.png` });
  }
  await choose("form", "filled");
  await page.locator(".js-demo-menu").evaluate((e) => {
    e.open = false;
  });
  await page.locator(".js-submit").click();
  await page.locator(".demo-menu__toggle").click();
  await choose("form", "default");
  await page.waitForTimeout(1300);
  assert.equal(await page.locator(".js-form-result").isVisible(), false);
  assert.equal(await page.locator(".js-submit").isDisabled(), false);
  assert.deepEqual(errors, []);
  await writeFile(
    "screenshots/events/verification.json",
    JSON.stringify({ geometry, errors, posts }, null, 2),
  );
  console.log(
    "Events: 15 ширин; поиск, фильтры, клавиатура, валидация, отправка, успех, ошибка и повтор — OK. POST-запросов нет.",
  );
} finally {
  await browser?.close();
  server.kill();
}
