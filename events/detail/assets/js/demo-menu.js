(() => {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      const menu = document.querySelector(".js-demo-menu");
      if (!menu || menu.dataset.initialized) return;
      menu.dataset.initialized = "true";
      menu.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !menu.open) return;
        event.preventDefault();
        menu.open = false;
        menu.querySelector("summary").focus();
      });
      menu.addEventListener("click", (event) => {
        const button = event.target.closest(".js-demo-state");
        if (!button) return;
        const { target, state } = button.dataset;
        menu.querySelectorAll(`[data-target="${target}"]`).forEach((item) => {
          item.setAttribute("aria-pressed", String(item === button));
        });
        // Переключаем состояние после завершения текущего клика по тестовому меню.
        setTimeout(
          () =>
            document
              .querySelector(".js-contact-form")
              ?.dispatchEvent(new CustomEvent("event-detail:demo-form", { detail: { state } })),
          0,
        );
      });
    },
    { once: true },
  );
})();
