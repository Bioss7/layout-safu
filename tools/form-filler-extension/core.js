// Чистая логика доступна из изолированного мира расширения и из тестов Node.
(() => {
  const app = (globalThis.__safuFiller ??= {});
  const purposes = {
    text: "Текст",
    name: "Имя",
    surname: "Фамилия",
    patronymic: "Отчество",
    fullname: "ФИО",
    email: "Email",
    phone: "Телефон",
    city: "Город",
    address: "Адрес",
    number: "Число",
    date: "Дата",
    choice: "Выбор",
  };
  function infer(info) {
    const label = `${info.label || ""} ${info.autocomplete || ""}`.toLowerCase();
    const hint =
      `${label} ${info.name || ""} ${info.id || ""} ${info.placeholder || ""}`.toLowerCase();
    const patterns = [
      ["patronymic", /отчеств|patronym|additional-name/],
      ["surname", /фамил|surname|last.?name|family-name/],
      ["fullname", /фио|ф\.\s?и\.\s?о|полное имя|full.?name/],
      ["email", /почт|e-?mail/],
      ["phone", /телефон|phone|\btel\b/],
      ["name", /\bfirst.?name\b|given-name|(^|\s)имя(\s|$)/],
      ["address", /адрес|address|street/],
      ["city", /город|city/],
    ];
    // Явная подпись важнее неоднозначного name="name".
    for (const [purpose, pattern] of patterns) if (pattern.test(label)) return purpose;
    if (info.type === "email") return "email";
    if (info.type === "tel") return "phone";
    if (info.type === "number" || info.type === "range") return "number";
    if (info.type === "date") return "date";
    for (const [purpose, pattern] of patterns) if (pattern.test(hint)) return purpose;
    if (/^name$/i.test(info.name || "")) return "name";
    return "text";
  }
  function generate(purpose, constraints = {}, sample = 0) {
    const people = [
      ["Иванов", "Алексей", "Сергеевич"],
      ["Петрова", "Анна", "Дмитриевна"],
      ["Смирнов", "Михаил", "Андреевич"],
    ];
    const index = (((Number(sample) || 0) % people.length) + people.length) % people.length;
    const person = people[index];
    const values = {
      surname: person[0],
      name: person[1],
      patronymic: person[2],
      fullname: person.join(" "),
      email: `test.${index + 1}@example.com`,
      phone: `+7 (900) 000-00-0${index + 1}`,
      city: "Архангельск",
      address: "улица Тестовая, дом 10",
      text: "Тестовый вопрос о поступлении и обучении в университете.",
    };
    if (purpose === "number") {
      const hasMin = constraints.min !== "" && constraints.min != null;
      const min = hasMin ? Number(constraints.min) : -Infinity;
      const max =
        constraints.max !== "" && constraints.max != null ? Number(constraints.max) : Infinity;
      const step = Number(constraints.step) > 0 ? Number(constraints.step) : 1;
      const base = hasMin ? min : 0;
      const desired = hasMin ? min : Math.min(1, max);
      let value = base + Math.ceil((desired - base) / step) * step;
      if (value > max) value = base + Math.floor((max - base) / step) * step;
      if (!Number.isFinite(value) || value > max || value < min)
        throw new Error("Нет числа в заданных ограничениях");
      return String(Number(value.toFixed(10)));
    }
    if (purpose === "date") {
      let value = "2000-06-15";
      if (constraints.min && value < constraints.min) value = constraints.min;
      if (constraints.max && value > constraints.max) value = constraints.max;
      if (constraints.min && value < constraints.min)
        throw new Error("Противоречивые ограничения даты");
      return value;
    }
    let value = values[purpose] || values.text;
    const minLength = Math.max(0, Number(constraints.minLength) || 0);
    const maxLength = Number(constraints.maxLength);
    if (minLength > 10000) throw new Error("Слишком большая минимальная длина");
    if (value.length < minLength) value = value.padEnd(minLength, "а");
    if (maxLength >= 0) value = value.slice(0, maxLength);
    return value;
  }
  function inArea(rect, area) {
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    return x >= area.left && x <= area.right && y >= area.top && y <= area.bottom;
  }
  function source({ training = false, learned = false, safu = false, automatic = false }) {
    if (learned) return "learned";
    if (training) return "unknown";
    if (safu) return "safu";
    if (automatic) return "automatic";
    return "unknown";
  }
  function validateRules(data, origin) {
    if (data?.version !== 1 || !Array.isArray(data.rules) || data.rules.length > 200) {
      throw new Error("Ожидается JSON правил версии 1 (не более 200 правил)");
    }
    const allowed = new Set([
      "id",
      "origin",
      "path",
      "type",
      "trigger",
      "list",
      "options",
      "state",
    ]);
    const ids = new Set();
    for (const rule of data.rules) {
      if (!rule || Object.keys(rule).some((key) => !allowed.has(key)))
        throw new Error("Недопустимые поля правила");
      if (rule.origin !== origin || !rule.path?.startsWith("/") || rule.path.length > 2000)
        throw new Error("Правила должны принадлежать текущему сайту");
      if (!["select", "multiselect", "radio", "checkbox"].includes(rule.type))
        throw new Error("Неизвестный тип компонента");
      if (typeof rule.id !== "string" || !rule.id || rule.id.length > 100 || ids.has(rule.id))
        throw new Error("Некорректный или повторяющийся ID");
      ids.add(rule.id);
      for (const key of ["trigger", ...(rule.type === "checkbox" ? [] : ["list", "options"])]) {
        if (typeof rule[key] !== "string" || !rule[key] || rule[key].length > 2000)
          throw new Error("Некорректный локатор");
      }
      const state = rule.state;
      if (
        !state ||
        Object.keys(state).some((key) => !["attribute", "value", "className"].includes(key))
      )
        throw new Error("Некорректная проверка состояния");
      if (state.className) {
        if (typeof state.className !== "string" || !/^[\w-]{1,100}$/.test(state.className))
          throw new Error("Некорректный класс состояния");
      } else if (
        !["aria-selected", "aria-checked", "data-state", "checked"].includes(state.attribute) ||
        typeof state.value !== "string" ||
        state.value.length > 100
      ) {
        throw new Error("Недопустимый атрибут состояния");
      }
    }
    return JSON.parse(JSON.stringify(data.rules));
  }
  app.core = { purposes, infer, generate, inArea, source, validateRules };
})();
