(() => {
  const root = document.querySelector(".js-header");
  if (!root || root.dataset.initialized) return;
  const toggle = root.querySelector(".js-header-toggle");
  const menu = root.querySelector(".js-header-menu");
  if (!toggle || !menu) return;
  root.dataset.initialized = "true";
  const mobile = window.matchMedia("(max-width: 992px)");
  let open = false;

  function update(restoreFocus = false) {
    root.classList.toggle("header--open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    menu.hidden = mobile.matches && !open;
    if (restoreFocus) toggle.focus();
  }

  toggle.addEventListener("click", () => {
    open = !open;
    update();
  });
  menu.addEventListener("click", (event) => {
    if (mobile.matches && event.target.closest("a")) {
      open = false;
      update(true);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !open) return;
    open = false;
    update(true);
  });
  document.addEventListener("click", (event) => {
    if (!open || root.contains(event.target)) return;
    open = false;
    update();
  });
  mobile.addEventListener("change", () => {
    open = false;
    update();
  });
  update();
})();
