import test from "node:test";
import assert from "node:assert/strict";
import { summarizeBlocks } from "../ui/ui-block-metrics.js";
import {
  checkProjectData,
  collectRemarks,
  loadBlockInventory,
  validateComponentMetadata,
} from "./project-data.mjs";

const inventory = {
  status: "available",
  pageIds: ["example", "unknown"],
  auditedPages: ["example"],
  entries: [
    { id: "hero", page: "example", origin: "new", addedAt: null, phase: null },
    { id: "card", page: "example", origin: "new", addedAt: "2026-10-20", phase: "implementation" },
    {
      id: "header",
      page: "example",
      origin: "existing",
      addedAt: "2026-10-19",
      phase: "implementation",
    },
  ],
};

test("компонент считается один раз; новые и перенесённые разделены", () => {
  const result = summarizeBlocks({
    ...inventory,
    entries: [...inventory.entries, inventory.entries[0]],
  });
  assert.equal(result.newCount, 2);
  assert.equal(result.existingCount, 1);
  assert.equal(result.entries.length, 3);
  assert.equal(result.partial, true);
});

test("непроверенная страница и недоступный источник не подменяются нулями", () => {
  assert.equal(summarizeBlocks(inventory, { page: "unknown" }).newCount, null);
  assert.equal(summarizeBlocks(undefined).newCount, null);
});

test("неподтверждённые даты и этапы дают нет данных при фильтрации", () => {
  const phase = summarizeBlocks(inventory, { phase: "implementation" });
  assert.equal(phase.newCount, null);
  assert.equal(phase.existingCount, 1);
  const period = summarizeBlocks(inventory, { from: "2026-10-20", to: "2026-10-20" });
  assert.equal(period.newCount, null);
  assert.equal(period.existingCount, 0);
  assert.equal(period.unknownEntries, 1);
  const unknown = summarizeBlocks(inventory, { phase: "unknown" });
  assert.equal(unknown.newCount, 1);
  assert.equal(unknown.existingCount, 0);
  assert.deepEqual(
    period.entries.map((entry) => entry.id),
    ["card"],
  );
});

test("повторное чтение реестров не меняет данные; JSON ссылается на существующие компоненты и строки", async () => {
  assert.deepEqual(await collectRemarks(), await collectRemarks());
  const result = await checkProjectData();
  assert.ok(result.remarks > 0);
  assert.ok(result.newBlocks > 0);
  for (const remark of await collectRemarks()) {
    assert.ok(remark.line > 0);
    assert.ok(remark.text.startsWith("Замечание"));
  }
});

test("метаданные переиспользования сохраняются и не увеличивают счётчики", async () => {
  const inventory = await loadBlockInventory();
  assert.ok(
    inventory.reusableComponents.some(
      (entry) => entry.id === "link-arrow" && entry.page === "main",
    ),
  );
  assert.ok(inventory.entries.every((entry) => entry.files.length && entry.purpose));
  assert.deepEqual(
    summarizeBlocks(inventory),
    summarizeBlocks({
      ...inventory,
      reusableComponents: [...inventory.reusableComponents, ...inventory.reusableComponents],
    }),
  );
  assert.throws(() => validateComponentMetadata({ files: ["../secret.json"] }));
  assert.throws(() => validateComponentMetadata({ files: ["C:/private.json"] }));
  assert.throws(() => validateComponentMetadata({ files: [".ai-statistics/report.json"] }));
});
