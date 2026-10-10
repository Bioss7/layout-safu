document.addEventListener('DOMContentLoaded', () => {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  if (typeof Swiper === 'undefined') return;

  const tabsList = hero.querySelector('[data-hero-tabs]');
  const tabs     = [...hero.querySelectorAll('.hero__tab')];
  const panels   = [...hero.querySelectorAll('.hero__panel')];
  const dotsList = hero.querySelector('[data-hero-dots]');
  const prevBtn  = hero.querySelector('[data-hero-prev]');
  const nextBtn  = hero.querySelector('[data-hero-next]');

  /** @type {(Swiper|null)[]} */
  const swipers = new Array(panels.length).fill(null);
  let activeIndex = -1;

  // ============ СЛАЙДЕР ============

  // Swiper для каждой панели (включая скрытые).
  // swiper-bundle уже содержит EffectFade/Keyboard/A11y — modules не передаём.
  panels.forEach((panel, index) => {
    const el = panel.querySelector('[data-hero-swiper]');
    if (!el) return;

    swipers[index] = new Swiper(el, {
      effect: 'fade',
      fadeEffect: { crossFade: true },
      speed: 450,
      loop: false,
      allowTouchMove: true,
      keyboard: { enabled: true, onlyInViewport: false },
      a11y: { enabled: true },
      on: {
        slideChange(sw) {
          if (index !== activeIndex) return;
          updateDots(sw.realIndex);
          updateArrows(sw);
        },
      },
    });
  });

  // Точки: ровно столько, сколько слайдов в активной панели
  function renderDots(count) {
    if (!dotsList) return;
    dotsList.textContent = '';

    for (let i = 0; i < count; i += 1) {
      const item = document.createElement('li');
      item.className = 'hero__dot-item';

      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'hero__dot';
      dot.setAttribute('aria-label', `Слайд ${i + 1}`);
      dot.setAttribute('aria-selected', 'false');
      dot.dataset.heroDot = String(i);
      dot.addEventListener('click', () => swipers[activeIndex]?.slideTo(i));

      const label = document.createElement('span');
      label.className = 'hero__dot-number';
      label.textContent = String(i + 1).padStart(2, '0');

      dot.append(label);
      item.append(dot);
      dotsList.append(item);
    }
  }

  function updateDots(index) {
    if (!dotsList) return;

    for (const dot of dotsList.querySelectorAll('.hero__dot')) {
      const selected = Number(dot.dataset.heroDot) === index;
      dot.classList.toggle('hero__dot--active', selected);
      dot.setAttribute('aria-selected', String(selected));
    }
  }

  function updateArrows(sw) {
    if (!sw) return;
    prevBtn?.toggleAttribute('disabled', sw.isBeginning);
    nextBtn?.toggleAttribute('disabled', sw.isEnd);
  }

  prevBtn?.addEventListener('click', () => swipers[activeIndex]?.slidePrev());
  nextBtn?.addEventListener('click', () => swipers[activeIndex]?.slideNext());

  // ============ ТАБЫ ============

  if (tabsList) tabsList.setAttribute('role', 'tablist');
  tabs.forEach((tab, i) => {
    tab.setAttribute('role', 'tab');
    const panel = panels[i];
    if (panel) {
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `hero-tab-${i}`);
      tab.setAttribute('aria-controls', `hero-panel-${i}`);
      tab.id = `hero-tab-${i}`;
    }
  });

  function activateTab(index, { focus = false } = {}) {
    if (index === activeIndex) return;
    activeIndex = index;

    const sw = swipers[index];
    const panel = panels[index];

    // 1. Точки рисуем до показа панели, чтобы не было кадра со старым числом
    renderDots(panel ? panel.querySelectorAll('.swiper-slide').length : 0);

    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.classList.toggle('hero__tab--active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;

      const tabPanel = panels[i];
      if (!tabPanel) return;
      tabPanel.classList.toggle('hero__panel--active', selected);
      tabPanel.hidden = !selected;
      tabPanel.setAttribute('aria-hidden', String(!selected));
    });

    // 2. Синхронный update: панель уже видима, браузер ещё не рисовал кадр,
    //    поэтому высота считается верно и пагинация не прыгает
    if (sw) {
      sw.update();
      sw.slideTo(0, 0);
      updateDots(sw.realIndex);
      updateArrows(sw);
    } else {
      updateDots(0);
    }

    if (focus) tabs[index]?.focus();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activateTab(i));

    tab.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft')  next = (i - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home')       next = 0;
      if (e.key === 'End')        next = tabs.length - 1;
      if (next !== null) {
        e.preventDefault();
        activateTab(next, { focus: true });
      }
    });
  });

  // Старт
  activateTab(0);
});