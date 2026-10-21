(() => {
  function initDragScroll() {
    document.querySelectorAll(".js-drag-scroll").forEach((list) => {
      let origin = null;
      let dragged = false;
      const updateOverflow = () =>
        list.classList.toggle("tabs--scrollable", list.scrollWidth > list.clientWidth + 1);
      new ResizeObserver(updateOverflow).observe(list);
      document.fonts.ready.then(updateOverflow);
      updateOverflow();
      list.addEventListener("pointerdown", (event) => {
        // Сенсорная прокрутка остаётся нативной. Захват мыши включаем после порога.
        if (
          event.pointerType !== "mouse" ||
          event.button !== 0 ||
          list.scrollWidth <= list.clientWidth
        )
          return;
        origin = { x: event.clientX, scroll: list.scrollLeft, id: event.pointerId };
        dragged = false;
      });
      list.addEventListener("pointermove", (event) => {
        if (!origin) return;
        const distance = event.clientX - origin.x;
        if (Math.abs(distance) > 5) {
          dragged = true;
          list.setPointerCapture(origin.id);
          list.classList.add("tabs--dragging");
        }
        if (dragged) {
          event.preventDefault();
          list.scrollLeft = origin.scroll - distance;
        }
      });
      const release = () => {
        origin = null;
        list.classList.remove("tabs--dragging");
      };
      list.addEventListener("pointerup", release);
      list.addEventListener("pointercancel", release);
      list.addEventListener("lostpointercapture", release);
      window.addEventListener("pointerup", release);
      list.addEventListener(
        "click",
        (event) => {
          if (!dragged || event.detail === 0) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          dragged = false;
        },
        true,
      );
    });
  }

  // Каждый компонент подключается отдельно и запускается после готовности DOM.
  document.addEventListener("DOMContentLoaded", initDragScroll, { once: true });
})();
