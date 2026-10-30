(() => {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      const menu = document.querySelector(".js-demo-menu");
      if (!menu) return;
      menu.addEventListener("click", (event) => {
        const button = event.target.closest(".js-demo-state");
        if (!button) return;
        const { target, state } = button.dataset;
        menu.querySelectorAll(`[data-target="${target}"]`).forEach((item) => {
          item.setAttribute("aria-pressed", String(item === button));
        });
        // Открываем select после обработчиков закрытия по клику вне компонента.
        setTimeout(
          () =>
            document
              .querySelector(target === "form" ? ".js-contact-form" : ".js-catalog")
              ?.dispatchEvent(new CustomEvent(`events:demo-${target}`, { detail: { state } })),
          0,
        );
      });
    },
    { once: true },
  );
})();
