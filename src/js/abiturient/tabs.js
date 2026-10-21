(() => {
  function initTabs() {
    document.querySelectorAll(".js-tabs").forEach((root) => {
      const list = root.querySelector(".js-tablist");
      const tabs = [...list.querySelectorAll(".js-tab")];
      const panels = [...root.querySelectorAll(".js-tab-panel")];

      function activate(tab, moveFocus = false) {
        const selectedKey = tab.dataset.tab;
        tabs.forEach((item) => {
          const selected = item === tab;
          item.classList.toggle("tabs__tab--active", selected);
          item.setAttribute("aria-selected", String(selected));
          item.tabIndex = selected ? 0 : -1;
        });
        panels.forEach((panel) => {
          panel.hidden = panel.dataset.panel !== selectedKey;
        });

        // Один ключ переключает панель и экспортированное целиком состояние карты.
        const map = root.querySelector(".js-contact-map-image");
        if (map) {
          map.src = `/abiturient/assets/img/contacts/map-${selectedKey}.png`;
          map.alt = `Карта: ${tab.textContent.trim()}`;
        }
        root.dispatchEvent(new CustomEvent("tabchange", { detail: { key: selectedKey } }));
        if (moveFocus) tab.focus({ preventScroll: true });
        // Прокручиваем только вкладки, сохраняя положение страницы.
        const left = tab.offsetLeft - list.offsetLeft;
        if (left < list.scrollLeft) list.scrollLeft = left;
        if (left + tab.offsetWidth > list.scrollLeft + list.clientWidth) {
          list.scrollLeft = left + tab.offsetWidth - list.clientWidth;
        }
      }

      tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => activate(tab));
        tab.addEventListener("keydown", (event) => {
          const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
          if (!keys.includes(event.key)) return;
          event.preventDefault();
          let next = index;
          if (event.key === "Home") next = 0;
          if (event.key === "End") next = tabs.length - 1;
          if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
          if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
          activate(tabs[next], true);
        });
      });

      const active = tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0];
      activate(active);
    });
  }

  // Каждый компонент подключается отдельно и запускается после готовности DOM.
  document.addEventListener("DOMContentLoaded", initTabs, { once: true });
})();
