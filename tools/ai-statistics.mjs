import { readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBlockInventory } from "./project-data.mjs";

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const privateDirectory = resolve(projectRoot, ".ai-statistics");
const registryFile = resolve(privateDirectory, "sessions.json");
const phaseFile = resolve(privateDirectory, "phases.json");
const reportFile = resolve(privateDirectory, "report.json");
const tokenKeys = [
  "input_tokens",
  "cached_input_tokens",
  "output_tokens",
  "reasoning_output_tokens",
  "total_tokens",
];
const phases = new Set(["planning", "implementation", "verification", "unknown"]);

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function saveJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + "\n");
}

function emptyTokens() {
  return Object.fromEntries(tokenKeys.map((key) => [key, null]));
}
function mergeTokens(target, usage) {
  for (const key of tokenKeys)
    if (Number.isFinite(usage?.[key])) target[key] = (target[key] || 0) + usage[key];
}

function normalizeDate(value) {
  if (typeof value === "number") return new Date(value < 1e12 ? value * 1000 : value).toISOString();
  return value;
}

// Читаем только JSONL явно зарегистрированной сессии. Оборванная запись не ломает отчёт.
export function parseSession(text, registration, markers = [], now = Date.now()) {
  const contexts = new Map();
  const turns = new Map();
  const responses = new Map();
  const mcpItems = new Map();
  let malformedLines = 0;
  let currentTurn = null;
  let accountLimits = null;
  const sessionId = registration.id;
  const orderedMarkers = markers
    .filter((marker) => marker.sessionId === sessionId)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  function ensureTurn(id, timestamp) {
    if (!id) return null;
    if (!turns.has(id))
      turns.set(id, {
        id,
        sessionId,
        page: registration.page || "project",
        startedAt: null,
        completedAt: null,
        observedAt: timestamp || null,
        phase: "unknown",
        modelResponses: 0,
        mcpCalls: 0,
        mcpErrors: 0,
        mcpByTool: {},
        tokens: emptyTokens(),
        hasUsage: false,
        durationMs: null,
      });
    return turns.get(id);
  }

  function phaseAt(id, timestamp) {
    if (contexts.get(id)?.mode === "plan") return "planning";
    const time = Date.parse(timestamp);
    const marker = orderedMarkers.findLast(
      (item) => (!item.turnId || item.turnId === id) && Date.parse(item.at) <= time,
    );
    return marker?.phase || "unknown";
  }

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      malformedLines += 1;
      continue;
    }
    const payload = record.payload || {};
    const timestamp = record.timestamp;
    if (record.type === "event_msg" && payload.type === "token_count" && payload.rate_limits) {
      const windows = ["primary", "secondary"].flatMap((key, index) => {
        const window = payload.rate_limits[key];
        if (!window || !Number.isFinite(window.used_percent)) return [];
        return [
          {
            name: `${index === 0 ? "Основное" : "Дополнительное"} окно${Number.isFinite(window.window_minutes) ? ` (${window.window_minutes} мин)` : ""}`,
            usedPercent: window.used_percent,
            resetsAt: window.resets_at || null,
          },
        ];
      });
      if (windows.length && timestamp)
        accountLimits = {
          capturedAt: timestamp,
          source: "Локальный журнал Codex: token_count.rate_limits",
          windows,
        };
    }
    if (record.type === "turn_context") {
      currentTurn = payload.turn_id || currentTurn;
      contexts.set(currentTurn, { mode: payload.collaboration_mode?.mode || "unknown" });
      ensureTurn(currentTurn, timestamp);
    }
    if (record.type === "event_msg" && payload.type === "task_started") {
      currentTurn = payload.turn_id || payload.root_turn_id || currentTurn;
      const turn = ensureTurn(currentTurn, timestamp);
      if (turn) turn.startedAt = payload.started_at ? normalizeDate(payload.started_at) : timestamp;
    }
    if (record.type === "token_usage_record" && payload.response_id) {
      const id = payload.turn_id || currentTurn;
      ensureTurn(id, timestamp);
      // Повторная запись одного response_id заменяет предыдущую; накопительные totals не суммируем.
      responses.set(payload.response_id, {
        turnId: id,
        timestamp,
        usage: payload.usage,
        phase: phaseAt(id, timestamp),
      });
    }
    if (
      record.type === "event_msg" &&
      payload.type === "item_completed" &&
      payload.item?.type === "McpToolCall"
    ) {
      const item = payload.item;
      const id = payload.turn_id || payload.root_turn_id || currentTurn;
      ensureTurn(id, timestamp);
      mcpItems.set(item.id, {
        turnId: id,
        timestamp,
        phase: phaseAt(id, timestamp),
        tool: item.tool,
        server: item.server,
        failed:
          /fail|error/i.test(JSON.stringify(item.status)) ||
          Boolean(item.error) ||
          item.result?.isError === true,
      });
    }
    if (record.type === "event_msg" && ["task_complete", "turn_aborted"].includes(payload.type)) {
      const turn = ensureTurn(payload.turn_id || payload.root_turn_id || currentTurn, timestamp);
      if (turn) {
        turn.startedAt = payload.started_at ? normalizeDate(payload.started_at) : turn.startedAt;
        turn.completedAt = payload.completed_at ? normalizeDate(payload.completed_at) : timestamp;
        turn.durationMs = Number.isFinite(payload.duration_ms) ? payload.duration_ms : null;
      }
    }
  }

  const buckets = new Map();
  function bucket(turnId, phase, timestamp) {
    const key = `${turnId}:${phase}`;
    if (!buckets.has(key)) {
      const turn = turns.get(turnId);
      buckets.set(key, {
        id: key,
        sessionId,
        page: turn?.page || registration.page || "project",
        phase,
        date: timestamp || turn?.startedAt || turn?.observedAt || null,
        modelResponses: 0,
        mcpCalls: 0,
        mcpErrors: 0,
        mcpByTool: {},
        tokens: emptyTokens(),
        hasUsage: false,
        durationMs: null,
      });
    }
    return buckets.get(key);
  }
  for (const response of responses.values()) {
    const group = bucket(response.turnId, response.phase, response.timestamp);
    group.modelResponses += 1;
    if (response.usage) {
      mergeTokens(group.tokens, response.usage);
      group.hasUsage = true;
    }
  }
  for (const item of mcpItems.values()) {
    const group = bucket(item.turnId, item.phase, item.timestamp);
    group.mcpCalls += 1;
    group.mcpErrors += Number(item.failed);
    const tool = `${item.server || "mcp"}/${item.tool || "unknown"}`;
    group.mcpByTool[tool] = (group.mcpByTool[tool] || 0) + 1;
  }
  for (const turn of turns.values()) {
    if (!turn.startedAt) continue;
    const start = Date.parse(turn.startedAt);
    const end = turn.completedAt ? Date.parse(turn.completedAt) : now;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    const cuts = [
      start,
      ...orderedMarkers
        .filter(
          (marker) =>
            (!marker.turnId || marker.turnId === turn.id) &&
            Date.parse(marker.at) > start &&
            Date.parse(marker.at) < end,
        )
        .map((marker) => Date.parse(marker.at)),
      end,
    ];
    for (let index = 0; index < cuts.length - 1; index += 1) {
      const phase = phaseAt(turn.id, new Date(cuts[index]).toISOString());
      const group = bucket(turn.id, phase, new Date(cuts[index]).toISOString());
      group.durationMs = (group.durationMs || 0) + cuts[index + 1] - cuts[index];
    }
  }
  return {
    records: [...buckets.values()].map((group) => ({
      ...group,
      tokens: group.hasUsage ? group.tokens : null,
    })),
    accountLimits,
    source: {
      id: sessionId,
      page: registration.page,
      malformedLines,
      observedResponses: responses.size,
      observedMcpCalls: mcpItems.size,
      complete: malformedLines === 0,
      status: "available",
    },
  };
}

export async function registerSession(file, page = "project") {
  const actual = await realpath(resolve(file));
  if (!actual.endsWith(".jsonl")) throw new Error("Ожидается журнал JSONL.");
  const text = await readFile(actual, "utf8");
  const metadata = text
    .split(/\r?\n/)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .find((row) => row?.type === "session_meta");
  const id = metadata?.payload?.id;
  if (!id) throw new Error("В журнале не найден идентификатор сессии.");
  const registry = await readJson(registryFile, []);
  const entry = { id, file: actual, page, registeredAt: new Date().toISOString() };
  const index = registry.findIndex((item) => item.id === id);
  if (index < 0) registry.push(entry);
  else registry[index] = { ...registry[index], file: actual, page };
  await saveJson(registryFile, registry);
  return entry;
}

export async function markPhase(phase) {
  if (!phases.has(phase)) throw new Error("Неизвестный этап.");
  const registry = await readJson(registryFile, []);
  const entry = registry.at(-1);
  if (!entry) throw new Error("Сначала зарегистрируйте текущую сессию.");
  const text = await readFile(entry.file, "utf8");
  const context = text
    .split(/\r?\n/)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .findLast((row) => row?.type === "turn_context");
  const markers = await readJson(phaseFile, []);
  markers.push({
    sessionId: entry.id,
    turnId: context?.payload?.turn_id || null,
    phase,
    at: new Date().toISOString(),
  });
  await saveJson(phaseFile, markers);
}

export async function collectStatistics() {
  const registry = await readJson(registryFile, []);
  const markers = await readJson(phaseFile, []);
  const records = [];
  const sources = [];
  const limitSnapshots = [];
  for (const entry of registry) {
    try {
      const parsed = parseSession(await readFile(entry.file, "utf8"), entry, markers);
      records.push(...parsed.records);
      sources.push(parsed.source);
      if (parsed.accountLimits) limitSnapshots.push(parsed.accountLimits);
    } catch {
      // Абсолютный путь и текст ошибки чтения не отправляются в публичный отчёт.
      sources.push({ id: entry.id, page: entry.page, status: "unavailable", complete: false });
    }
  }
  const account = await readJson(resolve(privateDirectory, "account-limits.json"), null);
  const manualLimits =
    Number.isFinite(Date.parse(account?.capturedAt)) &&
    account?.source &&
    Array.isArray(account.windows)
      ? {
          capturedAt: account.capturedAt,
          source: account.source,
          windows: account.windows.map((window) => ({
            name: String(window.name || ""),
            usedPercent: Number.isFinite(window.usedPercent) ? window.usedPercent : null,
            resetsAt: window.resetsAt || null,
          })),
        }
      : null;
  if (manualLimits) limitSnapshots.push(manualLimits);
  const accountLimits =
    limitSnapshots.sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt))[0] || null;
  let blocks;
  try {
    blocks = await loadBlockInventory();
  } catch {
    blocks = { status: "unavailable", auditedPages: [], entries: [], pageIds: [] };
  }
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    timezone: "Asia/Tomsk",
    records,
    sources,
    accountLimits,
    blocks,
    notes: [
      "Подтверждённые ответы модели считаются по уникальному response_id.",
      "Кэш — часть входных токенов; reasoning — часть выходных.",
      "Время — интервалы выполнения ходов, включая инструменты и ожидание; паузы между ходами не включены.",
      "Суммы включают только подтверждённые показатели. Если часть записей не содержит метрики, сумма отражает доступную часть; детали указаны в таблице.",
      "Токены отдельных MCP-вызовов источник не предоставляет.",
      "Блоки считаются по отдельному реестру БЭМ-компонентов, без модели. Для непроверенных страниц и неподтверждённых дат/этапов показывается «Нет данных».",
    ],
  };
  await saveJson(reportFile, report);
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name) => args[args.indexOf(name) + 1];
  if (args.includes("--register"))
    await registerSession(
      option("--register"),
      args.includes("--page") ? option("--page") : "project",
    );
  if (args.includes("--phase")) await markPhase(option("--phase"));
  const report = await collectStatistics();
  console.log(
    `Статистика обновлена: сессий ${report.sources.length}, записей ${report.records.length}. Модель и MCP не вызывались.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
