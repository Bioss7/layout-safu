(() => {
  const app = globalThis.__safuFiller;
  const escape = (value) => CSS.escape(String(value));
  function query(selector, root = document) {
    try {
      return [...root.querySelectorAll(selector)];
    } catch {
      throw new Error("Некорректный CSS-локатор: " + selector);
    }
  }
  function unique(selector, root = document) {
    const nodes = query(selector, root);
    if (nodes.length !== 1)
      throw new Error(
        `Локатор нашёл ${nodes.length} элементов. Нужно повторное обучение: ${selector}`,
      );
    return nodes[0];
  }
  function visible(node) {
    if (!node?.isConnected || node.closest("[hidden], [inert]")) return false;
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return (
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      Number(style.opacity) !== 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  }
  function disabled(node) {
    return (
      !node ||
      node.matches(":disabled, [readonly]") ||
      !!node.closest('[inert], [aria-disabled="true"], [aria-readonly="true"]')
    );
  }
  function label(node) {
    const labelled = (node.getAttribute("aria-labelledby") || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent || "")
      .join(" ");
    return (
      node.getAttribute("aria-label") ||
      labelled ||
      [...(node.labels || [])].map((el) => el.textContent).join(" ") ||
      node.getAttribute("placeholder") ||
      node.name ||
      node.textContent ||
      "Поле без подписи"
    )
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 160);
  }
  // Не сохраняем nth-child: правило должно отказаться от неоднозначности после перестройки DOM.
  function locator(node) {
    if (!(node instanceof Element)) throw new Error("Нужен элемент страницы");
    let current = node;
    let suffix = "";
    while (current && current !== document.documentElement) {
      const candidates = [];
      if (current.id) candidates.push("#" + escape(current.id));
      for (const attr of ["data-testid", "data-test", "name", "aria-controls", "aria-label"]) {
        if (current.getAttribute(attr))
          candidates.push(`${current.localName}[${attr}="${escape(current.getAttribute(attr))}"]`);
      }
      const classes = [...current.classList].filter(
        (name) => !/(active|selected|filled|open|focus|hover|checked|invalid|error)/i.test(name),
      );
      if (classes.length)
        candidates.push(current.localName + classes.map((name) => "." + escape(name)).join(""));
      candidates.push(current.localName);
      for (const candidate of candidates) {
        const full = candidate + suffix;
        if (query(full).length === 1 && query(full)[0] === node) return full;
      }
      suffix = candidates[candidates.length - (classes.length ? 2 : 1)] + suffix;
      suffix = " > " + suffix;
      current = current.parentElement;
    }
    throw new Error(
      "Нет устойчивого уникального локатора. Нужен id, name или отличающийся контейнер",
    );
  }
  function optionSelector(node, root) {
    const role = node.getAttribute("role");
    if (["option", "radio", "checkbox"].includes(role)) return `[role="${role}"]`;
    if (node.matches('input[type="radio"],input[type="checkbox"]'))
      return `input[type="${node.type}"]`;
    const classes = [...node.classList].filter(
      (name) => !/(active|selected|filled|open|focus|hover|checked|invalid|error)/i.test(name),
    );
    const selector = node.localName + classes.map((name) => "." + escape(name)).join("");
    if (!query(selector, root).length) throw new Error("Не найдены однотипные варианты");
    return selector;
  }
  function selected(node, state) {
    if (state.className) return node.classList.contains(state.className);
    if (state.attribute === "checked") return node.checked === (state.value === "true");
    return node.getAttribute(state.attribute) === state.value;
  }
  function snapshot(node) {
    return {
      classes: [...node.classList],
      checked: node.checked,
      attributes: Object.fromEntries(
        ["aria-selected", "aria-checked", "data-state"].map((name) => [
          name,
          node.getAttribute(name),
        ]),
      ),
    };
  }
  function detectState(node, before) {
    if (typeof node.checked === "boolean") return { attribute: "checked", value: "true" };
    for (const attribute of ["aria-selected", "aria-checked", "data-state"]) {
      const value = node.getAttribute(attribute);
      if (value != null && value !== "false" && value !== "unchecked") return { attribute, value };
    }
    const added = [...node.classList].filter((name) => !before.classes.includes(name));
    const className = added.find((name) => /selected|checked|active/i.test(name)) || added[0];
    if (className) return { className };
    throw new Error(
      "Не удалось подтвердить выбор по aria, checked, data-state или новому CSS-классу",
    );
  }
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function waitFor(get, timeout = 1800) {
    const end = Date.now() + timeout;
    let lastError;
    while (Date.now() < end) {
      try {
        const value = await get();
        if (value) return value;
      } catch (error) {
        lastError = error;
      }
      await delay(40);
    }
    throw lastError || new Error("Компонент не подтвердил изменение за 1,8 секунды");
  }
  function click(node) {
    if (!node?.isConnected || disabled(node)) throw new Error("Элемент недоступен");
    // Защита от ошибочно обученного submit и ссылок: допускаются только переключатели.
    if (
      node.closest(
        'a[href], button:not([type="button"]), input[type="submit"], input[type="image"], input[type="reset"]',
      ) ||
      node.matches('[type="reset"]')
    )
      throw new Error("Этот элемент может отправить форму или выполнить переход");
    node.click();
  }
  app.dom = {
    escape,
    query,
    unique,
    visible,
    disabled,
    label,
    locator,
    optionSelector,
    selected,
    snapshot,
    detectState,
    delay,
    waitFor,
    click,
  };
})();
