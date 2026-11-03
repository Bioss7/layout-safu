import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const context = vm.createContext({ URL, console });
vm.runInContext(await readFile(new URL("../core.js", import.meta.url), "utf8"), context);
const core = context.__safuFiller.core;

test("Русские подписи и autocomplete определяют назначение без путаницы с отчеством", () => {
  assert.equal(core.infer({ label: "Отчество", name: "name" }), "patronymic");
  assert.equal(core.infer({ label: "Фамилия" }), "surname");
  assert.equal(core.infer({ label: "ФИО" }), "fullname");
  assert.equal(core.infer({ autocomplete: "given-name" }), "name");
  assert.equal(core.infer({ type: "tel" }), "phone");
});

test("Набор воспроизводим, содержит русские данные и соблюдает ограничения", () => {
  assert.equal(core.generate("surname", {}, 0), "Иванов");
  assert.equal(core.generate("patronymic", {}, 0), "Сергеевич");
  assert.equal(core.generate("email", {}, 0), "test.1@example.com");
  assert.match(core.generate("phone", {}), /^\+7/);
  assert.equal(core.generate("text", { maxLength: 5 }).length, 5);
  assert.equal(core.generate("text", { minLength: 70 }).length, 70);
  assert.equal(core.generate("number", { min: "10", max: "20", step: "3" }), "10");
  assert.equal(core.generate("number", { max: "0", step: "2" }), "0");
  assert.equal(core.generate("date", { min: "2030-01-01", max: "2030-12-31" }), "2030-01-01");
});

test("Центр управляющего элемента определяет попадание в область", () => {
  assert.equal(
    core.inArea(
      { left: 0, top: 0, width: 20, height: 20 },
      { left: 9, top: 9, right: 11, bottom: 11 },
    ),
    true,
  );
  assert.equal(
    core.inArea(
      { left: 0, top: 0, width: 20, height: 20 },
      { left: 11, top: 11, right: 30, bottom: 30 },
    ),
    false,
  );
});

test("Проверка обучения никогда не выбирает встроенные правила или автораспознавание", () => {
  assert.equal(
    core.source({ training: true, learned: true, safu: true, automatic: true }),
    "learned",
  );
  assert.equal(core.source({ training: true, safu: true, automatic: true }), "unknown");
  assert.equal(core.source({ learned: true, safu: true, automatic: true }), "learned");
  assert.equal(core.source({ safu: true, automatic: true }), "safu");
  assert.equal(core.source({ automatic: true }), "automatic");
});

test("Импорт принимает только ограниченные декларативные правила текущего сайта", () => {
  const rule = {
    id: "one",
    origin: "https://example.org",
    path: "/form",
    type: "select",
    trigger: "#trigger",
    list: "#list",
    options: "[role=option]",
    state: { attribute: "aria-selected", value: "true" },
  };
  assert.equal(
    core.validateRules({ version: 1, rules: [rule] }, rule.origin)[0].trigger,
    "#trigger",
  );
  assert.throws(() =>
    core.validateRules({ version: 1, rules: [{ ...rule, script: "alert(1)" }] }, rule.origin),
  );
  assert.throws(() =>
    core.validateRules(
      { version: 1, rules: [{ ...rule, origin: "https://other.org" }] },
      rule.origin,
    ),
  );
  assert.throws(() =>
    core.validateRules(
      { version: 1, rules: [{ ...rule, state: { attribute: "onclick", value: "x" } }] },
      rule.origin,
    ),
  );
});
