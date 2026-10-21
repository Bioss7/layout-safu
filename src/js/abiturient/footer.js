(() => {
  function initFooter() {
    const trigger = document.querySelector(".js-footer-toggle");
    const details = document.querySelector(".js-footer-details");
    if (!trigger || !details) return;

    trigger.addEventListener("click", () => {
      const expanded = trigger.getAttribute("aria-expanded") !== "true";
      trigger.setAttribute("aria-expanded", String(expanded));
      details.hidden = !expanded;
      details.classList.toggle("footer__details--open", expanded);
    });
  }

  // Каждый компонент подключается отдельно и запускается после готовности DOM.
  document.addEventListener("DOMContentLoaded", initFooter, { once: true });
})();
