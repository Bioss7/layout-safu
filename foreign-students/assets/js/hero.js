// Адаптация international/assets/js/hero.js: четыре настоящих баннера Figma.
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".js-hero").forEach((root) => {
    const element = root.querySelector(".js-hero-swiper");
    if (!element || element.swiper || typeof Swiper === "undefined") return;
    const pages = [...root.querySelectorAll(".js-hero-page")];
    const previous = root.querySelector(".js-hero-prev");
    const next = root.querySelector(".js-hero-next");
    const current = root.querySelector(".js-hero-current");
    const media = root.querySelector(".js-hero-media");
    const image = root.querySelector(".js-hero-image");
    const source = media.querySelector("source");
    function update(swiper) {
      const index = swiper.realIndex;
      pages.forEach((button, number) => {
        if (index === number) button.setAttribute("aria-current", "true");
        else button.removeAttribute("aria-current");
      });
      swiper.slides.forEach((slide, number) => {
        slide.inert = index !== number;
        slide.setAttribute("aria-hidden", String(index !== number));
      });
      current.textContent = String(index + 1).padStart(2, "0");
      const slide = swiper.slides[index];
      source.srcset = slide.dataset.imageMobile || slide.dataset.image;
      image.src = slide.dataset.image;
      image.alt = slide.dataset.imageAlt;
      media.dataset.slide = String(index);
      previous.disabled = swiper.isBeginning;
      next.disabled = swiper.isEnd;
    }
    const swiper = new Swiper(element, {
      autoHeight: true,
      effect: "fade",
      fadeEffect: { crossFade: true },
      speed: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450,
      loop: false,
      keyboard: { enabled: true, onlyInViewport: true },
      a11y: { enabled: true },
      on: { init: update, slideChange: update },
    });
    document.fonts.ready.then(() => swiper.updateAutoHeight(0));
    previous.addEventListener("click", () => swiper.slidePrev());
    next.addEventListener("click", () => swiper.slideNext());
    pages.forEach((button, index) => button.addEventListener("click", () => swiper.slideTo(index)));
  });
});
