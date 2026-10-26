(() => {
  function initReviews() {
    const root = document.querySelector(".js-reviews");
    if (!root) return;
    const viewport = root.querySelector(".js-reviews-viewport");
    const cards = [...viewport.querySelectorAll(".review-card")];
    const dots = root.querySelector(".js-reviews-dots");
    const previous = root.querySelector(".js-reviews-prev");
    const next = root.querySelector(".js-reviews-next");
    const queries = [1200, 992, 768, 390].map((width) =>
      window.matchMedia(`(max-width: ${width}px)`),
    );
    let swiper;
    let groupSize = 4;
    let maxDots = 5;

    function targetSlide(index, slideCount) {
      return slideCount <= maxDots ? index : Math.round((index * (slideCount - 1)) / (maxDots - 1));
    }

    function updateDots() {
      if (!swiper) return;
      const count = Math.ceil(cards.length / groupSize);
      const active =
        count <= maxDots
          ? swiper.realIndex
          : Math.round((swiper.realIndex * (maxDots - 1)) / (count - 1));
      const dotCount = Math.min(maxDots, count);
      const displayActive = (active + Math.floor(dotCount / 2)) % dotCount;
      const lastOffset = swiper.snapGrid.at(-1) || 0;
      const lastReachable = swiper.slidesGrid.reduce(
        (best, offset, index, offsets) =>
          Math.abs(offset - lastOffset) < Math.abs(offsets[best] - lastOffset) ? index : best,
        0,
      );
      dots.querySelectorAll(".js-review-dot").forEach((dot, index) => {
        const logicalIndex = (index + dotCount - Math.floor(dotCount / 2)) % dotCount;
        const slideIndex = Math.min(targetSlide(logicalIndex, count), lastReachable);
        dot.dataset.reviewSlide = String(slideIndex);
        dot.setAttribute("aria-label", `Слайд ${slideIndex + 1}`);
        dot.classList.toggle("slider-dots__dot--active", index === displayActive);
        dot.classList.toggle(
          "slider-dots__dot--near",
          maxDots === 5 && Math.abs(index - displayActive) === 1,
        );
        dot.setAttribute("aria-current", String(index === displayActive));
      });
    }

    function regroup() {
      // Сохраняем первую видимую карточку при изменении числа колонок.
      const firstCard = (swiper?.realIndex || 0) * groupSize;
      swiper?.destroy(true, true);
      groupSize = queries[2].matches ? 1 : queries[1].matches ? 2 : queries[0].matches ? 3 : 4;
      maxDots = queries[3].matches ? 3 : 5;
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
      const slideCount = Math.ceil(cards.length / groupSize);
      const dotCount = Math.min(maxDots, slideCount);
      for (let index = 0; index < dotCount; index += 1) {
        const item = document.createElement("li");
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "slider-dots__dot js-review-dot";
        // The first slide is the center item in Figma; neighboring items wrap like rewind.
        dot.addEventListener("click", () => swiper.slideTo(Number(dot.dataset.reviewSlide)));
        item.append(dot);
        dots.append(item);
      }
      swiper = new Swiper(root, {
        slidesPerView: queries[2].matches ? "auto" : 1,
        // Зазор совпадает с местом под тень в reviews.scss: соседний слайд её не перекрывает.
        spaceBetween: queries[2].matches ? 16 : 4,
        speed: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 600,
        initialSlide: Math.min(Math.floor(firstCard / groupSize), slideCount - 1),
        rewind: true,
        keyboard: { enabled: true, onlyInViewport: true },
        a11y: { enabled: true },
        on: { slideChange: updateDots },
      });
      updateDots();
    }

    previous.addEventListener("click", () => swiper.slidePrev());
    next.addEventListener("click", () => swiper.slideNext());
    queries.forEach((query) => query.addEventListener("change", regroup));
    regroup();
  }

  // Каждый компонент подключается отдельно и запускается после готовности DOM.
  document.addEventListener("DOMContentLoaded", initReviews, { once: true });
})();
