(() => {
  const app = globalThis.__safuFiller;
  if (app.instance) return;
  const host = document.createElement("div");
  host.dataset.safuFillerHost = "";
  host.style.cssText = "all:initial;position:fixed;z-index:2147483647;inset:0;pointer-events:none";
  document.documentElement.append(host);
  let selection = null;
  let fields = [];
  let locked = false;
  let picker;
  let ui;
  function scan() {
    if (!selection) {
      ui.status("Сначала выберите форму, контейнер или область.");
      return;
    }
    if (selection.root && !selection.root.isConnected)
      throw new Error("Выбранная форма исчезла. Выберите её заново");
    fields = app.adapters.scan(selection, app.storage.settings(), app.storage.rules());
    ui.fields(fields);
    ui.status(`Найдено полей: ${fields.length}. Проверьте назначения и состояния checkbox.`);
  }
  function refresh() {
    ui.settings(app.storage.settings());
    ui.rules(app.storage.rules());
    if (selection) scan();
  }
  async function run(action) {
    if (locked) return;
    locked = true;
    ui.busy(true);
    try {
      await action();
    } finally {
      locked = false;
      ui.busy(false);
    }
  }
  ui = app.panel.create(host, {
    cancel: () => picker?.cancel(),
    choose: (mode) =>
      run(async () => {
        const value = await picker.pick({ area: mode === "area", container: mode === "form" });
        selection = mode === "container" ? { root: value } : value;
        scan();
      }),
    scan: () => {
      if (!locked) scan();
    },
    settings: (value) =>
      run(async () => {
        await app.storage.updateSettings(value);
        refresh();
      }),
    fill: (options) =>
      run(async () => {
        if (!fields.length) {
          ui.status("Сначала выберите форму с полями.");
          return;
        }
        ui.status("Заполнение…");
        const report = await app.filling.fill(fields, options, ui.report);
        const count = (status) => report.filter((result) => result.status === status).length;
        ui.status(
          `Готово: заполнено ${count("filled")}, пропущено ${count("skipped")}, ошибок ${count("error")}. Форма не отправлялась.`,
        );
      }),
    learn: (type, initial) =>
      run(async () => {
        try {
          await app.training.train({ type, initial, picker, ui: ui.wizard });
          refresh();
        } finally {
          ui.wizard.finish("Обучение завершено. Правила доступны в текущем наборе.");
        }
      }),
    clear: () =>
      run(async () => {
        await app.storage.clearTraining();
        refresh();
        ui.status("Учебные правила этого сайта удалены. Обычный набор сохранён.");
      }),
    remove: (id) =>
      run(async () => {
        await app.storage.removeRule(id);
        refresh();
      }),
    import: (data) =>
      run(async () => {
        await app.storage.importRules(data);
        refresh();
        ui.status("Правила импортированы в текущий набор.");
      }),
  });
  picker = app.selection.create(host, ui.status);
  app.instance = {
    toggle() {
      ui.cancel();
      host.hidden = !host.hidden;
    },
  };
  ui.busy(true);
  app.storage
    .load()
    .then(() => {
      refresh();
      ui.busy(false);
    })
    .catch((error) => ui.status("Не удалось загрузить настройки: " + error.message, true));
})();
