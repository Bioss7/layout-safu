(() => {
  function initAccordions() {
    document.querySelectorAll(".js-stp-accordion").forEach((root) => {
      if (root.dataset.initialized) return;
      const trigger = root.querySelector(".js-accordion-trigger");
      const body = root.querySelector(".js-accordion-body");
      if (!trigger || !body) return;
      root.dataset.initialized = "true";
      trigger.addEventListener("click", () => {
        const expanded = trigger.getAttribute("aria-expanded") !== "true";
        trigger.setAttribute("aria-expanded", String(expanded));
        root.classList.toggle("stp-accordion--open", expanded);
        body.hidden = !expanded;
      });
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAccordions, { once: true });
  } else {
    initAccordions();
  }
})();
