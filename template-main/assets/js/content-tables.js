(() => {
  const initialize = () => {
    document.querySelectorAll(".template-content table").forEach((table, index) => {
      if (table.closest("[data-table-scroll]")) return;

      const wrapper = document.createElement("div");
      wrapper.setAttribute("data-table-scroll", "");
      const viewport = document.createElement("div");
      viewport.setAttribute("data-table-viewport", "");
      viewport.setAttribute("role", "region");
      viewport.setAttribute(
        "aria-label",
        table.caption?.textContent.trim() || `Таблица ${index + 1}`,
      );
      const progress = document.createElement("progress");
      progress.setAttribute("data-table-progress", "");
      progress.setAttribute("aria-hidden", "true");
      progress.max = 1;

      table.before(wrapper);
      if (table.caption) {
        const label = document.createElement("div");
        label.setAttribute("data-table-label", "");
        label.setAttribute("aria-hidden", "true");
        label.textContent = table.caption.textContent;
        wrapper.append(label);
      }
      wrapper.append(progress, viewport);
      viewport.append(table);

      const update = () => {
        const distance = viewport.scrollWidth - viewport.clientWidth;
        const overflow = distance > 1;
        wrapper.dataset.overflow = String(overflow);
        viewport.tabIndex = overflow ? 0 : -1;
        // Начальная длина индикатора соответствует Figma 126:6764.
        const initialProgress = 137.36585998535156 / 512;
        progress.value = overflow
          ? initialProgress + ((1 - initialProgress) * viewport.scrollLeft) / distance
          : 1;
      };
      viewport.addEventListener("scroll", update, { passive: true });
      const observer = new ResizeObserver(update);
      observer.observe(viewport);
      observer.observe(table);
      document.fonts.ready.then(update);
      update();
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
