// Изолирует код селекта от остальных скриптов страницы.
(() => {
  // Находит селекты тем и подключает их поведение.
  function initTopicSelect() {
    // Настраивает отдельный экземпляр селекта.
    document.querySelectorAll(".js-topic").forEach((root) => {
      const trigger = root.querySelector(".js-topic-trigger");
      const label = root.querySelector(".js-topic-value");
      const input = root.querySelector(".js-field-input");
      const list = root.querySelector(".js-topic-list");
      if (!trigger || !label || !input || !list) return;
      const options = [...list.querySelectorAll(".js-topic-option")];
      if (!options.length) return;
      const placeholder = label.textContent.trim();
      let activeIndex = 0;
      let search = "";
      let searchTimer;

      // Подсвечивает активный пункт и обновляет его связь с комбобоксом.
      function highlight(index) {
        activeIndex = index;
        options.forEach((option, optionIndex) => {
          option.classList.toggle("topic-select__option--active", optionIndex === index);
        });
        trigger.setAttribute("aria-activedescendant", options[index].id);
        const option = options[index];
        // Перемещаем только список: scrollIntoView мог бы сдвинуть всю страницу.
        if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
        if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
          list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
        }
      }

      // Скрывает список и сбрасывает состояние раскрытия.
      function close() {
        list.hidden = true;
        root.classList.remove("topic-select--open");
        trigger.setAttribute("aria-expanded", "false");
        trigger.removeAttribute("aria-activedescendant");
      }

      // Раскрывает список и активирует выбранный или первый пункт.
      function open() {
        if (trigger.disabled || input.disabled || input.readOnly) return;
        list.hidden = false;
        root.classList.add("topic-select--open");
        trigger.setAttribute("aria-expanded", "true");
        const selected = options.findIndex(
          (option) => option.getAttribute("aria-selected") === "true",
        );
        highlight(selected < 0 ? 0 : selected);
      }

      // Переключает выбор темы и обновляет значение поля и подпись.
      function select(index) {
        if (trigger.disabled || input.disabled || input.readOnly) return;
        highlight(index);
        const option = options[index];
        option.setAttribute(
          "aria-selected",
          String(option.getAttribute("aria-selected") !== "true"),
        );
        const selected = options.filter((item) => item.getAttribute("aria-selected") === "true");
        // Храним все выбранные ключи в поле формы, чтобы сохранить существующую валидацию.
        input.value = selected.map((item) => item.dataset.value).join(",");
        label.textContent =
          selected.map((item) => item.textContent.trim()).join(", ") || placeholder;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        trigger.focus({ preventScroll: true });
      }

      // Переключает раскрытие списка по нажатию на поле.
      trigger.addEventListener("click", () => (list.hidden ? open() : close()));
      // Обрабатывает навигацию, выбор и поиск темы с клавиатуры.
      trigger.addEventListener("keydown", (event) => {
        const wasOpen = !list.hidden;
        if (event.key === "Escape" || event.key === "Tab") {
          if (wasOpen && event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
          }
          close();
          return;
        }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          if (!wasOpen) open();
          if (event.key === "Home") highlight(0);
          else if (event.key === "End") highlight(options.length - 1);
          else if (wasOpen)
            highlight(
              (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
                options.length,
            );
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          wasOpen ? select(activeIndex) : open();
          return;
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          if (!wasOpen) open();
          clearTimeout(searchTimer);
          search += event.key.toLocaleLowerCase("ru");
          const index = options.findIndex((option) =>
            option.textContent.toLocaleLowerCase("ru").startsWith(search),
          );
          if (index >= 0) highlight(index);
          // Сбрасывает поисковую строку после паузы во вводе.
          searchTimer = setTimeout(() => {
            search = "";
          }, 700);
        }
      });
      // Подключает управление пунктами с помощью указателя.
      options.forEach((option, index) => {
        // Сохраняем фокус комбобокса до выбора пункта мышью.
        option.addEventListener("mousedown", (event) => event.preventDefault());
        // Подсвечивает пункт под указателем.
        option.addEventListener("pointermove", () => highlight(index));
        // Переключает выбор нажатого пункта.
        option.addEventListener("click", () => select(index));
      });
      // Закрывает список при переходе фокуса на другой элемент страницы.
      root.addEventListener("focusout", (event) => {
        // При переходе в DevTools relatedTarget отсутствует — оставляем список открытым.
        if (event.relatedTarget && !root.contains(event.relatedTarget)) close();
      });
      // Закрывает список при нажатии за пределами селекта.
      document.addEventListener("click", (event) => {
        if (!root.contains(event.target)) close();
      });
      // Очищает выбранные темы при сбросе формы.
      root.closest("form")?.addEventListener("reset", () => {
        options.forEach((option) => option.setAttribute("aria-selected", "false"));
        input.value = "";
        label.textContent = placeholder;
        close();
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  }

  // Каждый компонент подключается отдельно и запускается после готовности DOM.
  document.addEventListener("DOMContentLoaded", initTopicSelect, { once: true });
})();
