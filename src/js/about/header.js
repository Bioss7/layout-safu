document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('[data-header]');
  if (!header) return;
  const buttons = [...header.querySelectorAll('[data-header-toggle]')];
  const panels = [...header.querySelectorAll('[data-header-panel]')];
  const menuSections = [...header.querySelectorAll('[data-header-section]')];
  const input = header.querySelector('[data-header-query]');
  const clear = header.querySelector('[data-header-clear]');
  let active = null;
  let opener = null;
  const background = [...document.body.children].filter(el =>
    el !== header && el.tagName !== 'SCRIPT');
  const inertBefore = new Map();
  const focusable = () => [...header.querySelectorAll(
    'a[href], button, input, [tabindex="0"]'
  )].filter(el => !el.closest('[hidden]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.disabled);

  function close(restoreFocus = true) {
    panels.forEach(panel => { panel.hidden = true; });
    buttons.forEach(button => button.setAttribute('aria-expanded', 'false'));
    header.classList.remove('header--menu-open', 'header--search-open', 'header--open');
    document.documentElement.classList.remove('page--header-open');
    background.forEach(el => { el.inert = inertBefore.get(el) ?? false; });
    inertBefore.clear();
    header.removeAttribute('role');
    header.removeAttribute('aria-modal');
    header.removeAttribute('aria-label');
    active = null;
    if (restoreFocus) opener?.focus();
  }

  function selectSection(button) {
    const target = button.dataset.headerSection;
    const wasOpen = button.getAttribute('aria-expanded') === 'true';
    const mobile = window.matchMedia('(max-width: 768px)').matches;
    menuSections.forEach(item => {
      const selected = item === button && !(mobile && wasOpen);
      item.classList.toggle('header__section-btn--active', selected);
      item.setAttribute('aria-expanded', String(selected));
      header.querySelector('[data-header-submenu="' + item.dataset.headerSection + '"]').hidden = !selected;
    });
  }

  function open(name, button) {
    if (active === name) { close(); return; }
    if (active) close(false);
    active = name;
    opener = button;
    header.classList.add('header--open', 'header--' + name + '-open');
    document.documentElement.classList.add('page--header-open');
    background.forEach(el => {
      inertBefore.set(el, el.inert);
      el.inert = true;
    });
    header.setAttribute('role', 'dialog');
    header.setAttribute('aria-modal', 'true');
    header.setAttribute('aria-label', name === 'menu' ? 'Меню сайта' : 'Поиск по сайту');
    buttons.forEach(item => item.setAttribute('aria-expanded', String(item === button)));
    panels.forEach(panel => { panel.hidden = panel.dataset.headerPanel !== name; });
    if (name === 'menu') {
      menuSections.forEach(item => {
        const selected = item.dataset.headerSection === 'university';
        item.classList.toggle('header__section-btn--active', selected);
        item.setAttribute('aria-expanded', String(selected));
        header.querySelector('[data-header-submenu="' + item.dataset.headerSection + '"]').hidden = !selected;
      });
      menuSections.find(item => item.dataset.headerSection === 'university')?.focus();
    } else input?.focus();
  }

  buttons.forEach(button => button.addEventListener('click', () => open(button.dataset.headerToggle, button)));
  menuSections.forEach(button => button.addEventListener('click', () => selectSection(button)));
  header.querySelector('[data-header-search-form]')?.addEventListener('submit', event => event.preventDefault());
  clear?.addEventListener('click', () => { input.value = ''; input.focus(); });

  header.querySelectorAll('[data-header-dropdown]').forEach(dropdown => {
    const toggle = dropdown.querySelector('button');
    const list = dropdown.querySelector('ul');
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
