import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const requests = [];
page.on("request", (request) => requests.push(request.url()));
try {
  await page.goto(`${base}/ui/`, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => !document.querySelector(".js-remarks-status").textContent.includes("Загрузка"),
  );
  const pages = JSON.parse(
    await readFile(new URL("../ui/data/pages.json", import.meta.url), "utf8"),
  );
  assert.equal(await page.locator(".catalog__card").count(), pages.length);
  assert.ok((await page.locator(".js-remarks li").count()) >= 5);
  const remarks = await (await page.request.get(`${base}/__ui/remarks`)).json();
  assert.equal(
    await page.locator(".js-remarks li").count(),
    remarks.length,
    "HTML использует JSON-реестр замечаний",
  );
  for (const link of await page
    .locator(".catalog__card h2 a")
    .evaluateAll((items) => items.map((item) => item.href))) {
    assert.ok((await page.request.get(link)).ok(), link);
  }
  await page.goto(`${base}/ui/statistics/`, { waitUntil: "networkidle" });
  assert.match(await page.locator(".js-report-status").textContent(), /Снимок/);
  const before = await (await page.request.post(`${base}/__ui/statistics/refresh`)).json();
  await page.locator(".js-refresh").click();
  await page.waitForFunction(() => !document.querySelector(".js-refresh").disabled);
  const after = await (await page.request.get(`${base}/__ui/statistics`)).json();
  assert.equal(after.blocks.status, "available");
  assert.deepEqual(before.blocks, after.blocks, "Блоки не дублируются при обновлении");
  assert.equal(await page.locator(".js-blocks tr").count(), after.blocks.entries.length);
  assert.match(
    await page.locator(".js-block-metrics").textContent(),
    new RegExp(String(after.blocks.totals.newCount)),
  );
  for (const key of ["modelResponses", "mcpCalls"]) {
    const total = (report) => report.records.reduce((sum, row) => sum + row[key], 0);
    assert.equal(total(before), total(after), `Повторный импорт ${key}`);
  }
  assert.ok(
    !/"(?:arguments|commands|file|messages|cwd)"|C:\\\\Users/i.test(JSON.stringify(after)),
    "В браузере только агрегаты",
  );
  await page.locator(".js-phase-filter").selectOption("verification");
  assert.ok(
    (await page.locator(".js-records tr").allTextContents()).every((text) =>
      text.includes("Проверка"),
    ),
  );
  await page.locator(".js-page-filter").selectOption("about");
  assert.equal(await page.locator(".js-records tr").count(), 0);
  assert.match(await page.locator(".js-metrics").textContent(), /Нет данных/);
  assert.match(await page.locator(".js-block-metrics").textContent(), /Нет данных/);
  await page.locator(".js-page-filter").selectOption("");
  await page.locator(".js-phase-filter").selectOption("");
  await page.locator(".js-date-from").fill("2099-01-01");
  assert.equal(await page.locator(".js-records tr").count(), 0, "Фильтр периода");
  assert.match(
    await page.locator(".js-block-metrics").textContent(),
    /Нет данных/,
    "Неподтверждённые даты блоков не считаются нулями",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.ok(
    requests.every((url) => url.startsWith(base)),
    "Обновление не обращается к внешним сервисам",
  );
  assert.equal(
    (
      await page.request.post(`${base}/__ui/statistics/refresh`, {
        headers: { Origin: "https://example.com" },
      })
    ).status(),
    403,
  );
  assert.deepEqual(errors, []);
  console.log(
    `UI: ${pages.length} ссылок, замечания, фильтры, локальное обновление без двойного учёта/внешних запросов, приватность, 390px — OK.`,
  );
} finally {
  await browser.close();
}
