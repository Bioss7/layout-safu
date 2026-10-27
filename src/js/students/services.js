(() => {
  function initStudentServices() {
    document.querySelectorAll(".js-student-services").forEach((root) => {
      if (root.dataset.servicesInitialized === "true") return;

      const list = root.querySelector(".js-student-services-tabs");
      if (!list) return;

      const tabs = [...list.querySelectorAll(".js-student-services-tab")];
      const panels = [...root.querySelectorAll(".js-student-services-panel")];
      if (!tabs.length || !panels.length) return;

      root.dataset.servicesInitialized = "true";

      // Пороги совпадают с SCSS: JS меняет только ориентацию клавиатурной навигации.
      const tablet = window.matchMedia("(max-width: 992px)");
      const phone = window.matchMedia("(max-width: 576px)");

      function updateOrientation() {
        list.setAttribute(
          "aria-orientation",
          tablet.matches && !phone.matches ? "horizontal" : "vertical",
        );
      }

      function activate(tab, moveFocus = false) {
        const selectedKey = tab.dataset.serviceTab;
        tabs.forEach((item) => {
          const selected = item === tab;
          item.classList.toggle("student-services__tab--selected", selected);
          item.setAttribute("aria-selected", String(selected));
          item.tabIndex = selected ? 0 : -1;
        });
        panels.forEach((panel) => {
          panel.hidden = panel.dataset.servicePanel !== selectedKey;
        });
        if (moveFocus) tab.focus({ preventScroll: true });
      }

      tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => activate(tab));
        tab.addEventListener("keydown", (event) => {
          const vertical = list.getAttribute("aria-orientation") === "vertical";
          const previousKey = vertical ? "ArrowUp" : "ArrowLeft";
          const nextKey = vertical ? "ArrowDown" : "ArrowRight";
          if (![previousKey, nextKey, "Home", "End"].includes(event.key)) return;

          event.preventDefault();
          let nextIndex = index;
          if (event.key === "Home") nextIndex = 0;
          if (event.key === "End") nextIndex = tabs.length - 1;
          if (event.key === nextKey) nextIndex = (index + 1) % tabs.length;
          if (event.key === previousKey) nextIndex = (index - 1 + tabs.length) % tabs.length;
          activate(tabs[nextIndex], true);
        });
      });

      tablet.addEventListener("change", updateOrientation);
      phone.addEventListener("change", updateOrientation);
      updateOrientation();
      activate(tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0]);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStudentServices, { once: true });
  } else {
    initStudentServices();
  }
})();
