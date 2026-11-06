(() => {
  function initFaq() {
    document.querySelectorAll(".js-tabs").forEach((root) => {
      const list = root.querySelector(".js-tablist");
      if (!list) return;
      const tabs = [...list.querySelectorAll(".js-tab")];
      const panels = [...root.querySelectorAll(".js-tab-panel")];
      function activate(tab, focus = false) {
        tabs.forEach((item) => {
          const selected = item === tab;
          item.classList.toggle("tabs__tab--active", selected);
          item.setAttribute("aria-selected", String(selected));
          item.tabIndex = selected ? 0 : -1;
        });
        panels.forEach((panel) => {
          panel.hidden = panel.dataset.panel !== tab.dataset.tab;
        });
        if (focus) tab.focus({ preventScroll: true });
      }
      tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => activate(tab));
        tab.addEventListener("keydown", (event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          let next = index;
          if (event.key === "Home") next = 0;
          if (event.key === "End") next = tabs.length - 1;
          if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
          if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
          activate(tabs[next], true);
        });
      });
    });
    // Поведение перенесено из abiturient/accordion, независимо для каждой панели.
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
  document.addEventListener("DOMContentLoaded", initFaq, { once: true });
})();
