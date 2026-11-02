document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".js-people").forEach((root) => {
    if (root.dataset.initialized) return;
    root.dataset.initialized = "true";
    const tabs = [...root.querySelectorAll(".js-people-tab")];
    const panels = [...root.querySelectorAll(".js-people-panel")];
    const pages = [...root.querySelectorAll(".js-people-page")];
    const previous = root.querySelector(".js-people-prev");
    const next = root.querySelector(".js-people-next");
    const status = root.querySelector(".js-people-status");
    if (!tabs.length || !panels.length || !previous || !next) return;
    let activeTab = 0;
    let activePage = 0;

    function render() {
      tabs.forEach((tab, index) => {
        const selected = index === activeTab;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panels[index].hidden = !selected;
        panels[index].querySelectorAll(".js-people-sheet").forEach((sheet, number) => {
          sheet.hidden = number !== activePage;
        });
      });
      pages.forEach((page, index) => {
        if (index === activePage) page.setAttribute("aria-current", "true");
        else page.removeAttribute("aria-current");
      });
      previous.disabled = activePage === 0;
      next.disabled = activePage === pages.length - 1;
      status.textContent = tabs[activeTab].textContent + ", страница " + (activePage + 1);
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => {
        activeTab = index;
        activePage = 0;
        render();
      });
      tab.addEventListener("keydown", (event) => {
        let target = index;
        if (event.key === "ArrowDown") target = (index + 1) % tabs.length;
        else if (event.key === "ArrowUp") target = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") target = 0;
        else if (event.key === "End") target = tabs.length - 1;
        else return;
        event.preventDefault();
        activeTab = target;
        activePage = 0;
        render();
        tabs[target].focus({ preventScroll: true });
      });
    });
    pages.forEach((button, index) => {
      button.addEventListener("click", () => {
        activePage = index;
        render();
      });
    });
    previous.addEventListener("click", () => {
      activePage = Math.max(0, activePage - 1);
      render();
    });
    next.addEventListener("click", () => {
      activePage = Math.min(pages.length - 1, activePage + 1);
      render();
    });
    render();
  });
});
