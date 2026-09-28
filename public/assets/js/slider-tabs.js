document.querySelectorAll('.hero__tabs, .hero__dots').forEach((tablist) => {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  if (!tabs.length) return;

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activate(i));
    tab.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft')  next = (i - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home')       next = 0;
      if (e.key === 'End')        next = tabs.length - 1;
      if (next !== null) {
        e.preventDefault();
        tabs[next].focus();
        activate(next);
      }
    });
  });

  function activate(index) {
    // Все табы в этом таб-листе
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.classList.toggle('hero__tab--active', selected && tab.classList.contains('hero__tab'));
      tab.classList.toggle('hero__dot--active', selected && tab.classList.contains('hero__dot'));
      tab.tabIndex = selected ? 0 : -1;

      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (panel) {
        panel.classList.toggle('hero__slide--active', selected);
        panel.hidden = !selected;
      }
    });
  }
});