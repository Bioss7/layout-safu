(() => {
  function initReviews() {
    const root = document.querySelector(".js-reviews");
    if (!root || typeof Swiper === "undefined") return;
    const viewport = root.querySelector(".js-reviews-viewport");
    const cards = [...viewport.querySelectorAll(".review-card")];
    const dots = root.querySelector(".js-reviews-dots");
    const previous = root.querySelector(".js-reviews-prev");
    const next = root.querySelector(".js-reviews-next");
    const mobile = window.matchMedia("(max-width: 768px)");
    let swiper;
    let groupSize = 4;

    function update() {
      if (!swiper) return;
      dots.querySelectorAll("button").forEach((dot, index) => {
        const active = index === swiper.realIndex;
        dot.classList.toggle("slider-dots__dot--active", active);
        dot.setAttribute("aria-current", String(active));
      });
      previous.disabled = swiper.isBeginning;
      next.disabled = swiper.isEnd;
      swiper.slides.forEach((slide, index) => {
        const active = index === swiper.realIndex;
        slide.inert = !active;
        slide.setAttribute("aria-hidden", String(!active));
      });
    }

    function regroup() {
      // Как в abiturient/reviews: сохраняем карточку при смене числа колонок.
      const firstCard = (swiper?.realIndex || 0) * groupSize;
      swiper?.destroy(true, true);
      groupSize = mobile.matches ? 1 : 4;
      viewport.replaceChildren();
      for (let index = 0; index < cards.length; index += groupSize) {
        const slide = document.createElement("div");
        slide.className = "reviews-slider__slide swiper-slide";
        const group = document.createElement("div");
        group.className = "reviews-slider__group";
        group.append(...cards.slice(index, index + groupSize));
        slide.append(group);
        viewport.append(slide);
      }
      dots.replaceChildren();
      const count = Math.ceil(cards.length / groupSize);
      for (let index = 0; index < count; index += 1) {
        const item = document.createElement("li");
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "slider-dots__dot";
        dot.setAttribute("aria-label", `Группа историй ${index + 1}`);
        dot.addEventListener("click", () => swiper.slideTo(index));
        item.append(dot);
        dots.append(item);
      }
      swiper = new Swiper(root, {
        slidesPerView: mobile.matches ? "auto" : 1,
        spaceBetween: mobile.matches ? 16 : 20,
        speed: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 400,
        initialSlide: Math.min(Math.floor(firstCard / groupSize), count - 1),
        keyboard: { enabled: true, onlyInViewport: true },
        a11y: { enabled: true },
        on: { slideChange: update },
      });
      update();
    }

    previous.addEventListener("click", () => swiper.slidePrev());
    next.addEventListener("click", () => swiper.slideNext());
    mobile.addEventListener("change", regroup);
    regroup();
  }
  document.addEventListener("DOMContentLoaded", initReviews, { once: true });
})();
