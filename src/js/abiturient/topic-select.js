(() => {
  function initTopicSelect() {
    document.querySelectorAll(".js-topic").forEach((root) => {
      const trigger = root.querySelector(".js-topic-trigger");
      const label = root.querySelector(".js-topic-value");
      const input = root.querySelector(".js-field-input");
      const list = root.querySelector(".js-topic-list");
      const options = [...list.querySelectorAll(".js-topic-option")];
      let activeIndex = 0;
      let search = "";
      let searchTimer;

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

      function close() {
        list.hidden = true;
        root.classList.remove("topic-select--open");
        trigger.setAttribute("aria-expanded", "false");
        trigger.removeAttribute("aria-activedescendant");
      }

      function open() {
        if (trigger.disabled || input.disabled || input.readOnly) return;
        // Выбираем направление и ограничиваем список свободным местом и высотой 260px.
        const bounds = root.getBoundingClientRect();
        const below = innerHeight - bounds.bottom - 12;
        const above = bounds.top - 12;
        root.classList.toggle("topic-select--up", below < 180 && above > below);
        const availableSpace = Math.floor(below < 180 && above > below ? above : below);
        const listHeight = availableSpace < 80 ? 80 : availableSpace > 260 ? 260 : availableSpace;
        root.style.setProperty("--topic-space", `${listHeight}px`);
        list.hidden = false;
        root.classList.add("topic-select--open");
        trigger.setAttribute("aria-expanded", "true");
        const selected = options.findIndex((option) => option.dataset.value === input.value);
        highlight(selected < 0 ? 0 : selected);
      }

      function select(index) {
        const option = options[index];
        input.value = option.dataset.value;
        label.textContent = option.textContent;
        options.forEach((item) => item.setAttribute("aria-selected", String(item === option)));
        close();
        input.dispatchEvent(new Event("change", { bubbles: true }));
        trigger.focus({ preventScroll: true });
      }

      trigger.addEventListener("click", () => (list.hidden ? open() : close()));
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
          searchTimer = setTimeout(() => {
            search = "";
          }, 700);
        }
      });
      options.forEach((option, index) => {
        // Сохраняем фокус комбобокса до выбора пункта мышью.
        option.addEventListener("mousedown", (event) => event.preventDefault());
        option.addEventListener("click", () => select(index));
      });
      root.addEventListener("focusout", (event) => {
        if (!root.contains(event.relatedTarget)) close();
      });
      document.addEventListener("click", (event) => {
        if (!root.contains(event.target)) close();
      });
    });
  }

  // Каждый компонент подключается отдельно и запускается после готовности DOM.
  document.addEventListener("DOMContentLoaded", initTopicSelect, { once: true });
})();
