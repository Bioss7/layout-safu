document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector(".js-student-header");
  if (!header) return;
  const panels = [...document.querySelectorAll(".js-student-panel")];
  const openers = [...document.querySelectorAll("[data-student-open]")];
  const inertBefore = new Map();
  let active = null;
  let opener = null;
  let searchTimer;
  let searchVersion = 0;
  const searchPanel = document.getElementById("student-search");
  const searchForm = searchPanel?.querySelector(".js-student-search");
  const searchInput = searchForm?.querySelector("input");
  const searchStatus = searchPanel?.querySelector(".student-search__status");
  const searchResults = searchPanel?.querySelector(".student-search__results");
  const normalize = (text) => text.toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ").trim();
  // Local demo index reuses the section labels, as the common header reuses preview cards.
  const index = [...document.querySelectorAll("#student-menu .mobile-menu__link")].map((link) => ({
    text: link.textContent.trim(),
    href: link.getAttribute("href"),
  }));

  function cancelSearch() {
    clearTimeout(searchTimer);
    searchVersion += 1;
    if (searchPanel) searchPanel.setAttribute("aria-busy", "false");
  }
  function renderSearch() {
    cancelSearch();
    searchResults?.replaceChildren();
    const query = normalize(searchInput?.value ?? "");
    if (!searchStatus || !query) {
      if (searchStatus) searchStatus.textContent = "";
      return;
    }
    const version = searchVersion;
    searchStatus.textContent = "Поиск…";
    searchPanel.setAttribute("aria-busy", "true");
    searchTimer = setTimeout(() => {
      if (version !== searchVersion || active !== searchPanel) return;
      const matches = index.filter((item) => normalize(item.text).includes(query));
      searchPanel.setAttribute("aria-busy", "false");
      searchStatus.textContent = matches.length ? `Найдено: ${matches.length}` : "Ничего не найдено";
      matches.forEach((item) => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.className = "student-search__result";
        link.href = item.href;
        link.textContent = item.text;
        li.append(link);
        searchResults.append(li);
      });
    }, 300);
  }
  function focusable(panel) {
    return [...panel.querySelectorAll('a[href], button, input, [tabindex="0"]')].filter(
      (element) => !element.disabled && !element.closest("[hidden], [inert]") && element.getClientRects().length,
    );
  }
  function close(restoreFocus = true) {
    if (!active) return;
    active.hidden = true;
    active = null;
    cancelSearch();
    openers.forEach((button) => button.setAttribute("aria-expanded", "false"));
    document.documentElement.classList.remove("page--student-panel-open");
    inertBefore.forEach((value, element) => { element.inert = value; });
    inertBefore.clear();
    if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
  }
  function open(name, button) {
    const panel = document.getElementById(`student-${name}`);
    if (!panel) return;
    const previousOpener = opener;
    close(false);
    opener = button.closest(".js-student-panel") ? previousOpener : button;
    active = panel;
    panel.hidden = false;
    document.documentElement.classList.add("page--student-panel-open");
    [...document.body.children].forEach((element) => {
      if (element === panel || element.tagName === "SCRIPT") return;
      inertBefore.set(element, element.inert);
      element.inert = true;
    });
    openers.forEach((item) => item.setAttribute("aria-expanded", String(item.dataset.studentOpen === name)));
    if (name === "search") {
      renderSearch();
      searchInput?.focus();
    } else {
      panel.querySelector("[data-student-close]")?.focus();
    }
  }
  openers.forEach((button) => button.addEventListener("click", () => open(button.dataset.studentOpen, button)));
  panels.forEach((panel) => {
    panel.querySelectorAll("[data-student-close]").forEach((button) => button.addEventListener("click", () => close()));
    panel.addEventListener("click", (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || link.getAttribute("href") === "#") return;
      const target = document.getElementById(link.hash.slice(1));
      if (!target) return;
      event.preventDefault();
      close(false);
      target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      const previousTabindex = target.getAttribute("tabindex");
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      target.addEventListener("blur", () => {
        if (previousTabindex === null) target.removeAttribute("tabindex");
        else target.setAttribute("tabindex", previousTabindex);
      }, { once: true });
      history.replaceState(null, "", link.hash);
    });
  });
  searchForm?.addEventListener("submit", (event) => { event.preventDefault(); renderSearch(); });
  searchInput?.addEventListener("input", renderSearch);
  document.addEventListener("keydown", (event) => {
    if (!active) return;
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const items = focusable(active);
    if (!items.length) { event.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  window.matchMedia("(min-width: 1201px)").addEventListener("change", (event) => {
    if (event.matches && active?.id === "student-menu") close(false);
  });

  const language = header.querySelector(".js-student-language");
  const languageToggle = language?.querySelector("button");
  const languages = language?.querySelector("ul");
  function closeLanguages() {
    if (!languages) return;
    languages.hidden = true;
    languageToggle.setAttribute("aria-expanded", "false");
  }
  languageToggle?.addEventListener("click", () => {
    languages.hidden = !languages.hidden;
    languageToggle.setAttribute("aria-expanded", String(!languages.hidden));
  });
  language?.addEventListener("focusout", (event) => { if (!language.contains(event.relatedTarget)) closeLanguages(); });
  document.addEventListener("click", (event) => { if (!language?.contains(event.target)) closeLanguages(); });
  language?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { closeLanguages(); languageToggle.focus(); }
  });

  const footer = document.querySelector(".js-student-footer");
  const footerToggle = footer?.querySelector(".site-footer__toggle");
  const footerDetails = footer?.querySelector(".site-footer__details");
  footerToggle?.addEventListener("click", () => {
    const expanded = footerToggle.getAttribute("aria-expanded") !== "true";
    footerToggle.setAttribute("aria-expanded", String(expanded));
    footerDetails.hidden = !expanded;
  });
});

