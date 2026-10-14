document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('[data-header]');
  if (!header) return;
  const buttons = [...header.querySelectorAll('[data-header-toggle]')];
  const panelsWrap = document.querySelector('[data-header-panels]');
  const panels = [...(panelsWrap?.querySelectorAll('[data-header-panel]') ?? [])];
  const menuSections = [...(panelsWrap?.querySelectorAll('[data-header-section]') ?? [])];
  const input = panelsWrap?.querySelector('[data-header-query]');
  const clear = panelsWrap?.querySelector('[data-header-clear]');
  const searchPanel = panelsWrap?.querySelector('[data-header-panel="search"]');
  const searchCount = searchPanel?.querySelector('[data-header-search-count]');
  const normalizeSearchText = text => text.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  // Local search stub uses the existing preview cards as its demo index.
  const searchItems = [...(searchPanel?.querySelectorAll('[data-header-result]') ?? [])].map(element => ({
    element,
    text: normalizeSearchText(element.textContent),
  }));
  let active = null;
  let opener = null;
  let searchTimer;
  let searchController;
  let searchVersion = 0;
  const background = [...document.body.children].filter(el =>
    el !== header && el !== panelsWrap && el.tagName !== 'SCRIPT');
  const inertBefore = new Map();
  const focusable = () => [...document.querySelectorAll(
    'a[href], button, input, [tabindex="0"]'
  )].filter(el => !el.closest('[hidden], [inert]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.disabled);

  function renderSearch(state = 'idle', matches = []) {
    if (!input || !searchPanel) return;
    searchItems.forEach(item => {
      item.element.classList.toggle('header-panels__result--hidden', !matches.includes(item));
    });
    ['loading', 'results', 'empty'].forEach(name => {
      searchPanel.classList.toggle('header-panels__search--' + name, state === name);
    });
    searchPanel.setAttribute('aria-busy', String(state === 'loading'));
    const status = state === 'idle' ? '' : state === 'loading' ? 'Поиск…' : `Найдено: ${matches.length}`;
    if (searchCount && searchCount.textContent !== status) searchCount.textContent = status;
    clear?.classList.toggle('search-input__clear--hidden', input.value.length === 0);
  }

  function cancelSearch() {
    clearTimeout(searchTimer);
    searchController?.abort();
    searchController = null;
    searchVersion += 1;
  }

  function mockSearch(query, signal) {
    return new Promise((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException('Search cancelled', 'AbortError'));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', abort);
        resolve(searchItems.filter(item => item.text.includes(query)));
      }, 600);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
  }

  async function requestSearch(query, version) {
    if (active !== 'search' || version !== searchVersion) return;
    const controller = new AbortController();
    searchController = controller;
    renderSearch('loading');
    try {
      const matches = await mockSearch(query, controller.signal);
      if (version !== searchVersion || active !== 'search' || controller.signal.aborted) return;
      renderSearch(matches.length ? 'results' : 'empty', matches);
    } catch (error) {
      if (error.name !== 'AbortError') throw error;
    } finally {
      if (searchController === controller) searchController = null;
    }
  }

  function startSearch(debounce = false) {
    cancelSearch();
    renderSearch();
    const query = normalizeSearchText(input?.value ?? '');
    if (!query || active !== 'search') return;
    const version = searchVersion;
    if (debounce) searchTimer = setTimeout(() => requestSearch(query, version), 300);
    else requestSearch(query, version);
  }

  function close(restoreFocus = true) {
    panelsWrap?.classList.remove('header-panels--open');
    cancelSearch();
    renderSearch();
    panels.forEach(panel => { panel.hidden = true; });
    buttons.forEach(button => button.setAttribute('aria-expanded', 'false'));
    header.classList.remove('header--menu-open', 'header--search-open', 'header--open');
    document.documentElement.classList.remove('page--header-open');
    background.forEach(el => { el.inert = inertBefore.get(el) ?? false; });
    inertBefore.clear();
    header.removeAttribute('aria-label');
    active = null;
    if (restoreFocus) opener?.focus({ preventScroll: true });
  }

  function selectSection(button) {
    const wasOpen = button.getAttribute('aria-expanded') === 'true';
    const mobile = window.matchMedia('(max-width: 768px)').matches;
    menuSections.forEach(item => {
      const selected = item === button && !(mobile && wasOpen);
      item.classList.toggle('header-panels__section-btn--active', selected);
      item.setAttribute('aria-expanded', String(selected));
      panelsWrap.querySelector('[data-header-submenu="' + item.dataset.headerSection + '"]').hidden = !selected;
    });
  }

  function open(name, button) {
    if (active === name) { close(); return; }
    if (active) close(false);
    active = name;
    panelsWrap?.classList.add('header-panels--open');
    opener = button;
    header.classList.add('header--open', 'header--' + name + '-open');
    document.documentElement.classList.add('page--header-open');
    background.forEach(el => {
      inertBefore.set(el, el.inert);
      el.inert = true;
    });
    header.setAttribute('aria-label', name === 'menu' ? 'Меню сайта' : 'Поиск по сайту');
    buttons.forEach(item => item.setAttribute('aria-expanded', String(item === button)));
    panels.forEach(panel => { panel.hidden = panel.dataset.headerPanel !== name; });
    if (name === 'menu') {
      menuSections.forEach(item => {
        const selected = item.dataset.headerSection === 'university';
        item.classList.toggle('header-panels__section-btn--active', selected);
        item.setAttribute('aria-expanded', String(selected));
        panelsWrap.querySelector('[data-header-submenu="' + item.dataset.headerSection + '"]').hidden = !selected;
      });
      menuSections.find(item => item.dataset.headerSection === 'university')?.focus();
    } else {
      startSearch();
      input?.focus();
    }
  }

  buttons.forEach(button => button.addEventListener('click', () => open(button.dataset.headerToggle, button)));
  menuSections.forEach(button => button.addEventListener('click', () => selectSection(button)));
  input?.addEventListener('input', () => startSearch(true));
  panelsWrap?.querySelector('[data-header-search-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    startSearch();
  });
  clear?.addEventListener('click', () => {
    if (!input) return;
    input.value = '';
    startSearch();
    input.focus();
  });
  renderSearch();

  header.querySelectorAll('[data-header-dropdown]').forEach(dropdown => {
    const toggle = dropdown.querySelector('button');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') !== 'true';
      dropdown.classList.toggle('header__dropdown--open', expanded);
      toggle.setAttribute('aria-expanded', String(expanded));
    });
    dropdown.addEventListener('focusout', event => {
      if (dropdown.contains(event.relatedTarget)) return;
      dropdown.classList.remove('header__dropdown--open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', event => {
    header.querySelectorAll('[data-header-dropdown]').forEach(dropdown => {
      if (dropdown.contains(event.target)) return;
      dropdown.classList.remove('header__dropdown--open');
      dropdown.querySelector('button').setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('keydown', event => {
    if (!active) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });
});

// Existing disclosures also serve catalog filters and the legacy detail-page header.
(() => {
 'use strict';
 const storage = {
  read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be unavailable in private mode. */ } }
 };
 const disclosures = [...document.querySelectorAll('[data-disclosure], [data-filter-toggle]')];
 const setDisclosure = (button, open) => {
  const panel = document.getElementById(button.getAttribute('aria-controls'));
  if (!panel) return;
  button.setAttribute('aria-expanded', String(open));
  panel.hidden = !open;
 };
 disclosures.forEach(button => button.addEventListener('click', () => {
  const open = button.getAttribute('aria-expanded') !== 'true';
  if (button.hasAttribute('data-disclosure')) disclosures.filter(other => other !== button && other.hasAttribute('data-disclosure')).forEach(other => setDisclosure(other, false));
  setDisclosure(button, open);
  if (open && button.getAttribute('aria-controls') === 'header-search') document.getElementById('site-search').focus();
 }));
 document.addEventListener('click', event => {
  disclosures.filter(button => button.hasAttribute('data-disclosure')).forEach(button => {
   const panel = document.getElementById(button.getAttribute('aria-controls'));
   if (!button.contains(event.target) && !panel?.contains(event.target)) setDisclosure(button, false);
  });
 });
 document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const active = disclosures.find(button => button.getAttribute('aria-expanded') === 'true' && (button === document.activeElement || document.getElementById(button.getAttribute('aria-controls'))?.contains(document.activeElement)));
  if (active) { setDisclosure(active, false); active.focus(); }
  else disclosures.filter(button => button.hasAttribute('data-disclosure')).forEach(button => setDisclosure(button, false));
 });
 const contrast = document.querySelector('[data-contrast]');
 function setContrast(on) { document.body.classList.toggle('is-contrast', on); contrast?.setAttribute('aria-pressed', String(on)); }
 setContrast(storage.read('safu-contrast', false));
 contrast?.addEventListener('click', () => { const on = !document.body.classList.contains('is-contrast'); setContrast(on); storage.write('safu-contrast', on); });
})();

// Footer disclosure, kept in the existing programs script entrypoint.
document.addEventListener('DOMContentLoaded', () => {
  const footer = document.querySelector('.footer');
  if (!footer) return;
  const toggle = footer.querySelector('[data-footer-toggle]');
  const details = footer.querySelector('[data-footer-details]');
  if (!toggle || !details) return;

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(expanded));
    details.hidden = !expanded;
    details.classList.toggle('footer__details--open', expanded);
  });
});
