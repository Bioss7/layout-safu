document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('[data-reviews-slider]');
  if (!root || typeof Swiper === 'undefined') return;
  const viewport = root.querySelector('[data-reviews-viewport]');
  const cards = [...viewport.querySelectorAll('.review-card')];
  const dotsList = root.querySelector('.slider-dots');
  const prevBtn = root.querySelector('.reviews-slider__arrow--prev');
  const nextBtn = root.querySelector('.reviews-slider__arrow--next');
  const compact = window.matchMedia('(max-width: 1200px)');
  const tablet = window.matchMedia('(max-width: 992px)');
  const mobile = window.matchMedia('(max-width: 768px)');
  let swiper;
  let groupSize;
  function updateDots(index) {
    dotsList?.querySelectorAll('.slider-dots__dot').forEach(dot => {
      const selected = Number(dot.dataset.slide) === index;
      dot.classList.toggle('slider-dots__dot--active', selected);
      dot.setAttribute('aria-current', String(selected));
    });
  }
  function regroup() {
    const firstCard = (swiper?.realIndex || 0) * (groupSize || 4);
    swiper?.destroy(true, true);
    groupSize = mobile.matches ? 1 : tablet.matches ? 2 : compact.matches ? 3 : 4;
    viewport.replaceChildren();
    for (let i = 0; i < cards.length; i += groupSize) {
      const slide = document.createElement('div');
      slide.className = 'reviews-slider__slide swiper-slide';
      const group = document.createElement('div');
      group.className = 'reviews-slider__group';
      group.append(...cards.slice(i, i + groupSize));
      slide.append(group);
      viewport.append(slide);
    }
    dotsList?.replaceChildren();
    for (let i = 0; i < Math.ceil(cards.length / groupSize); i += 1) {
      const item = document.createElement('li');
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'slider-dots__dot';
      dot.setAttribute('aria-label', `Слайд ${i + 1}`);
      dot.dataset.slide = String(i);
      dot.addEventListener('click', () => swiper.slideTo(i));
      item.append(dot);
      dotsList?.append(item);
    }
    swiper = new Swiper(root, {
      slidesPerView: mobile.matches ? 'auto' : 1, spaceBetween: mobile.matches ? 16 : 0, speed: 600, loop: false, rewind: true,
      initialSlide: Math.floor(firstCard / groupSize),
      allowTouchMove: true,
      keyboard: { enabled: true, onlyInViewport: true },
      a11y: { enabled: true },
      on: { slideChange(sw) { updateDots(sw.realIndex); } }
    });
    updateDots(swiper.realIndex);
  }
  prevBtn?.addEventListener('click', () => swiper.slidePrev());
  nextBtn?.addEventListener('click', () => swiper.slideNext());
  [compact, tablet, mobile].forEach(query => query.addEventListener('change', regroup));
  regroup();
});
