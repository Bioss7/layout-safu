(() => {
  const app = globalThis.__safuFiller;
  const d = app.dom;
  function constraints(node) {
    return {
      min: node.min,
      max: node.max,
      step: node.step,
      minLength: node.minLength,
      maxLength: node.maxLength,
    };
  }
  function setValue(node, value) {
    const prototype =
      node.localName === "textarea" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    node.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  }
  async function native(field, { onlyEmpty, sample }) {
    const node = field.node;
    if (!node.isConnected || d.disabled(node))
      throw new Error("Поле изменилось или недоступно. Повторите поиск");
    if (field.kind === "checkbox") {
      if (onlyEmpty && node.checked) return "skipped";
      if (node.checked !== field.checked) d.click(node);
      if (node.checked !== field.checked) throw new Error("Checkbox не подтвердил изменение");
      return "filled";
    }
    if (field.kind === "radio") {
      const all = field.nodes || [node];
      // Не переключаем группу, если выбран даже вариант вне выделенной области.
      const fullGroup = node.name
        ? [...document.querySelectorAll('input[type="radio"]')].filter(
            (item) => item.name === node.name && item.form === node.form,
          )
        : all;
      if (onlyEmpty && fullGroup.some((item) => item.checked)) return "skipped";
      const target = field.fixed
        ? all.find((item) => item.value === field.fixed || d.label(item) === field.fixed)
        : all.find((item) => !d.disabled(item));
      if (!target) throw new Error("Нет указанного варианта radio");
      d.click(target);
      if (!target.checked) throw new Error("Radio не подтвердил выбор");
      return "filled";
    }
    if (node.localName === "select") {
      if (onlyEmpty && [...node.selectedOptions].some((option) => option.value !== ""))
        return "skipped";
      const available = [...node.options].filter(
        (option) => !option.disabled && !option.parentElement.disabled && option.value !== "",
      );
      const desired = field.fixed ? field.fixed.split("|").map((value) => value.trim()) : [];
      const targets = desired.length
        ? desired.map((value) =>
            available.find((item) => item.value === value || item.textContent.trim() === value),
          )
        : available.slice(0, 1);
      if (!targets.length || targets.some((item) => !item))
        throw new Error("Нет доступного указанного варианта");
      if (!node.multiple && targets.length > 1) throw new Error("Допускается один вариант");
      for (const option of node.options) option.selected = targets.includes(option);
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
      if (!targets.every((item) => item.selected)) throw new Error("Select не подтвердил выбор");
      return "filled";
    }
    if (onlyEmpty && node.value.trim()) return "skipped";
    const value =
      field.action === "fixed"
        ? field.fixed
        : app.core.generate(field.purpose, constraints(node), sample);
    setValue(node, value);
    if (!node.value) throw new Error("Поле отклонило значение");
    if (!node.validity.valid)
      throw new Error(
        "Данные записаны, но браузерная валидация не пройдена: " + node.validationMessage,
      );
    if (node.getAttribute("aria-invalid") === "true")
      throw new Error("Данные записаны, но компонент отметил ошибку валидации");
    return "filled";
  }
  async function fill(fields, options, onProgress = () => {}) {
    const report = [];
    for (const field of fields) {
      const result = {
        label: field.label,
        source: app.adapters.sourceLabels[field.source],
        status: "skipped",
        message: "Пропущено",
      };
      try {
        if (field.action === "skip") result.message = "Пропущено пользователем";
        else if (field.error) throw new Error(field.error);
        else {
          if (!field.anchor?.isConnected || d.disabled(field.node))
            throw new Error("Компонент изменился. Повторите поиск");
          const status =
            field.source === "native"
              ? await native(field, options)
              : await field.apply({
                  fixed: field.action === "fixed" ? field.fixed : "",
                  checked: field.checked,
                  onlyEmpty: options.onlyEmpty,
                });
          result.status = status;
          result.message = status === "filled" ? "Заполнено" : "Уже заполнено — сохранено";
        }
      } catch (error) {
        result.status = "error";
        result.message = error.message;
      }
      report.push(result);
      onProgress(report);
    }
    return report;
  }
  app.filling = { fill, setValue };
})();
