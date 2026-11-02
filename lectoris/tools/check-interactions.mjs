import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({ headless: true, args: ["--disable-logging"] });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto("http://127.0.0.1:4178/", { waitUntil: "load", timeout: 60000 });
  assert.equal(await page.locator(".js-review-card").count(), 5, "Пять согласованных слайдов");
  async function checkSlide(target, id, name, quote) {
    const card = target.locator(".speaker-card--active");
    await expect(card).toHaveAttribute("data-speaker", id);
    await expect(card.locator(".speaker-card__name")).toHaveText(name);
    await expect(card.locator(".speaker-card__description")).not.toBeEmpty();
    await expect(target.locator(".js-hero-quote-text")).toContainText(quote);
    await expect(target.locator('.js-review-dot[aria-current="true"]')).toHaveCount(1);
    await expect(target.locator('.js-review-dot[aria-current="true"]')).toHaveAttribute(
      "aria-label",
      "Показать: " + name,
    );
    assert.equal(await target.locator(".js-review-card:visible").count(), 3);
  }
  const expected = [
    ["anna", "Анна Тукачёва", "Здесь можно не только делиться опытом, но и самому находить новое"],
    ["gulnaz", "Гульназ Ижбаева", "Вместе проще находить решения и развивать высшее образование."],
    [
      "irina",
      "Ирина Соколова",
      "Практика коллег помогает превращать новые идеи в работающие решения.",
    ],
    [
      "dmitry",
      "Дмитрий Орлов",
      "Учиться друг у друга — значит вместе менять образование к лучшему.",
    ],
    [
      "alexey",
      "Алексей Шиманский",
      "Обмениваясь опытом, мы находим новые возможности для университетов.",
    ],
  ];
  assert.equal(await page.locator(".js-review-dot").count(), 5);
  await checkSlide(page, ...expected[0]);
  const active = () => page.locator(".speaker-card--active").getAttribute("data-speaker");
  assert.equal(await active(), "anna", "Начальная карточка — Анна");
  await page.getByRole("button", { name: "Следующий спикер" }).click();
  await page.waitForTimeout(320);
  assert.equal(await active(), "gulnaz", "Стрелка переключает на Гульназ");
  await checkSlide(page, ...expected[1]);
  for (const index of [2, 3, 4, 0]) {
    await page.getByRole("button", { name: "Следующий спикер" }).click();
    await checkSlide(page, ...expected[index]);
  }
  await page.getByRole("button", { name: "Предыдущий спикер" }).click();
  await checkSlide(page, ...expected[4]);
  for (const item of expected) {
    await page.getByRole("button", { name: "Показать: " + item[1] }).click();
    await checkSlide(page, ...item);
  }
  await page.getByRole("button", { name: "Показать: Алексей Шиманский" }).click();
  assert.equal(await active(), "alexey", "Точки переключают слайды");
  await page.locator(".js-reviews").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await active(), "anna", "Работают клавиши стрелок");
  const dot = page.getByRole("button", { name: "Показать: Анна Тукачёва" });
  assert.equal(await dot.getAttribute("aria-current"), "true");
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = page.locator(".js-header-toggle");
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-expanded"), "true", "Мобильное меню открывается");
  await page.keyboard.press("Escape");
  assert.equal(await toggle.getAttribute("aria-expanded"), "false", "Escape закрывает меню");
  assert.equal(await toggle.evaluate((n) => n === document.activeElement), true);
  await toggle.click();
  await page.locator(".js-header-menu a").first().click();
  assert.equal(await toggle.getAttribute("aria-expanded"), "false", "Выбор пункта закрывает меню");
  await toggle.click();
  await page.setViewportSize({ width: 1200, height: 1080 });
  assert.equal(
    await page.locator(".js-header-menu").isVisible(),
    true,
    "На десктопе меню доступно после resize",
  );
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await page.setViewportSize({ width: 390, height: 1080 });
  await page.locator(".js-reviews").scrollIntoViewIfNeeded();
  let bounds = await page.locator(".js-reviews-viewport").boundingBox();
  const beforeSwipe = await active();
  await page.mouse.move(260, bounds.y + 180);
  await page.mouse.down();
  await page.mouse.move(100, bounds.y + 185, { steps: 8 });
  await page.mouse.up();
  assert.notEqual(await active(), beforeSwipe, "Перетаскивание переключает спикера");

  // Реальное касание проверяется отдельно от мыши, включая нативный pointercancel.
  const touchPage = await browser.newPage({
    viewport: { width: 390, height: 1080 },
    hasTouch: true,
  });
  await touchPage.goto("http://127.0.0.1:4178/", { waitUntil: "load", timeout: 60000 });
  await touchPage.locator(".js-reviews").scrollIntoViewIfNeeded();
  const touchActive = () => touchPage.locator(".speaker-card--active").getAttribute("data-speaker");
  const touchBefore = await touchActive();
  bounds = await touchPage.locator(".js-reviews-viewport").boundingBox();
  const cdp = await touchPage.context().newCDPSession(touchPage);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 260, y: bounds.y + 180 }],
  });
  for (let x = 240; x >= 100; x -= 20) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: bounds.y + 180 }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert.notEqual(await touchActive(), touchBefore, "Свайп касанием переключает спикера");
  assert.equal(
    await touchPage.locator(".feature-card__socials").isVisible(),
    true,
    "Соцсети доступны без hover",
  );
  const afterSwipe = await touchActive();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 195, y: bounds.y + 180 }],
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await touchPage.getByRole("button", { name: "Следующий спикер" }).click();
  assert.notEqual(
    await touchActive(),
    afterSwipe,
    "После pointercancel управление продолжает работать",
  );
  await checkSlide(touchPage, ...expected[2]);
  await touchPage.close();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator(".feature-card--network").hover();
  await expect(page.locator(".feature-card__socials")).toBeVisible();
  await page.mouse.move(10, 10);
  await page.locator(".feature-card--network a").first().focus();
  await expect(page.locator(".feature-card__socials")).toBeVisible();
  console.log(
    "PASS: slider cycle, dots, keyboard, mouse drag, touch swipe/cancel, hover/focus, mobile menu and resize",
  );
} finally {
  await browser.close();
}
