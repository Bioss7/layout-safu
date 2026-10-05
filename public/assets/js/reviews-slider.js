document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('.reviews-slider');
  if (!root) return;
  if (typeof Swiper === 'undefined') return;

  const dotsList = root.querySelector('.slider-dots');
  const prevBtn = root.querySelector('.reviews-slider__arrow--prev');
  const nextBtn = root.querySelector('.reviews-slider__arrow--next');

  const swiper = new Swiper(root, {
    slidesPerView: 1,
    spaceBetween: 0,
    speed: 600,
    loop: true,
    rewind: false,
    allowTouchMove: true,
    keyboard: { enabled: true, onlyInViewport: false },
    a11y: { enabled: true },
    on: {
      slideChange(sw) {
        updateDots(sw.realIndex);
      },
    },
  });

  // Точки генерируются по фактическому количеству слайдов
  function renderDots(count) {
    if (!dotsList) return;
    dotsList.textContent = '';

    for (let i = 0; i < count; i += 1) {
      const item = document.createElement('li');

      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'slider-dots__dot';
      dot.setAttribute('aria-label', `Слайд ${i + 1}`);
      dot.setAttribute('aria-current', 'false');
      dot.dataset.slide = String(i);
      dot.addEventListener('click', () => swiper.slideTo(i));

      item.append(dot);
      dotsList.append(item);
    }
  }

  function updateDots(index) {
    if (!dotsList) return;

    for (const dot of dotsList.querySelectorAll('.slider-dots__dot')) {
      const selected = Number(dot.dataset.slide) === index;
      dot.classList.toggle('slider-dots__dot--active', selected);
      dot.setAttribute('aria-current', String(selected));
    }
  }

  prevBtn?.addEventListener('click', () => swiper.slidePrev());
  nextBtn?.addEventListener('click', () => swiper.slideNext());

  renderDots(swiper.slides.length);
  updateDots(swiper.realIndex);
});