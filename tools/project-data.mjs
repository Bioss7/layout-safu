import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { summarizeBlocks } from "../ui/ui-block-metrics.js";
import { renderSharedHtml } from "./page-assets.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (file) => JSON.parse(await readFile(resolve(root, file), "utf8"));

export async function collectRemarks() {
  const data = await readJson("ui/data/remarks.json");
  if (data.schemaVersion !== 1 || !Array.isArray(data.remarks))
    throw new Error("Некорректный реестр замечаний.");
  const seen = new Set();
  const remarks = [];
  for (const entry of data.remarks) {
    if (!/^[a-z0-9-]+$/.test(entry.id) || seen.has(entry.id))
      throw new Error("Идентификатор замечания должен быть уникальным.");
    seen.add(entry.id);
    const file = resolve(root, entry.file);
    if (!file.startsWith(root + sep) || !/^(?:(?:main|about|programs|abiturient|students)\/)?assets\/scss\/.+\.scss$/.test(entry.file))
      throw new Error("Источник замечания должен находиться в assets/scss шаблона или страницы.");
    const lines = (await readFile(file, "utf8")).split(/\r?\n/);
    const line = lines.findIndex((value) => value.includes(entry.selector) && !value.trimStart().startsWith("//")) + 1;
    if (!line) throw new Error(`Селектор замечания ${entry.id} не найден в SCSS.`);
    const text = entry.description
      ? `Замечание — блок «${entry.block}», элемент ${entry.selector}: ${entry.description}; ${entry.fallback}.`
      : `Замечание: отсутствие стиля — блок «${entry.block}», элемент ${entry.selector}: в макете отсутствует оформление ${entry.states.join(" и ")}; ${entry.fallback}.`;
    remarks.push({ id: entry.id, page: entry.page, file: entry.file, line, text });
  }
  return remarks;
}

// Редактируется реестр JSON. Markdown — только детерминированное представление данных.
export async function writeRemarksMarkdown() {
  const remarks = await collectRemarks();
  const pages = await readJson("ui/data/pages.json");
  for (const page of pages) {
    if (!page.remarksReport) continue;
    const entries = remarks.filter((entry) => entry.page === page.id);
    const file = resolve(root, page.remarksReport);
    if (!file.startsWith(root + sep) || !file.endsWith(".md"))
      throw new Error("Отчёт должен быть Markdown-файлом внутри проекта.");
    const header =
      "# Открытые замечания к состояниям\n\nСгенерировано из `ui/data/remarks.json` командой `pnpm remarks:md`. Этот Markdown не редактируется вручную. Номера строк вычисляются по селекторам в исходниках.\n\n";
    const content = entries.length
      ? entries
          .map(
            (entry) =>
              `- ${entry.text} [${entry.file}:${entry.line}](${relative(dirname(file), resolve(root, entry.file)).replaceAll("\\", "/")}#L${entry.line})`,
          )
          .join("\n")
      : "Открытых замечаний нет.";
    await writeFile(file, header + content + "\n");
  }
  return remarks.length;
}

// В браузер передаются только относительные пути исходников внутри проекта.
export function validateComponentMetadata(entry) {
  const files = (values = []) => {
    if (!Array.isArray(values)) throw new Error("Нужен список исходников компонента.");
    return values.map((file) => {
      if (
        typeof file !== "string" ||
        file.includes("\\") ||
        !/^(?:(?:(?:main|about|programs|abiturient|students)\/)?assets\/|[a-z0-9/-]*index\.html$)/.test(file) ||
        file.split("/").includes("..") ||
        !resolve(root, file).startsWith(root + sep)
      )
        throw new Error("Недопустимый путь исходника компонента.");
      return file;
    });
  };
  const source = entry.reuseSource;
  if (source && (typeof source.page !== "string" || !/^[a-z][a-z0-9-]*$/.test(source.id)))
    throw new Error("Некорректный компонент-источник.");
  return {
    purpose: typeof entry.purpose === "string" ? entry.purpose : "",
    files: files(entry.files),
    ...(source
      ? { reuseSource: { page: source.page, id: source.id, files: files(source.files) } }
      : {}),
  };
}

export async function loadBlockInventory() {
  const data = await readJson("ui/data/blocks.json");
  const pages = await readJson("ui/data/pages.json");
  const pageIds = pages.map((page) => page.id);
  if (data.schemaVersion !== 1 || !Array.isArray(data.entries) || !Array.isArray(data.auditedPages))
    throw new Error("Некорректный реестр блоков.");
  if (data.auditedPages.some((page) => !pageIds.includes(page)))
    throw new Error("Неизвестная страница в реестре блоков.");
  const seen = new Set();
  const entries = data.entries.map((entry) => {
    const key = `${entry.page}:${entry.id}`;
    if (
      !pageIds.includes(entry.page) ||
      !/^[a-z][a-z0-9-]*$/.test(entry.id) ||
      entry.id.includes("--") ||
      seen.has(key)
    )
      throw new Error("Повторный или некорректный блок.");
    if (!["new", "existing"].includes(entry.origin))
      throw new Error("Неизвестное происхождение блока.");
    if (typeof entry.name !== "string" || !entry.name.trim())
      throw new Error("У блока должно быть название.");
    if (entry.addedAt !== null && !/^\d{4}-\d{2}-\d{2}$/.test(entry.addedAt))
      throw new Error("Дата блока должна иметь вид YYYY-MM-DD или null.");
    if (entry.addedAt !== null) {
      const date = new Date(`${entry.addedAt}T00:00:00Z`);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== entry.addedAt)
        throw new Error("Некорректная календарная дата блока.");
    }
    if (
      entry.phase !== null &&
      !["planning", "implementation", "verification"].includes(entry.phase)
    )
      throw new Error("Неизвестный этап добавления блока.");
    seen.add(key);
    // В публичный отчёт попадают только поля реестра, необходимые для подсчёта.
    return {
      id: entry.id,
      page: entry.page,
      name: entry.name,
      origin: entry.origin,
      addedAt: entry.addedAt,
      phase: entry.phase,
      taskId: entry.taskId || null,
      ...validateComponentMetadata(entry),
    };
  });
  const inventory = {
    status: "available",
    source: "ui/data/blocks.json",
    definition: data.definition,
    pageIds,
    auditedPages: [...new Set(data.auditedPages)],
    entries,
    reusableComponents: (data.reusableComponents || []).map((entry) => {
      if (!/^[a-z][a-z0-9-]*$/.test(entry.id) || !["main", ...pageIds].includes(entry.page))
        throw new Error("Некорректный пример компонента.");
      return { id: entry.id, page: entry.page, ...validateComponentMetadata(entry) };
    }),
  };
  const { entries: ignoredEntries, ...totals } = summarizeBlocks(inventory);
  return { ...inventory, totals };
}

export async function checkProjectData() {
  const remarks = await collectRemarks();
  const inventory = await loadBlockInventory();
  const pages = await readJson("ui/data/pages.json");
  for (const entry of [...inventory.entries, ...inventory.reusableComponents]) {
    for (const file of [...entry.files, ...(entry.reuseSource?.files || [])])
      await readFile(resolve(root, file), "utf8");
  }
  for (const page of pages.filter((page) => inventory.auditedPages.includes(page.id))) {
    const html = renderSharedHtml(await readFile(resolve(root, page.url.replace(/^\//, ""), "index.html"), "utf8"));
    const classes = new Set(
      [...html.matchAll(/class="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/)),
    );
    for (const entry of inventory.entries.filter((entry) => entry.page === page.id)) {
      if (!classes.has(entry.id))
        throw new Error(`Блок ${entry.id} не найден на странице ${page.id}.`);
    }
  }
  return {
    remarks: remarks.length,
    newBlocks: inventory.totals.newCount,
    existingBlocks: inventory.totals.existingCount,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes("--remarks-md"))
      console.log(`Markdown обновлён. Открытых замечаний: ${await writeRemarksMarkdown()}.`);
    else console.log(JSON.stringify(await checkProjectData()));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
