document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".js-partner-network").forEach((root) => {
    const list = root.querySelector(".js-partner-tabs");
    const tabs = [...root.querySelectorAll(".js-partner-tab")];
    const panels = [...root.querySelectorAll(".js-partner-panel")];
    if (!list || !tabs.length || !panels.length || list.dataset.initialized) return;
    list.dataset.initialized = "true";

    function activate(tab, focus = false) {
      tabs.forEach((item) => {
        const selected = item === tab;
        item.setAttribute("aria-selected", String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      panels.forEach((panel) => {
        panel.hidden = panel.id !== tab.getAttribute("aria-controls");
      });
      if (focus) tab.focus({ preventScroll: true });
      // Перемещаем только ленту вкладок, не всю страницу.
      const bounds = list.getBoundingClientRect();
      const rect = tab.getBoundingClientRect();
      if (rect.left < bounds.left) list.scrollLeft -= bounds.left - rect.left;
      if (rect.right > bounds.right) list.scrollLeft += rect.right - bounds.right;
      root.dispatchEvent(new Event("partners:change"));
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activate(tab));
      tab.addEventListener("keydown", (event) => {
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault();
        activate(tabs[next], true);
      });
    });

    let drag;
    let suppressClick = false;
    list.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      suppressClick = false;
      // Многострочные мобильные вкладки не требуют перетаскивания.
      if (getComputedStyle(list).flexWrap !== "nowrap" || list.scrollWidth <= list.clientWidth)
        return;
      drag = { id: event.pointerId, x: event.clientX, scroll: list.scrollLeft, moved: false };
    });
    list.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const delta = event.clientX - drag.x;
      if (!drag.moved && Math.abs(delta) <= 5) return;
      if (!drag.moved) list.setPointerCapture(event.pointerId);
      drag.moved = true;
      suppressClick = true;
      list.classList.add("partner-network__tabs--dragging");
      list.scrollLeft = drag.scroll - delta;
    });
    function stopDrag() {
      if (drag && list.hasPointerCapture(drag.id)) list.releasePointerCapture(drag.id);
      drag = null;
      list.classList.remove("partner-network__tabs--dragging");
    }
    window.addEventListener("resize", () => {
      stopDrag();
      suppressClick = false;
    });
    list.addEventListener("pointerup", stopDrag);
    list.addEventListener("pointercancel", () => {
      stopDrag();
      suppressClick = false;
    });
    list.addEventListener("lostpointercapture", stopDrag);
    list.addEventListener("pointerleave", () => {
      if (drag && !drag.moved) stopDrag();
    });
    list.addEventListener(
      "click",
      (event) => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressClick = false;
      },
      true,
    );
    activate(tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0]);
  });
});
