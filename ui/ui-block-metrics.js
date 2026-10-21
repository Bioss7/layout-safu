// Единый подсчёт для Node.js-отчёта и фильтров браузера. Обращений к API здесь нет.
export function summarizeBlocks(inventory, filters = {}) {
  if (inventory?.status !== "available")
    return {
      newCount: null,
      existingCount: null,
      entries: [],
      unknownEntries: 0,
      auditedPages: [],
      partial: true,
    };
  const auditedPages = inventory.auditedPages.filter(
    (page) => !filters.page || page === filters.page,
  );
  const unique = new Map();
  for (const entry of inventory.entries) {
    if ((!filters.page || entry.page === filters.page) && auditedPages.includes(entry.page))
      unique.set(`${entry.page}:${entry.id}`, entry);
  }
  const entries = [];
  const unknown = [];
  for (const entry of unique.values()) {
    const date = entry.addedAt?.slice(0, 10);
    // Сначала исключаем подтверждённые несовпадения, затем учитываем неизвестные поля.
    if (filters.phase === "unknown" && entry.phase) continue;
    if (
      filters.phase &&
      filters.phase !== "unknown" &&
      entry.phase &&
      entry.phase !== filters.phase
    )
      continue;
    if (filters.from && date && date < filters.from) continue;
    if (filters.to && date && date > filters.to) continue;
    if (
      (filters.phase && filters.phase !== "unknown" && !entry.phase) ||
      ((filters.from || filters.to) && !date)
    )
      unknown.push(entry);
    else entries.push(entry);
  }
  const count = (origin) =>
    !auditedPages.length || unknown.some((entry) => entry.origin === origin)
      ? null
      : entries.filter((entry) => entry.origin === origin).length;
  return {
    newCount: count("new"),
    existingCount: count("existing"),
    entries,
    unknownEntries: unknown.length,
    auditedPages,
    partial: !filters.page && auditedPages.length < (inventory.pageIds?.length || 0),
  };
}
