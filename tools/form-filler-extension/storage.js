(() => {
  const app = globalThis.__safuFiller;
  const key = "safu-form-filler-v1";
  let data;
  let pending = Promise.resolve();
  async function load() {
    data = (await chrome.storage.local.get(key))[key] || {
      version: 1,
      origins: {},
      normalRules: [],
      trainingRules: [],
    };
    if (data.version !== 1) throw new Error("Неподдерживаемая версия сохранённых настроек");
    return data;
  }
  function settings() {
    return { training: false, safu: false, ...(data?.origins?.[location.origin] || {}) };
  }
  function rules() {
    return settings().training ? data.trainingRules : data.normalRules;
  }
  function persist() {
    const value = JSON.parse(JSON.stringify(data));
    pending = pending.catch(() => {}).then(() => chrome.storage.local.set({ [key]: value }));
    return pending;
  }
  async function updateSettings(settings) {
    data.origins[location.origin] = { ...data.origins[location.origin], ...settings };
    await persist();
  }
  async function saveRule(rule) {
    app.core.validateRules({ version: 1, rules: [rule] }, location.origin);
    const list = rules();
    const existing = list.findIndex(
      (item) =>
        item.origin === rule.origin && item.path === rule.path && item.trigger === rule.trigger,
    );
    if (existing >= 0) list.splice(existing, 1, rule);
    else list.push(rule);
    await persist();
  }
  async function removeRule(id) {
    const list = rules();
    const index = list.findIndex((rule) => rule.id === id && rule.origin === location.origin);
    if (index >= 0) list.splice(index, 1);
    await persist();
  }
  async function clearTraining() {
    data.trainingRules = data.trainingRules.filter((rule) => rule.origin !== location.origin);
    await persist();
  }
  function exportRules() {
    return { version: 1, rules: rules().filter((rule) => rule.origin === location.origin) };
  }
  async function importRules(payload) {
    const incoming = app.core.validateRules(payload, location.origin);
    // Проверяем CSS до изменения хранилища; отсутствующие сейчас элементы разрешены.
    for (const rule of incoming)
      for (const key of ["trigger", "list", "options"]) if (rule[key]) app.dom.query(rule[key]);
    const list = rules();
    for (const rule of incoming) {
      const index = list.findIndex(
        (item) =>
          item.id === rule.id ||
          (item.origin === rule.origin && item.path === rule.path && item.trigger === rule.trigger),
      );
      if (index >= 0) list.splice(index, 1, rule);
      else list.push(rule);
    }
    await persist();
  }
  app.storage = {
    load,
    settings,
    rules,
    updateSettings,
    saveRule,
    removeRule,
    clearTraining,
    exportRules,
    importRules,
  };
})();
