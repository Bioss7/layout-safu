(() => {
  const app = globalThis.__safuFiller;
  const d = app.dom;
  const sourceLabels = {
    native: "Нативное поле",
    safu: "Правило САФУ",
    learned: "Обучение",
    automatic: "Автораспознавание",
    unknown: "Нужно обучение",
  };
  // Два подтверждённых семейства. Checkbox/radio с нативным input обрабатываются нативно.
  function safuRule(trigger) {
    const root = trigger.closest(".js-topic, [data-topic]");
    if (!root) return null;
    const list = root.querySelector(".js-topic-list, [role=listbox]");
    if (!list) return null;
    return {
      type: root.dataset.multiple === "true" ? "multiselect" : "select",
      trigger: d.locator(trigger),
      list: d.locator(list),
      options: '[role="option"]',
      state: { attribute: "aria-selected", value: "true" },
    };
  }
  function automaticRule(trigger) {
    const role = trigger.getAttribute("role");
    if (role === "checkbox")
      return {
        type: "checkbox",
        trigger: d.locator(trigger),
        state: { attribute: "aria-checked", value: "true" },
      };
    if (role === "radio") {
      const group = trigger.closest('[role="radiogroup"]');
      if (!group) return null;
      return {
        type: "radio",
        trigger: d.locator(group),
        list: d.locator(group),
        options: '[role="radio"]',
        state: { attribute: "aria-checked", value: "true" },
      };
    }
    const list = document.getElementById(trigger.getAttribute("aria-controls"));
    if (list?.getAttribute("role") !== "listbox") return null;
    return {
      type: list.getAttribute("aria-multiselectable") === "true" ? "multiselect" : "select",
      trigger: d.locator(trigger),
      list: d.locator(list),
      options: '[role="option"]',
      state: { attribute: "aria-selected", value: "true" },
    };
  }
  function custom(rule, source) {
    const trigger = d.unique(rule.trigger);
    const anchor =
      rule.type === "radio" ? d.query(rule.options, trigger).find(d.visible) || trigger : trigger;
    const list = () => (rule.type === "checkbox" ? trigger : d.unique(rule.list));
    const options = () => {
      if (rule.type === "checkbox") return [trigger];
      return d
        .query(rule.options, list())
        .filter(
          (node) =>
            !d.disabled(node) &&
            !node.hasAttribute("data-reset") &&
            node.getAttribute("data-value") !== "",
        );
    };
    return {
      anchor,
      node: trigger,
      kind: rule.type,
      source,
      rule,
      label: d.label(trigger),
      options,
      read: () => options().filter((node) => d.selected(node, rule.state)),
      async open() {
        if (["radio", "checkbox"].includes(rule.type)) return;
        let current;
        try {
          current = list();
        } catch {
          /* Список может появиться только после открытия. */
        }
        if (!current || !d.visible(current)) d.click(trigger);
        await d.waitFor(() => {
          const el = list();
          return d.visible(el) && el;
        });
      },
      async close() {
        if (!["select", "multiselect"].includes(rule.type)) return;
        let current;
        try {
          current = list();
        } catch {
          return;
        }
        if (!d.visible(current)) return;
        trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await d.delay(0);
        if (current.isConnected && d.visible(current)) d.click(trigger);
      },
      async apply({ fixed, checked = true, onlyEmpty = true }) {
        await this.open();
        const items = options().filter(d.visible);
        if (!items.length) throw new Error("Нет доступных вариантов");
        if (onlyEmpty && this.read().length) {
          await this.close();
          return "skipped";
        }
        if (rule.type === "checkbox") {
          if (d.selected(trigger, rule.state) !== checked) d.click(trigger);
          await d.waitFor(() => d.selected(trigger, rule.state) === checked);
          return "filled";
        }
        const desired = fixed ? fixed.split("|").map((text) => text.trim()) : [];
        let targets = desired.length
          ? desired.map((text) =>
              items.find(
                (node) =>
                  node.textContent.trim() === text ||
                  node.getAttribute("data-value") === text ||
                  node.value === text,
              ),
            )
          : [items[0]];
        if (targets.some((node) => !node))
          throw new Error("Не найден указанный вариант. Для нескольких используйте разделитель | ");
        if (rule.type !== "multiselect" && targets.length > 1)
          throw new Error("Этот компонент поддерживает только один вариант");
        if (rule.type === "multiselect" && !onlyEmpty) {
          for (const node of items)
            if (d.selected(node, rule.state) && !targets.includes(node)) d.click(node);
        }
        for (const original of targets) {
          await this.open();
          const key =
            original.getAttribute("data-value") ||
            original.getAttribute("value") ||
            original.textContent.trim();
          const locate = () => {
            const matches = options().filter(
              (item) =>
                (item.getAttribute("data-value") ||
                  item.getAttribute("value") ||
                  item.textContent.trim()) === key,
            );
            if (matches.length !== 1)
              throw new Error("Вариант отсутствует или неоднозначен после обновления списка");
            return matches[0];
          };
          let node = original.isConnected ? original : locate();
          if (!d.selected(node, rule.state)) d.click(node);
          await d.waitFor(async () => {
            // Перечитываем состояние после пересоздания выпадающего списка.
            if (!node.isConnected) {
              await this.open();
              node = locate();
            }
            return d.selected(node, rule.state);
          });
        }
        await this.close();
        return "filled";
      },
    };
  }
  function native(node) {
    const isCheck = ["checkbox", "radio"].includes(node.type);
    const anchor = d.visible(node) ? node : [...(node.labels || [])].find(d.visible);
    if (!anchor || d.disabled(node)) return null;
    if (!d.visible(node) && !isCheck) return null;
    const kind =
      node.localName === "select"
        ? node.multiple
          ? "multiselect"
          : "select"
        : node.type || "text";
    return { node, anchor, kind, source: "native", label: d.label(node) };
  }
  function scan(selection, settings, rules) {
    const fields = [];
    const claimed = new Set();
    const inSelection = (node) => {
      if (!node) return false;
      if (!selection.area) return selection.root?.contains(node);
      const rect = node.getBoundingClientRect();
      return app.core.inArea(
        {
          left: rect.left + scrollX,
          top: rect.top + scrollY,
          width: rect.width,
          height: rect.height,
        },
        selection.area,
      );
    };
    const pushCustom = (adapter) => {
      if (!inSelection(adapter.anchor) || !d.visible(adapter.anchor) || d.disabled(adapter.node))
        return;
      if (claimed.has(adapter.node)) return;
      claimed.add(adapter.node);
      if (adapter.kind === "radio")
        d.query(adapter.rule.options, adapter.node).forEach((node) => claimed.add(node));
      fields.push(adapter);
    };
    // Сначала пользовательские правила; отказавшие правила не заменяются автоматическими.
    for (const rule of rules.filter(
      (item) => item.origin === location.origin && item.path === location.pathname,
    )) {
      try {
        pushCustom(custom(rule, "learned"));
      } catch (error) {
        const matches = d.query(rule.trigger);
        matches.forEach((node) => claimed.add(node));
        fields.push({
          node: null,
          anchor: null,
          kind: rule.type,
          source: "learned",
          label: "Устаревшее правило " + rule.id,
          error: error.message,
          rule,
        });
      }
    }
    const candidates = d.query(
      '[role="combobox"], [aria-haspopup="listbox"], [role="radio"], [role="checkbox"], .js-topic-trigger',
    );
    for (const trigger of candidates) {
      if (trigger.matches('select, input[type="radio"], input[type="checkbox"]')) continue;
      if (
        claimed.has(trigger) ||
        !d.visible(trigger) ||
        !inSelection(trigger) ||
        d.disabled(trigger)
      )
        continue;
      try {
        const safu = !settings.training && settings.safu ? safuRule(trigger) : null;
        const automatic = !settings.training && !safu ? automaticRule(trigger) : null;
        const rule = safu || automatic;
        const source = app.core.source({
          training: settings.training,
          safu: !!safu,
          automatic: !!automatic,
        });
        if (rule) pushCustom(custom(rule, source));
        else {
          claimed.add(trigger);
          fields.push({
            node: trigger,
            anchor: trigger,
            kind: "custom",
            source: "unknown",
            label: d.label(trigger),
            error: "Укажите тип и обучите компонент",
          });
        }
      } catch (error) {
        claimed.add(trigger);
        fields.push({
          node: trigger,
          anchor: trigger,
          kind: "custom",
          source: "unknown",
          label: d.label(trigger),
          error: error.message,
        });
      }
    }
    for (const node of d.query("input, select, textarea")) {
      if (claimed.has(node) || node.closest("[data-safu-filler-host]")) continue;
      if (["hidden", "submit", "button", "reset", "image"].includes(node.type)) continue;
      const field = native(node);
      if (!field || !inSelection(field.anchor)) continue;
      // Нативный элемент, являющийся управляющим элементом обученного компонента, не дублируем.
      if (
        fields.some(
          (item) =>
            item.node === node ||
            (["radio", "checkbox"].includes(item.rule?.type) && item.node?.contains(node)),
        )
      )
        continue;
      if (node.type === "radio" && node.name) {
        const group = fields.find(
          (item) =>
            item.source === "native" &&
            item.kind === "radio" &&
            item.node.name === node.name &&
            item.node.form === node.form,
        );
        if (group) {
          group.nodes.push(node);
          continue;
        }
        field.nodes = [node];
      }
      if (
        node.type === "file" ||
        node.type === "password" ||
        node.type === "range" ||
        !["input", "select", "textarea"].includes(node.localName) ||
        (node.localName === "input" &&
          ![
            "text",
            "email",
            "tel",
            "number",
            "date",
            "checkbox",
            "radio",
            "search",
            "url",
          ].includes(node.type))
      )
        field.error = "Этот тип поля не поддерживается в первой версии";
      fields.push(field);
    }
    return fields.map((field, index) => ({
      ...field,
      id: index,
      purpose: ["select", "multiselect", "checkbox", "radio", "custom"].includes(field.kind)
        ? "choice"
        : app.core.infer({
            label: field.label,
            name: field.node?.name,
            id: field.node?.id,
            type: field.node?.type,
            autocomplete: field.node?.autocomplete,
            placeholder: field.node?.placeholder,
          }),
      action: "generate",
      fixed: "",
      checked: false,
    }));
  }
  app.adapters = { custom, scan, safuRule, automaticRule, sourceLabels };
})();
