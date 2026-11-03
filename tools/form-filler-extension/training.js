(() => {
  const app = globalThis.__safuFiller;
  const d = app.dom;
  async function train({ type, picker, ui, initial = null }) {
    let unhighlight = () => {};
    let trigger;
    try {
      await ui.step(
        type === "radio"
          ? "Шаг 1. Укажите контейнер всей группы radio."
          : "Шаг 1. Укажите управляющую кнопку или переключатель.",
        "Указать элемент",
      );
      trigger = initial || (await picker.pick());
      // Вложенная иконка должна указывать на кнопку, а не на SVG/path.
      if (type !== "radio")
        trigger =
          trigger.closest('button, [role="combobox"], [role="checkbox"], input, [tabindex]') ||
          trigger;
      const triggerLocator = d.locator(trigger);
      let list = trigger;
      let option = trigger;
      let options;
      if (["select", "multiselect"].includes(type)) {
        await ui.step(
          "Шаг 2. Откройте список кнопкой ниже. Если компонент не открылся, откройте его вручную на странице.",
          "Открыть список",
        );
        if (trigger.getAttribute("aria-expanded") !== "true") d.click(trigger);
        await ui.step(
          "Шаг 3. Укажите контейнер выпадающего списка. Он может находиться в другой части DOM.",
          "Указать список",
        );
        // Клик по панели мог закрыть список обработчиком outside-click сайта.
        if (trigger.getAttribute("aria-expanded") === "false") d.click(trigger);
        const picked = await picker.pick();
        list = picked.closest('[role="listbox"]') || picked;
      }
      if (type !== "checkbox") {
        await ui.step(
          "Шаг 4. Укажите один вариант. Будут найдены и подсвечены похожие элементы внутри контейнера.",
          "Указать вариант",
        );
        if (["select", "multiselect"].includes(type) && !d.visible(list)) d.click(trigger);
        option = await picker.pick();
        if (!list.contains(option))
          throw new Error("Вариант должен находиться внутри выбранного контейнера");
        option = option.closest('[role="option"], [role="radio"], button, li, input') || option;
        if (!list.contains(option) || option === list)
          throw new Error("Выберите отдельный пункт, не контейнер");
        options = d.optionSelector(option, list);
      }
      const items = type === "checkbox" ? [trigger] : d.query(options, list);
      if (!items.length) throw new Error("Варианты не найдены");
      unhighlight = picker.highlight(items);
      await ui.step(
        `Найдено вариантов: ${items.length}. Проверьте подсветку. Следующий шаг выполнит пробный выбор указанного варианта.`,
        "Проверить выбор",
      );
      unhighlight();
      if (["select", "multiselect"].includes(type) && !d.visible(list)) d.click(trigger);
      const listLocator = type === "checkbox" ? null : d.locator(list);
      const before = d.snapshot(option);
      d.click(option);
      await d.delay(150);
      let state;
      try {
        state = d.detectState(option, before);
      } catch {
        // Уже выбранный checkbox мог переключиться в false; повторяем, чтобы наблюдать true.
        if (type !== "checkbox")
          throw new Error(
            "Нет наблюдаемого признака выбора. Попробуйте другой, ещё не выбранный вариант",
          );
        const unchecked = d.snapshot(option);
        d.click(option);
        await d.delay(150);
        state = d.detectState(option, unchecked);
      }
      if (!d.selected(option, state)) throw new Error("Выбор не подтверждён");
      const rule = {
        id: crypto.randomUUID(),
        origin: location.origin,
        path: location.pathname,
        type,
        trigger: triggerLocator,
        state,
      };
      if (type !== "checkbox") Object.assign(rule, { list: listLocator, options });
      app.core.validateRules({ version: 1, rules: [rule] }, location.origin);
      const adapter = app.adapters.custom(rule, "learned");
      await adapter.open();
      if (!adapter.read().length) throw new Error("Правило не смогло повторно прочитать состояние");
      await adapter.close();
      await ui.step(
        `Выбор подтверждён (${state.className || state.attribute}). Сохранить правило для ${location.pathname}? Для новой проверки заполнения перезагрузите страницу.`,
        "Сохранить правило",
      );
      await app.storage.saveRule(rule);
      if (["select", "multiselect"].includes(type))
        trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      ui.finish("Правило сохранено. Повторите поиск полей или перезагрузите страницу.");
      return rule;
    } finally {
      unhighlight();
    }
  }
  app.training = { train };
})();
