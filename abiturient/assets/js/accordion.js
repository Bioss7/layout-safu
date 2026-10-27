(() => {
  function initAccordions() {
    document.querySelectorAll(".js-accordion").forEach((root) => {
      const trigger = root.querySelector(".js-accordion-trigger");
      const body = root.querySelector(".js-accordion-body");
      if (!trigger || !body) return;

      trigger.addEventListener("click", () => {
        const expanded = trigger.getAttribute("aria-expanded") !== "true";
        trigger.setAttribute("aria-expanded", String(expanded));
        root.classList.toggle("accordion--open", expanded);
        body.hidden = !expanded;
      });
    });
  }

  // Каждый компонент подключается отдельно и запускается после готовности DOM.
  document.addEventListener("DOMContentLoaded", initAccordions, { once: true });
})();
