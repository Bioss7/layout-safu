// Каталог работает на локальных демонстрационных данных до подключения API.
(() => {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      const root = document.querySelector(".js-catalog");
      if (!root || root.dataset.initialized) return;
      root.dataset.initialized = "true";
      const form = root.querySelector(".js-filters");
      const search = root.querySelector(".js-search");
      const clear = root.querySelector(".js-search-clear");
      const cards = [...root.querySelectorAll(".js-event-card")];
      const pager = root.querySelector(".js-pagination");
      const pages = [...root.querySelectorAll(".js-page")];
      const compact = matchMedia("(max-width: 576px)");
      let page = 1;
      const demo = {
        format: "Очно",
        registration: "Групповая заявка",
        audience: "Школьники,Абитуриенты",
        date: "10.09.2026",
        city: "Северодвинск",
        profile: "IT-технологии",
        department: "Высшая школа информационных систем",
      };
      function render() {
        const invalid = /[<>*]/.test(search.value);
        search.setAttribute("aria-invalid", String(invalid));
        root
          .querySelector(".filters__search")
          .classList.toggle("filters__search--invalid", invalid);
        root.querySelector(".js-search-error").hidden = !invalid;
        root.querySelector(".js-search-icon").hidden = invalid;
        root.querySelector(".js-search-alert").hidden = !invalid;
        search.classList.toggle("filters__input--invalid", invalid);
        const query = search.value.trim().toLocaleLowerCase("ru");
        const matches = cards.filter(
          (card) =>
            card.textContent.toLocaleLowerCase("ru").includes(query) &&
            Object.entries(demo).every(([key, value]) => {
              const selected = form.elements[key].value.split(",").filter(Boolean);
              return !selected.length || selected.some((item) => value.includes(item));
            }),
        );
        cards.forEach((card) => {
          card.hidden = true;
        });
        const visible = compact.matches ? 3 : 9;
        matches.slice(0, visible).forEach((card) => {
          card.hidden = false;
        });
        root.querySelector(".js-results-count").textContent = `${matches.length} мероприятий`;
        root.querySelector(".js-empty").hidden = matches.length > 0;
        pager.hidden = matches.length === 0;
        clear.hidden = invalid || search.value.length === 0;
        pages.forEach((button) => {
          const first = Math.max(1, page - 3);
          button.hidden =
            compact.matches &&
            (Number(button.dataset.page) < first || Number(button.dataset.page) >= first + 4);
          if (Number(button.dataset.page) === page) button.setAttribute("aria-current", "page");
          else button.removeAttribute("aria-current");
        });
        root.querySelector(".js-page-prev").disabled = page === 1;
        root.querySelector(".js-page-next").disabled = page === 6;
      }
      form.addEventListener("submit", (event) => event.preventDefault());
      search.addEventListener("input", () => {
        root.querySelector(".filters__search").classList.remove("filters__search--demo-hover");
        page = 1;
        render();
      });
      form.addEventListener("change", () => {
        page = 1;
        render();
      });
      form.addEventListener("reset", () => {
        page = 1;
        queueMicrotask(render);
      });
      clear.addEventListener("click", () => {
        search.value = "";
        page = 1;
        render();
        search.focus();
      });
      const toggle = root.querySelector(".js-filter-toggle");
      toggle.addEventListener("click", () => {
        const fields = root.querySelector(".filters__fields");
        fields.hidden = !fields.hidden;
        toggle.setAttribute("aria-expanded", String(!fields.hidden));
      });
      pages.forEach((button) =>
        button.addEventListener("click", () => {
          page = Number(button.dataset.page);
          render();
        }),
      );
      root.querySelector(".js-page-prev").addEventListener("click", () => {
        page = Math.max(1, page - 1);
        render();
      });
      root.querySelector(".js-page-next").addEventListener("click", () => {
        page = Math.min(6, page + 1);
        render();
      });
      root.querySelector('[name="sort"]').addEventListener("change", (event) => {
        const ordered = [...cards];
        if (event.target.value === "Сначала новые") ordered.reverse();
        ordered.forEach((card) => card.parentElement.append(card));
        render();
      });
      compact.addEventListener("change", render);
      root.addEventListener("events:demo-search", (event) => {
        const state = event.detail.state;
        form.reset();
        queueMicrotask(() => {
          search.value =
            { filled: "интеллект", invalid: "Программа *7x", empty: "Несуществующее мероприятие" }[
              state
            ] || "";
          search.dispatchEvent(new Event("input", { bubbles: true }));
          root
            .querySelector(".filters__search")
            .classList.toggle("filters__search--demo-hover", state === "hover");
          if (state === "focus" || state === "filled") search.focus({ preventScroll: true });
          else search.blur();
          root.scrollIntoView({ block: "start", behavior: "instant" });
        });
      });
      render();
    },
    { once: true },
  );
})();
