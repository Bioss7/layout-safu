document.addEventListener('DOMContentLoaded', () => {
  const sliderEl = document.querySelector('.reviews-slider.swiper');
  if (!sliderEl) return;

  const prevBtn = sliderEl.querySelector('.reviews-slider__arrow--prev');
  const nextBtn = sliderEl.querySelector('.reviews-slider__arrow--next');
  const dotsEl = sliderEl.querySelector('.slider-dots');

  const slides = sliderEl.querySelectorAll('.reviews-slider__slide');
  const totalSlides = slides.length;

  // Генерируем точки — по одной на слайд (группу)
  dotsEl.innerHTML = '';
  for (let i = 0; i < totalSlides; i++) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'slider-dots__dot' + (i === 0 ? ' slider-dots__dot--active' : '');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Слайд ${i + 1}`);
    btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    btn.setAttribute('role', 'tab');
    btn.dataset.index = i;
    li.appendChild(btn);
    dotsEl.appendChild(li);
  }

  const swiper = new Swiper(sliderEl, {
    slidesPerView: 1,
    spaceBetween: 20,
    grabCursor: true,

    // Бесконечная прокрутка
    loop: true,
    loopAdditionalSlides: 1,
    speed: 600,

    // Автоплей (опционально — уберите если не нужен)
    // autoplay: {
    //   delay: 5000,
    //   disableOnInteraction: false,
    //   pauseOnMouseEnter: true,
    // },

    navigation: {
      prevEl: prevBtn,
      nextEl: nextBtn,
      disabledClass: 'arrow-btn--disabled',
    },

    on: {
      // Синхронизация активной точки с учётом loop
      slideChange(sw) {
        // В loop-режиме sw.realIndex — это индекс реального слайда (0..totalSlides-1)
        const realIndex = sw.realIndex;
        const dots = dotsEl.querySelectorAll('.slider-dots__dot');
        dots.forEach((dot, i) => {
          const isActive = i === realIndex;
          dot.classList.toggle('slider-dots__dot--active', isActive);
          dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
      },

      init(sw) {
        // Клик по точке
        dotsEl.querySelectorAll('.slider-dots__dot').forEach((dot) => {
          dot.addEventListener('click', (e) => {
            const index = Number(e.currentTarget.dataset.index);
            sw.slideToLoop(index); // slideToLoop работает с loop
          });
        });
      },
    },

    a11y: {
      prevSlideMessage: 'Предыдущий слайд',
      nextSlideMessage: 'Следующий слайд',
    },
  });
}); 