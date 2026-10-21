import pages from "./data/pages.json";
import { summarizeBlocks } from "./ui-block-metrics.js";

const pageFilter = document.querySelector(".js-page-filter");
const phaseFilter = document.querySelector(".js-phase-filter");
const dateFrom = document.querySelector(".js-date-from");
const dateTo = document.querySelector(".js-date-to");
const status = document.querySelector(".js-report-status");
const refresh = document.querySelector(".js-refresh");
const names = Object.fromEntries(pages.map((page) => [page.id, page.name]));
const phases = {
  planning: "Планирование",
  implementation: "Реализация",
  verification: "Проверка",
  unknown: "Не определён",
};
const number = (value) => (Number.isFinite(value) ? value.toLocaleString("ru-RU") : "Нет данных");
const duration = (value) =>
  Number.isFinite(value)
    ? `${Math.floor(value / 60000)} мин ${Math.floor(value / 1000) % 60} с`
    : "Нет данных";
let report;

function render() {
  const day = (value) =>
    value
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: report.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(value))
      : null;
  const records = report.records.filter(
    (row) =>
      (!pageFilter.value || row.page === pageFilter.value) &&
      (!phaseFilter.value || row.phase === phaseFilter.value) &&
      (!dateFrom.value || day(row.date) >= dateFrom.value) &&
      (!dateTo.value || day(row.date) <= dateTo.value),
  );
  renderBlocks();
  const sum = (get) => {
    const values = records.map(get).filter(Number.isFinite);
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  };
  const cards = [
    ["Ответы модели", number(sum((row) => row.modelResponses))],
    ["MCP-вызовы", number(sum((row) => row.mcpCalls))],
    ["Входные токены", number(sum((row) => row.tokens?.input_tokens))],
    ["Кэш: часть входных", number(sum((row) => row.tokens?.cached_input_tokens))],
    ["Выходные токены", number(sum((row) => row.tokens?.output_tokens))],
    ["Reasoning: часть выходных", number(sum((row) => row.tokens?.reasoning_output_tokens))],
    ["Рабочие интервалы", duration(sum((row) => row.durationMs))],
  ];
  const metrics = document.querySelector(".js-metrics");
  metrics.replaceChildren(
    ...cards.map(([label, value]) => {
      const card = document.createElement("div");
      card.className = "metric";
      const strong = document.createElement("strong");
      strong.textContent = value;
      card.append(strong, document.createTextNode(label));
      return card;
    }),
  );
  document.querySelector(".js-records").replaceChildren(
    ...records.map((row) => {
      const tr = document.createElement("tr");
      const values = [
        row.date
          ? new Date(row.date).toLocaleString("ru-RU", { timeZone: report.timezone })
          : "Нет данных",
        row.id.split(":")[0],
        names[row.page] || row.page,
        phases[row.phase],
        number(row.modelResponses),
        `${number(row.mcpCalls)} / ${number(row.mcpErrors)}`,
        ...["input_tokens", "cached_input_tokens", "output_tokens", "reasoning_output_tokens"].map(
          (key) => number(row.tokens?.[key]),
        ),
        duration(row.durationMs),
      ];
      values.forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      });
      return tr;
    }),
  );
}

function renderBlocks() {
  const summary = summarizeBlocks(report.blocks, {
    page: pageFilter.value,
    phase: phaseFilter.value,
    from: dateFrom.value,
    to: dateTo.value,
  });
  document.querySelector(".js-block-metrics").replaceChildren(
    ...[
      ["Новые БЭМ-компоненты", summary.newCount],
      ["Перенесённые / адаптированные", summary.existingCount],
    ].map(([label, value]) => {
      const card = document.createElement("div");
      card.className = "metric";
      const strong = document.createElement("strong");
      strong.textContent = number(value);
      card.append(strong, document.createTextNode(label));
      return card;
    }),
  );
  const notes = [report.blocks?.definition || "Реестр блоков недоступен."];
  if (summary.partial && report.blocks?.status === "available")
    notes.push(
      "Сумма подтверждена только для страниц с проведённой инвентаризацией. Остальные страницы: нет данных.",
    );
  if (!summary.auditedPages.length && report.blocks?.status === "available")
    notes.push("Для выбранной страницы инвентаризация не проведена: нет данных.");
  if (summary.unknownEntries)
    notes.push(
      `Для ${summary.unknownEntries} компонентов не подтверждена дата или этап добавления. Отфильтрованное количество: нет данных.`,
    );
  else if (summary.entries.some((entry) => !entry.addedAt || !entry.phase))
    notes.push(
      "Для исходных компонентов дата и этап добавления не подтверждены; они не подставляются задним числом.",
    );
  document.querySelector(".js-block-note").textContent = notes.join(" ");
  document.querySelector(".js-reusable-components").replaceChildren(
    ...(report.blocks?.reusableComponents || []).map((entry) => {
      const li = document.createElement("li");
      li.textContent =
        entry.page +
        ": " +
        entry.id +
        " — " +
        entry.purpose +
        ". Исходники: " +
        entry.files.join("; ") +
        (entry.reuseSource
          ? ". Источник: " + entry.reuseSource.page + ": " + entry.reuseSource.id
          : "");
      return li;
    }),
  );
  document.querySelector(".js-blocks").replaceChildren(
    ...summary.entries.map((entry) => {
      const tr = document.createElement("tr");
      for (const value of [
        entry.name,
        entry.id,
        names[entry.page] || entry.page,
        entry.origin === "new" ? "Новый" : "Перенесённый / адаптированный",
        entry.addedAt || "Нет данных",
        phases[entry.phase] || "Не определён",
        entry.purpose || "Нет описания",
        (entry.files || []).join("; ") || "Нет данных",
        entry.reuseSource
          ? `${entry.reuseSource.page}: ${entry.reuseSource.id} — ${entry.reuseSource.files.join("; ")}`
          : "Нет подтверждённого аналога",
      ]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      return tr;
    }),
  );
}

async function load(force = false) {
  refresh.disabled = true;
  status.textContent = "Чтение локальных журналов…";
  try {
    const response = await fetch(force ? "/__ui/statistics/refresh" : "/__ui/statistics", {
      method: force ? "POST" : "GET",
    });
    if (!response.ok) throw new Error();
    report = await response.json();
    const selected = pageFilter.value;
    pageFilter.replaceChildren(
      new Option("Все страницы", ""),
      ...[
        ...new Set([...pages.map((page) => page.id), ...report.records.map((row) => row.page)]),
      ].map((id) => new Option(names[id] || id, id)),
    );
    pageFilter.value = selected;
    status.textContent = `Снимок: ${new Date(report.generatedAt).toLocaleString("ru-RU")}. Записей: ${report.records.length}.`;
    document.querySelector(".js-notes").replaceChildren(
      ...report.notes.map((note) => {
        const li = document.createElement("li");
        li.textContent = note;
        return li;
      }),
    );
    document.querySelector(".js-sources").replaceChildren(
      ...report.sources.map((source) => {
        const p = document.createElement("p");
        p.textContent = `Сессия ${source.id}: ${source.status === "available" ? "доступна" : "нет данных"}${source.malformedLines ? `; неполных записей: ${source.malformedLines}` : ""}. Ответов: ${number(source.observedResponses)}; MCP: ${number(source.observedMcpCalls)}.`;
        return p;
      }),
    );
    const limits = report.accountLimits;
    document.querySelector(".js-limits").textContent = limits
      ? `Источник: ${limits.source}; снимок ${new Date(limits.capturedAt).toLocaleString("ru-RU", { timeZone: report.timezone })}. ${limits.windows.map((window) => `${window.name}: использовано ${number(window.usedPercent)}%; сброс: ${window.resetsAt ? new Date(typeof window.resetsAt === "number" ? window.resetsAt * 1000 : window.resetsAt).toLocaleString("ru-RU", { timeZone: report.timezone }) : "Нет данных"}`).join("; ")}`
      : "Нет данных: снимок лимитов аккаунта не зарегистрирован.";
    render();
  } catch {
    status.textContent =
      "Нет данных. Запустите локальный pnpm preview и зарегистрируйте журнал через pnpm stats --register <путь> --page <страница>.";
  } finally {
    refresh.disabled = false;
  }
}

[pageFilter, phaseFilter, dateFrom, dateTo].forEach((input) =>
  input.addEventListener("change", () => {
    if (report) render();
  }),
);
refresh.addEventListener("click", () => load(true));
load();
