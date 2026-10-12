(() => {
 'use strict';
 const page = document.querySelector('.program-detail');
 if (!page) return;
 const list = page.querySelector('.program-teachers__list');
 // Native touch scrolling and keyboard paging share the same snap positions.
 list?.addEventListener('keydown', event => {
  if (event.target !== list || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const step = list.firstElementChild.getBoundingClientRect().width + 16;
  const left = event.key === 'Home' ? 0 : event.key === 'End' ? list.scrollWidth : list.scrollLeft + (event.key === 'ArrowRight' ? step : -step);
  list.scrollTo({left, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
 });
})();
