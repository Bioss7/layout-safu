import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, cp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";

const extensionDir = fileURLToPath(new URL("../", import.meta.url));
const layoutDir = path.resolve(extensionDir, "../..");
let server, context, worker, base, temp;

// Временная копия получает доступ только к тестовому localhost: это заменяет
// пользовательское нажатие action, недоступное в API Playwright. Рабочий manifest не меняется.
test.before(async () => {
  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      let file;
      if (pathname === "/fixture") file = path.join(extensionDir, "tests/fixture.html");
      else {
        file = path.resolve(layoutDir, "." + pathname);
        if (!file.startsWith(layoutDir + path.sep)) throw new Error("path");
      }
      let content = await readFile(file);
      if (file.endsWith(".html")) {
        // Для реальных страниц используем настоящие HTML/JS без изменения исходников.
        // CSS выравнивает только проверочный стенд; сверка дизайна сюда не входит.
        content = Buffer.from(
          content
            .toString()
            .replace(
              "</head>",
              "<style>html{scroll-behavior:auto!important}body{margin:24px;font:16px system-ui}img{max-width:80px;max-height:80px}form{max-width:500px}input,textarea,button{font:inherit;padding:5px}[hidden]{display:none!important}.topic-select__list{background:white}.topic-select__option{padding:8px}label{display:block;margin:8px 0}</style></head>",
            ),
        );
      }
      res.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "application/javascript; charset=utf-8"
          : file.endsWith(".html") || pathname === "/fixture"
            ? "text/html; charset=utf-8"
            : "application/octet-stream",
      );
      res.end(content);
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  temp = await mkdtemp(path.join(tmpdir(), "safu-filler-"));
  const copy = path.join(temp, "extension");
  await cp(extensionDir, copy, {
    recursive: true,
    filter: (src) => !src.includes(path.sep + "tests"),
  });
  const manifest = JSON.parse(await readFile(path.join(copy, "manifest.json"), "utf8"));
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "storage"]);
  assert.equal(manifest.host_permissions, undefined);
  manifest.host_permissions = [base + "/*"];
  await writeFile(path.join(copy, "manifest.json"), JSON.stringify(manifest));
  context = await chromium.launchPersistentContext(path.join(temp, "profile"), {
    channel: "chromium",
    headless: true,
    viewport: { width: 1360, height: 1000 },
    args: [`--disable-extensions-except=${copy}`, `--load-extension=${copy}`],
  });
  worker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));
});
test.after(async () => {
  await context?.close();
  await new Promise((resolve) => server?.close(resolve) || resolve());
  // Удаляем только созданный mkdtemp каталог внутри системного temp.
  if (
    temp &&
    path.resolve(temp).startsWith(path.resolve(tmpdir()) + path.sep) &&
    path.basename(temp).startsWith("safu-filler-")
  )
    await rm(temp, { recursive: true, force: true });
});
test.beforeEach(async () => {
  for (const page of context.pages()) await page.close();
  await worker.evaluate(() => chrome.storage.local.clear());
});
async function launch(page) {
  const result = await worker.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((item) => item.url === url);
    return await launch(tab.id);
  }, page.url());
  assert.equal(result.ok, true, result.error);
  await page.locator("[data-safu-filler-host] #choose").waitFor({ state: "visible" });
  await page.waitForFunction(
    () =>
      !document.querySelector("[data-safu-filler-host]").shadowRoot.querySelector("#choose")
        .disabled,
  );
}
const panel = (page) => page.locator("[data-safu-filler-host]");
async function choose(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await panel(page).locator("#choose").click();
  await page.locator(selector).click({ position: { x: 5, y: 5 } });
  await page.waitForFunction(
    () =>
      !document.querySelector("[data-safu-filler-host]").shadowRoot.querySelector("#fill").disabled,
  );
}
async function isolated(page, func, arg) {
  // CDP исполняет доверенный код теста в существующем isolated world расширения.
  // В самом расширении нет eval/new Function и не ослабляется CSP.
  const client = await context.newCDPSession(page);
  try {
    const worlds = [];
    client.on("Runtime.executionContextCreated", ({ context }) => worlds.push(context));
    await client.send("Runtime.enable");
    for (const world of worlds) {
      const check = await client.send("Runtime.evaluate", {
        contextId: world.id,
        expression: "!!globalThis.__safuFiller?.instance",
        returnByValue: true,
      });
      if (!check.result.value) continue;
      const result = await client.send("Runtime.evaluate", {
        contextId: world.id,
        expression: `(${func.toString()})(${JSON.stringify(arg)})`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails)
        throw new Error(
          result.exceptionDetails.exception?.description || result.exceptionDetails.text,
        );
      return result.result.value;
    }
    throw new Error("Не найден isolated world расширения");
  } finally {
    await client.detach();
  }
}

test("Нативные поля, независимые ARIA-компоненты, маска и события без отправки", async () => {
  const page = await context.newPage();
  await page.goto(base + "/fixture");
  await launch(page);
  await choose(page, "#test-form");
  await panel(page).locator("#fill").click();
  await panel(page).locator("#status").filter({ hasText: "Готово" }).waitFor();
  assert.equal(await page.locator("[name=surname]").inputValue(), "Иванов");
  assert.equal(await page.locator("[name=patronymic]").inputValue(), "Сергеевич");
  assert.equal(await page.locator("[name=phone]").inputValue(), "+7 (900) 000-00-01");
  assert.equal(await page.locator("[name=amount]").inputValue(), "10");
  assert.equal(await page.locator("[name=date]").inputValue(), "2030-01-01");
  assert.equal(await page.locator("[name=existing]").inputValue(), "Сохранить меня");
  assert.equal(await page.locator("[name=outside]").inputValue(), "");
  assert.equal(await page.locator("[name=blocked]").inputValue(), "");
  assert.equal(await page.locator("[name=readonly]").inputValue(), "");
  assert.equal(await page.locator("[name=consent]").isChecked(), false);
  if (process.env.SAFU_FILLER_SCREENSHOTS) {
    await mkdir(process.env.SAFU_FILLER_SCREENSHOTS, { recursive: true });
    await page.screenshot({
      path: path.join(process.env.SAFU_FILLER_SCREENSHOTS, "panel-desktop.png"),
    });
  }
  assert.equal(await page.locator("[name=format]:checked").count(), 1);
  assert.equal(await page.locator("#custom-radio [aria-checked=true]").count(), 1);
  const events = await page.evaluate(() => testEvents);
  assert.ok(events.input >= 8);
  assert.ok(events.change >= 8);
  assert.equal(events.submit, 0);
  await panel(page).locator("#choose").click();
  await page.keyboard.press("Escape");
  assert.match(await panel(page).locator("#status").textContent(), /отменён/);
  await page.close();
});

test("САФУ: готовые правила, отсутствие адаптера в обучении, мультиселект", async () => {
  const page = await context.newPage();
  await page.goto(base + "/events/index.html");
  await launch(page);
  await panel(page).locator("#safu").check();
  await choose(page, ".js-question-form");
  assert.match(await panel(page).locator("#fields").textContent(), /Правило САФУ/);
  await panel(page).locator("#fill").click();
  await panel(page).locator("#status").filter({ hasText: "Готово" }).waitFor();
  assert.equal(await page.locator("form [name=topic]").inputValue(), "Общий вопрос");
  assert.match(await page.locator(".contact-form .js-topic-value").textContent(), /Общий вопрос/);
  assert.equal(await page.locator(".contact-form [aria-selected=true]").count(), 1);
  assert.equal(await page.locator("form [name=surname]").inputValue(), "Иванов");
  await panel(page).locator("#mode").selectOption("training");
  assert.doesNotMatch(
    await panel(page).locator("#fields").textContent(),
    /Правило САФУ|Автораспознавание/,
  );
  assert.match(await panel(page).locator("#fields").textContent(), /Нужно обучение/);
  await panel(page).locator("#mode").selectOption("normal");
  const multi = await isolated(page, async () => {
    const app = globalThis.__safuFiller;
    const trigger = document.querySelector("[data-multiple=true] .js-topic-trigger");
    const rule = app.adapters.safuRule(trigger);
    const adapter = app.adapters.custom(rule, "safu");
    await adapter.apply({ onlyEmpty: false });
    const expected = adapter
      .options()
      .slice(0, 2)
      .map((node) => node.dataset.value);
    await adapter.apply({ onlyEmpty: false, fixed: expected.join("|") });
    return {
      kind: adapter.kind,
      values: adapter.read().map((node) => node.dataset.value),
      expected,
    };
  });
  assert.equal(multi.kind, "multiselect");
  assert.equal(multi.values.length, 2);
  assert.deepEqual(multi.values, multi.expected);
  await page.close();
});

test("Обучение селекта без ARIA, портал, сохранение и повторное использование", async () => {
  const page = await context.newPage();
  await page.goto(base + "/fixture");
  await launch(page);
  await panel(page).locator("#mode").selectOption("training");
  await panel(page).locator("#learn").click();
  await panel(page).locator("#wizard-next").click();
  await page.locator("#opaque-trigger").click();
  await panel(page).locator("#wizard-next").filter({ hasText: "Открыть" }).click();
  await panel(page).locator("#wizard-next").filter({ hasText: "Указать список" }).click();
  await page.locator("#portal").click({ position: { x: 2, y: 2 } });
  await panel(page).locator("#wizard-next").filter({ hasText: "Указать вариант" }).click();
  await page.locator(".entry").first().click();
  await panel(page).locator("#wizard-next").filter({ hasText: "Проверить" }).click();
  await panel(page).locator("#wizard-next").filter({ hasText: "Сохранить" }).click();
  await page.waitForFunction(
    () =>
      !document.querySelector("[data-safu-filler-host]").shadowRoot.querySelector("#learn")
        .disabled,
  );
  await page.reload();
  await launch(page);
  await choose(page, "#test-form");
  assert.match(await panel(page).locator("#fields").textContent(), /Обучение/);
  assert.doesNotMatch(
    await panel(page).locator("#fields").textContent(),
    /Правило САФУ|Автораспознавание/,
  );
  await panel(page).locator("#fill").click();
  await panel(page).locator("#status").filter({ hasText: "Готово" }).waitFor();
  assert.equal(await page.locator("[name=opaque]").inputValue(), "first");
  assert.equal(await page.locator(".is-chosen").count(), 1);
  await panel(page).locator("#rules-details").locator("summary").click();
  await panel(page).locator("#export").click();
  const payload = JSON.parse(await panel(page).locator("#json").inputValue());
  assert.equal(payload.rules.length, 1);
  assert.equal(payload.rules[0].state.className, "is-chosen");
  assert.equal(payload.rules[0].path, "/fixture");
  assert.equal(payload.rules[0].script, undefined);
  await panel(page).locator("#clear").click();
  await panel(page).locator("#json").fill(JSON.stringify(payload));
  await panel(page).locator("#import").click();
  await panel(page).locator("#status").filter({ hasText: "импортированы" }).waitFor();
  await page.close();
});

async function teachSelect(page, trigger, list, option) {
  await panel(page).locator("#learn").click();
  await panel(page).locator("#wizard-next").click();
  await page.locator(trigger).click();
  await panel(page).locator("#wizard-next").filter({ hasText: "Открыть" }).click();
  await panel(page).locator("#wizard-next").filter({ hasText: "Указать список" }).click();
  await page.locator(list).click({ position: { x: 2, y: 2 } });
  await panel(page).locator("#wizard-next").filter({ hasText: "Указать вариант" }).click();
  await page.locator(option).first().click();
  await panel(page).locator("#wizard-next").filter({ hasText: "Проверить" }).click();
  await panel(page).locator("#wizard-next").filter({ hasText: "Сохранить" }).click();
  await page.waitForFunction(
    () =>
      !document.querySelector("[data-safu-filler-host]").shadowRoot.querySelector("#learn")
        .disabled,
  );
}

test("Одна форма САФУ: обучение вручную даёт тот же результат, что готовый адаптер", async () => {
  const page = await context.newPage();
  await page.goto(base + "/events/index.html");
  await launch(page);
  await panel(page).locator("#safu").check();
  await choose(page, ".js-question-form");
  await panel(page).locator("#fill").click();
  await panel(page).locator("#status").filter({ hasText: "Готово" }).waitFor();
  const before = await page
    .locator(".js-question-form")
    .evaluate((form) => Object.fromEntries(new FormData(form)));
  await page.reload();
  await launch(page);
  await panel(page).locator("#mode").selectOption("training");
  await page.locator(".contact-form .js-topic-trigger").scrollIntoViewIfNeeded();
  await teachSelect(
    page,
    ".contact-form .js-topic-trigger",
    "#topic-list",
    "#topic-list .js-topic-option",
  );
  await page.reload();
  await launch(page);
  await choose(page, ".js-question-form");
  const sources = await panel(page).locator("#fields").textContent();
  assert.match(sources, /Обучение/);
  assert.doesNotMatch(sources, /Правило САФУ|Автораспознавание/);
  await panel(page).locator("#fill").click();
  await panel(page).locator("#status").filter({ hasText: "Готово" }).waitFor();
  const after = await page
    .locator(".js-question-form")
    .evaluate((form) => Object.fromEntries(new FormData(form)));
  assert.deepEqual(after, before);
  assert.equal(await page.locator(".contact-form [aria-selected=true]").count(), 1);
  await page.close();
});

test("Программы: второй настоящий селект САФУ, подпись и значение", async () => {
  const page = await context.newPage();
  await page.goto(base + "/programs/index.html");
  await launch(page);
  await panel(page).locator("#safu").check();
  const result = await isolated(page, async () => {
    const app = globalThis.__safuFiller;
    const trigger = document.querySelector("[data-topic] [role=combobox]");
    const rule = app.adapters.safuRule(trigger);
    const adapter = app.adapters.custom(rule, "safu");
    await adapter.apply({ onlyEmpty: false });
    return {
      value: trigger.closest("[data-topic]").querySelector("[name=topic]").value,
      label: trigger.querySelector("[data-topic-label]").textContent.trim(),
      selected: adapter.read().length,
    };
  });
  assert.equal(result.value, "admission");
  assert.equal(result.label, "Поступление");
  assert.equal(result.selected, 1);
  await page.close();
});

test("Обучение кастомных radio и checkbox сохраняет только учебные правила", async () => {
  const page = await context.newPage();
  await page.goto(base + "/fixture");
  await launch(page);
  await panel(page).locator("#mode").selectOption("training");
  await page.locator("#custom-radio").scrollIntoViewIfNeeded();
  await panel(page).locator("#learn-type").selectOption("radio");
  await panel(page).locator("#learn").click();
  await panel(page).locator("#wizard-next").click();
  await page.locator("#custom-radio").click({ position: { x: 2, y: 2 } });
  await panel(page).locator("#wizard-next").filter({ hasText: "Указать вариант" }).click();
  await page.locator("#custom-radio [role=radio]").first().click();
  await panel(page).locator("#wizard-next").filter({ hasText: "Проверить" }).click();
  await panel(page).locator("#wizard-next").filter({ hasText: "Сохранить" }).click();
  await panel(page).locator("#learn-type").selectOption("checkbox");
  await panel(page).locator("#learn").click();
  await panel(page).locator("#wizard-next").click();
  await page.locator("#custom-check").click();
  await panel(page).locator("#wizard-next").filter({ hasText: "Проверить" }).click();
  await panel(page).locator("#wizard-next").filter({ hasText: "Сохранить" }).click();
  await page.reload();
  await launch(page);
  await choose(page, "#test-form");
  assert.equal(
    await panel(page)
      .locator(".badge")
      .filter({ hasText: /^Обучение$/ })
      .count(),
    2,
  );
  const card = panel(page)
    .locator(".field")
    .filter({ has: page.locator(".field-title").filter({ hasText: /^Новости$/ }) });
  await card.getByLabel("Состояние checkbox").selectOption("true");
  await panel(page).locator("#fill").click();
  await panel(page).locator("#status").filter({ hasText: "Готово" }).waitFor();
  assert.equal(await page.locator("#custom-check").getAttribute("aria-checked"), "true");
  assert.equal(await page.locator("#custom-radio [aria-checked=true]").count(), 1);
  const counts = await worker.evaluate(async () => {
    const data = (await chrome.storage.local.get("safu-form-filler-v1"))["safu-form-filler-v1"];
    return [data.normalRules.length, data.trainingRules.length];
  });
  assert.deepEqual(counts, [0, 2]);
  await page.close();
});

test("Область выбирает только попавшие поля; закрытие и повторное открытие без дублей", async () => {
  const page = await context.newPage();
  await page.goto(base + "/fixture");
  await launch(page);
  const box = await page.locator("[name=surname]").boundingBox();
  await panel(page).locator("#area").click();
  await page.mouse.move(box.x - 3, box.y - 3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 3, box.y + box.height + 3, { steps: 5 });
  await page.mouse.up();
  assert.equal(await panel(page).locator("#count").textContent(), "1");
  await panel(page).locator("#fill").click();
  await panel(page).locator("#status").filter({ hasText: "Готово" }).waitFor();
  assert.equal(await page.locator("[name=surname]").inputValue(), "Иванов");
  assert.equal(await page.locator("[name=name]").inputValue(), "");
  await panel(page).locator("#close").click();
  assert.equal(await panel(page).isVisible(), false);
  await launch(page);
  assert.equal(await page.locator("[data-safu-filler-host]").count(), 1);
  await page.close();
});

test("Устаревшие/неоднозначные локаторы, импорт, сохранность обычного набора и защита submit", async () => {
  const page = await context.newPage();
  await page.goto(base + "/fixture");
  await launch(page);
  const result = await isolated(page, async () => {
    const app = globalThis.__safuFiller;
    const rule = {
      id: "normal",
      origin: location.origin,
      path: location.pathname,
      type: "checkbox",
      trigger: "#custom-check",
      state: { attribute: "aria-checked", value: "true" },
    };
    await app.storage.saveRule(rule);
    await app.storage.updateSettings({ training: true });
    await app.storage.saveRule({ ...rule, id: "training" });
    await app.storage.clearTraining();
    const cleared = app.storage.rules().length;
    await app.storage.updateSettings({ training: false });
    const normal = app.storage.rules().length;
    const errors = [];
    for (const selector of ["#missing", "[role=radio]"])
      try {
        app.dom.unique(selector);
      } catch (error) {
        errors.push(error.message);
      }
    let protectedSubmit = false;
    try {
      app.dom.click(document.querySelector("#submit"));
    } catch {
      protectedSubmit = true;
    }
    const fields = app.adapters.scan({ root: document.querySelector("form") }, { training: true }, [
      { ...rule, trigger: "#missing" },
    ]);
    return {
      cleared,
      normal,
      errors: errors.length,
      stale: fields.some((field) => field.error?.includes("повторное обучение")),
      protectedSubmit,
    };
  });
  assert.deepEqual(result, {
    cleared: 0,
    normal: 1,
    errors: 2,
    stale: true,
    protectedSubmit: true,
  });
  await page.close();
});

test("Нативные поля с явным role, только пустые checkbox и защита вложенного reset", async () => {
  const page = await context.newPage();
  await page.goto(base + "/fixture");
  await launch(page);
  const result = await isolated(page, async () => {
    const app = globalThis.__safuFiller;
    const select = document.querySelector("[name=city]");
    select.setAttribute("role", "combobox");
    const check = document.querySelector("#custom-check");
    check.setAttribute("aria-checked", "true");
    const adapter = app.adapters.custom(app.adapters.automaticRule(check), "automatic");
    const status = await adapter.apply({ onlyEmpty: true, checked: false });
    const fields = app.adapters.scan(
      { root: document.querySelector("form") },
      { training: true },
      [],
    );
    const reset = document.createElement("button");
    reset.type = "reset";
    reset.innerHTML = "<span>Сброс</span>";
    document.querySelector("form").append(reset);
    let resetProtected = false;
    try {
      app.dom.click(reset.firstElementChild);
    } catch {
      resetProtected = true;
    }
    return {
      selectSource: fields.find((field) => field.node === select)?.source,
      checked: check.getAttribute("aria-checked"),
      status,
      resetProtected,
    };
  });
  assert.deepEqual(result, {
    selectSource: "native",
    checked: "true",
    status: "skipped",
    resetProtected: true,
  });
  await page.close();
});

test("Обучение списка, создаваемого при открытии и удаляемого после выбора", async () => {
  const page = await context.newPage();
  await page.goto(base + "/fixture");
  await launch(page);
  await panel(page).locator("#mode").selectOption("training");
  await page.locator("#dynamic-trigger").scrollIntoViewIfNeeded();
  await teachSelect(page, "#dynamic-trigger", "#dynamic-list", "#dynamic-list [role=option]");
  await page.reload();
  await launch(page);
  await page.locator("#dynamic-trigger").scrollIntoViewIfNeeded();
  await panel(page).locator("#container").click();
  await page.locator("#dynamic-trigger").click();
  await panel(page).locator("#fill").click();
  await panel(page).locator("#status").filter({ hasText: "Готово" }).waitFor();
  assert.equal(await page.locator("#dynamic-trigger").textContent(), "Север");
  assert.doesNotMatch(
    await panel(page).locator("#report").textContent(),
    /не подтвердил|повторное обучение/,
  );
  assert.equal(await page.locator("#dynamic-list").count(), 0);
  await page.close();
});

test("Панель на 390px: доступные элементы, отсутствие переполнения и снимок", async () => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/fixture");
  await launch(page);
  const metrics = await panel(page)
    .locator(".panel")
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        bottom: r.bottom,
        inner: el.scrollWidth <= el.clientWidth,
      };
    });
  assert.ok(
    metrics.left >= 0 && metrics.right <= 390 && metrics.bottom <= 844 && metrics.inner,
    JSON.stringify(metrics),
  );
  assert.equal(await panel(page).locator("#fill").isVisible(), true);
  if (process.env.SAFU_FILLER_SCREENSHOTS) {
    await mkdir(process.env.SAFU_FILLER_SCREENSHOTS, { recursive: true });
    await page.screenshot({
      path: path.join(process.env.SAFU_FILLER_SCREENSHOTS, "panel-mobile.png"),
    });
  }
  await page.close();
});
