(() => {
  const app = globalThis.__safuFiller;
  const styles = `
    :host { all: initial; color-scheme: light; }
    :host([hidden]) { display: none !important; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    .panel { position: fixed; right: 16px; top: 16px; width: min(408px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); display: flex; flex-direction: column; color: #1c302a; background: #f7faf8; border: 1px solid #c6d6ce; border-radius: 16px; box-shadow: 0 12px 48px #102c2940; font: 14px/1.45 system-ui, sans-serif; pointer-events: auto; overflow: hidden; }
    .panel.left { left: 16px; right: auto; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 16px; border-bottom: 1px solid #dce6e0; background: #fff; }
    h1 { margin: 0; font-size: 17px; line-height: 1.2; letter-spacing: -.3px; }
    .eyebrow { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #527568; margin-bottom: 4px; }
    h2 { font-size: 14px; margin: 0 0 8px; }
    main { overflow-y: auto; min-height: 0; padding: 16px; }
    section, details { margin-bottom: 16px; }
    label { display: block; margin-bottom: 9px; }
    input, select, textarea, button { font: inherit; }
    select, input[type=text], textarea { width: 100%; border: 1px solid #b4c8bc; border-radius: 7px; background: white; color: #193d30; padding: 8px; margin-top: 4px; min-height: 36px; }
    input[type=checkbox] { accent-color: #216a51; vertical-align: middle; }
    textarea { min-height: 96px; resize: vertical; }
    button { cursor: pointer; border: 1px solid #b9cfc3; border-radius: 8px; background: white; color: #234a3b; padding: 8px 10px; min-height: 36px; }
    button:hover { background: #e8f2ed; }
    button:disabled { cursor: default; opacity: .45; }
    button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible { outline: 3px solid #d18e2f; outline-offset: 2px; }
    .primary { background: #216a51; color: #fff; border-color: #216a51; }
    .primary:hover { background: #17503c; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; }
    .row > button { flex: 1; }
    .tiny { padding: 4px 7px; font-size: 12px; min-height: 30px; }
    .hint { font-size: 12px; color: #537064; margin: 7px 0; overflow-wrap: anywhere; }
    .status { border-radius: 8px; background: #e8f2ed; padding: 10px; margin-bottom: 14px; overflow-wrap: anywhere; }
    .field { padding: 12px; border: 1px solid #d4e1d9; background: white; border-radius: 10px; margin: 8px 0; }
    .field-title { font-weight: 650; overflow-wrap: anywhere; }
    .badge { color: #24674e; background: #eaf4ee; border-radius: 4px; padding: 2px 5px; font-size: 11px; display: inline-block; margin: 5px 0; }
    .error { color: #a33321; }
    .report { padding-left: 18px; font-size: 12px; }
    .report li { margin-bottom: 8px; overflow-wrap: anywhere; }
    .wizard { padding: 12px; border: 1px solid #7aa68e; border-radius: 10px; background: #e8f2ed; margin-bottom: 16px; }
    .wizard p { margin-top: 0; }
    footer { padding: 12px 16px; border-top: 1px solid #dce6e0; background: white; }
    footer .primary { width: 100%; }
    summary { cursor: pointer; font-weight: 600; }
    .rule { font-size: 12px; overflow-wrap: anywhere; padding: 9px 0; border-bottom: 1px solid #dce6e0; }
    .count { color: #587569; font-weight: 400; }
    @media (max-width: 480px) { .panel { top: 8px; right: 8px; width: calc(100vw - 16px); max-height: calc(100dvh - 16px); } .panel.left { left: 8px; } main { padding: 12px; } }
  `;
  function create(host, callbacks) {
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${styles}</style>
      <aside class="panel" aria-label="Заполнение форм">
        <header><div><div class="eyebrow">Локальный инструмент</div><h1>Заполнение форм</h1></div><div class="row"><button class="tiny" id="side" title="Переместить панель">⇆</button><button class="tiny" id="minimize" aria-label="Свернуть панель" aria-expanded="true">−</button><button class="tiny" id="close" aria-label="Закрыть панель">×</button></div></header>
        <main id="body">
          <div class="status" id="status" role="status" aria-live="polite">Выберите форму или выделите область.</div>
          <section aria-label="Режим"><label>Режим работы<select id="mode" data-lock><option value="normal">Готовые правила / Авто</option><option value="training">Проверка обучения</option></select></label>
            <label><input type="checkbox" id="safu" data-lock> Включить правила САФУ на этом сайте</label><p class="hint" id="origin"></p><p class="hint" id="mode-hint"></p>
          </section>
          <section aria-label="Выбор формы"><div class="row"><button id="choose" data-lock>Выбрать форму</button><button id="area" data-lock>Выделить область</button></div><div class="row" style="margin-top:8px"><button id="container" data-lock>Указать контейнер</button><button id="rescan" data-lock>Повторить поиск</button></div><p class="hint">При выборе — Escape для отмены. ⇆ перемещает панель на другую сторону.</p></section>
          <section aria-label="Настройки данных"><label>Повторяемый набор<select id="sample" data-lock><option value="0">1 · Иванов Алексей Сергеевич</option><option value="1">2 · Петрова Анна Дмитриевна</option><option value="2">3 · Смирнов Михаил Андреевич</option></select></label><label><input type="checkbox" id="only-empty" checked data-lock> Только пустые поля</label><p class="hint">Checkbox остаются выключенными, пока вы явно не зададите «Отметить».</p></section>
          <section aria-label="Обучение"><h2>Обучить компонент</h2><label>Тип<select id="learn-type" data-lock><option value="select">Селект</option><option value="multiselect">Мультиселект</option><option value="radio">Группа radio</option><option value="checkbox">Checkbox</option></select></label><button id="learn" data-lock>Указать и обучить</button></section>
          <div class="wizard" id="wizard" hidden><p id="wizard-text"></p><div class="row"><button id="wizard-next" class="primary">Далее</button><button id="wizard-cancel">Отменить обучение</button></div></div>
          <section><h2>Поля <span class="count" id="count">0</span></h2><div id="fields"></div></section>
          <section id="report-section" hidden><h2>Результат заполнения</h2><ol class="report" id="report" aria-live="polite"></ol></section>
          <details id="rules-details"><summary>Сохранённые правила</summary><p class="hint">Наборы обычного режима и проверки обучения независимы. Экспортируется текущий набор для этого сайта.</p><div id="rules"></div><button id="clear" data-lock>Очистить учебные правила этого сайта</button><label>JSON правил<textarea id="json" spellcheck="false" placeholder="Здесь появится экспорт; сюда можно вставить JSON для импорта."></textarea></label><div class="row"><button id="export" data-lock>Экспорт JSON</button><button id="import" data-lock>Импорт JSON</button></div></details>
        </main>
        <footer id="footer"><button class="primary" id="fill" data-lock>Заполнить выбранное</button><div class="hint">Данные остаются в браузере. Отправка формы — вручную.</div></footer>
      </aside>`;
    const get = (id) => root.getElementById(id);
    // Настройки панели не должны вызывать outside-click и обработчики форм сайта.
    for (const name of [
      "click",
      "pointerdown",
      "pointerup",
      "input",
      "change",
      "keydown",
      "focusin",
      "focusout",
    ]) {
      root.addEventListener(name, (event) => event.stopPropagation());
    }
    let stepResolve;
    let stepReject;
    let locked = false;
    function invoke(action) {
      Promise.resolve()
        .then(action)
        .catch((error) => status(error.message, true));
    }
    function status(message, error = false) {
      get("status").textContent = message;
      get("status").classList.toggle("error", error);
    }
    function cancel() {
      callbacks.cancel();
      stepReject?.(new Error("Обучение отменено"));
      stepResolve = null;
      stepReject = null;
      get("wizard").hidden = true;
    }
    get("close").onclick = () => {
      cancel();
      host.hidden = true;
    };
    get("minimize").onclick = () => {
      const hidden = !get("body").hidden;
      get("body").hidden = hidden;
      get("footer").hidden = hidden;
      get("minimize").setAttribute("aria-expanded", String(!hidden));
      get("minimize").setAttribute("aria-label", hidden ? "Развернуть панель" : "Свернуть панель");
      get("minimize").textContent = hidden ? "+" : "−";
    };
    get("side").onclick = () => root.querySelector(".panel").classList.toggle("left");
    get("choose").onclick = () => invoke(() => callbacks.choose("form"));
    get("container").onclick = () => invoke(() => callbacks.choose("container"));
    get("area").onclick = () => invoke(() => callbacks.choose("area"));
    get("rescan").onclick = () => invoke(callbacks.scan);
    get("fill").onclick = () =>
      invoke(() =>
        callbacks.fill({
          sample: Number(get("sample").value),
          onlyEmpty: get("only-empty").checked,
        }),
      );
    get("mode").onchange = () =>
      invoke(() => callbacks.settings({ training: get("mode").value === "training" }));
    get("safu").onchange = () => invoke(() => callbacks.settings({ safu: get("safu").checked }));
    get("learn").onclick = () => invoke(() => callbacks.learn(get("learn-type").value));
    get("export").onclick = () => {
      get("json").value = JSON.stringify(app.storage.exportRules(), null, 2);
      status("JSON готов. Скопируйте его из поля; значения форм в него не входят.");
    };
    get("import").onclick = () => invoke(() => callbacks.import(JSON.parse(get("json").value)));
    get("clear").onclick = () => invoke(callbacks.clear);
    get("wizard-next").onclick = () => {
      const resolve = stepResolve;
      stepResolve = null;
      stepReject = null;
      get("wizard-next").disabled = true;
      resolve?.();
    };
    get("wizard-cancel").onclick = cancel;
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") cancel();
    });
    function settings(value) {
      get("mode").value = value.training ? "training" : "normal";
      get("safu").checked = value.safu;
      get("safu").disabled = locked || value.training;
      get("origin").textContent = location.origin;
      get("mode-hint").textContent = value.training
        ? "Кастомные элементы обрабатываются только учебными правилами. САФУ и автораспознавание отключены."
        : "Приоритет: обучение → включённые правила САФУ → автораспознавание.";
    }
    function fields(items) {
      get("count").textContent = String(items.length);
      get("fields").replaceChildren();
      for (const field of items) {
        const card = document.createElement("div");
        card.className = "field";
        const title = document.createElement("div");
        title.className = "field-title";
        title.textContent = field.label;
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = app.adapters.sourceLabels[field.source];
        card.append(title, badge);
        const addSelect = (caption, entries, value, change) => {
          const label = document.createElement("label");
          label.textContent = caption;
          const select = document.createElement("select");
          select.dataset.lock = "";
          for (const [key, text] of entries) {
            const option = document.createElement("option");
            option.value = key;
            option.textContent = text;
            select.append(option);
          }
          select.value = value;
          select.onchange = () => change(select.value);
          label.append(select);
          card.append(label);
          return select;
        };
        if (!field.error && field.purpose !== "choice") {
          addSelect(
            "Назначение",
            Object.entries(app.core.purposes).filter(([key]) => key !== "choice"),
            field.purpose,
            (value) => {
              field.purpose = value;
            },
          );
          if (field.purpose === "text") {
            const hint = document.createElement("p");
            hint.className = "hint";
            hint.textContent = "Назначение неочевидно — проверьте тип или задайте значение.";
            card.append(hint);
          }
        }
        const fixedLabel = document.createElement("label");
        fixedLabel.textContent = "Значение (для нескольких вариантов: |)";
        const input = document.createElement("input");
        input.type = "text";
        input.dataset.lock = "";
        input.value = field.fixed;
        input.oninput = () => {
          field.fixed = input.value;
        };
        fixedLabel.append(input);
        fixedLabel.hidden = field.action !== "fixed";
        addSelect(
          "Действие",
          [
            ["generate", "Заполнить"],
            ["fixed", "Постоянное значение"],
            ["skip", "Пропустить"],
          ],
          field.action,
          (value) => {
            field.action = value;
            fixedLabel.hidden = value !== "fixed";
          },
        );
        card.append(fixedLabel);
        if (field.kind === "checkbox")
          addSelect(
            "Состояние checkbox",
            [
              ["false", "Снять отметку"],
              ["true", "Отметить"],
            ],
            String(field.checked),
            (value) => {
              field.checked = value === "true";
            },
          );
        if (field.error) {
          const error = document.createElement("p");
          error.className = "hint error";
          error.textContent = field.error;
          card.append(error);
        }
        if (field.source !== "native" && field.node) {
          const learn = document.createElement("button");
          learn.textContent = "Обучить заново";
          learn.className = "tiny";
          learn.dataset.lock = "";
          learn.onclick = () => invoke(() => callbacks.learn(get("learn-type").value, field.node));
          card.append(learn);
        }
        get("fields").append(card);
      }
    }
    function rules(items) {
      get("rules").replaceChildren();
      const matching = items.filter((rule) => rule.origin === location.origin);
      for (const rule of matching) {
        const row = document.createElement("div");
        row.className = "rule";
        const text = document.createElement("div");
        text.textContent = `${rule.type} · ${rule.path} · ${rule.trigger}`;
        const remove = document.createElement("button");
        remove.textContent = "Удалить";
        remove.className = "tiny";
        remove.dataset.lock = "";
        remove.onclick = () => invoke(() => callbacks.remove(rule.id));
        row.append(text, remove);
        get("rules").append(row);
      }
      if (!matching.length)
        get("rules").textContent = "В текущем наборе правил для этого сайта пока нет.";
      get("clear").disabled = locked || !app.storage.settings().training;
    }
    function report(items) {
      get("report-section").hidden = false;
      get("report").replaceChildren();
      for (const result of items) {
        const item = document.createElement("li");
        item.className = result.status === "error" ? "error" : "";
        item.textContent = `${result.label} · ${result.source}: ${result.message}`;
        get("report").append(item);
      }
    }
    function busy(value) {
      locked = value;
      for (const el of root.querySelectorAll("[data-lock]")) el.disabled = value;
      get("safu").disabled = value || app.storage.settings().training;
      get("clear").disabled = value || !app.storage.settings().training;
    }
    const wizard = {
      step(text, caption) {
        get("wizard").hidden = false;
        get("wizard-text").textContent = text;
        get("wizard-next").textContent = caption;
        get("wizard-next").disabled = false;
        get("wizard").scrollIntoView({ block: "nearest" });
        get("wizard-next").focus({ preventScroll: true });
        return new Promise((resolve, reject) => {
          stepResolve = resolve;
          stepReject = reject;
        });
      },
      finish(message) {
        get("wizard").hidden = true;
        status(message);
      },
    };
    return { root, status, fields, settings, rules, report, busy, wizard, cancel };
  }
  app.panel = { create };
})();
