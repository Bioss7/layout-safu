(() => {
  const root = document.querySelector(".js-reviews");
  if (!root || root.dataset.initialized) return;
  const viewport = root.querySelector(".js-reviews-viewport");
  const cards = [...root.querySelectorAll(".js-review-card")];
  const dots = [...root.querySelectorAll(".js-review-dot")];
  const previous = root.querySelector(".js-reviews-prev");
  const next = root.querySelector(".js-reviews-next");
  const status = root.querySelector(".js-reviews-status");
  const quote = root.closest(".hero__visual")?.querySelector(".js-hero-quote-text");
  if (!viewport || cards.length < 2 || !previous || !next) return;
  root.dataset.initialized = "true";
  let active = Math.max(
    0,
    cards.findIndex((card) => card.classList.contains("speaker-card--active")),
  );
  let pointer = null;
  let suppressClickUntil = 0;

  dots.forEach((dot, index) => {
    const name = cards[index]?.querySelector(".speaker-card__name")?.textContent;
    if (name) dot.setAttribute("aria-label", "Показать: " + name.trim());
  });

  function show(index) {
    active = (index + cards.length) % cards.length;
    const previousIndex = (active + cards.length - 1) % cards.length;
    const nextIndex = (active + 1) % cards.length;
    cards.forEach((card, position) => {
      const visible = [active, previousIndex, nextIndex].includes(position);
      card.hidden = !visible;
      card.classList.toggle("speaker-card--inactive", !visible);
      card.classList.toggle("speaker-card--active", position === active);
      card.classList.toggle("speaker-card--previous", position === previousIndex);
      card.classList.toggle("speaker-card--next", position === nextIndex);
      card.setAttribute("aria-hidden", String(position !== active));
    });
    dots.forEach((dot, position) => {
      dot.classList.toggle("slider-dots__dot--active", position === active);
      dot.setAttribute("aria-current", String(position === active));
    });
    const current = cards[active];
    const currentQuote = current.dataset.quote || "";
    if (quote) {
      const desktop = document.createElement("span");
      desktop.className = "desktop-copy";
      desktop.textContent = currentQuote;
      const mobile = document.createElement("span");
      mobile.className = "mobile-copy hero__quote-mobile";
      mobile.textContent = current.dataset.quoteMobile || currentQuote;
      quote.replaceChildren(desktop, mobile);
    }
    if (status) {
      const name = current.querySelector(".speaker-card__name").textContent;
      const description = current.querySelector(".speaker-card__description").innerText;
      status.textContent =
        name +
        ". " +
        description.replace(/\s+/g, " ") +
        ". " +
        currentQuote +
        " Слайд " +
        (active + 1) +
        " из " +
        cards.length;
    }
  }

  previous.addEventListener("click", () => show(active - 1));
  next.addEventListener("click", () => show(active + 1));
  dots.forEach((dot, index) => dot.addEventListener("click", () => show(index)));
  root.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    show(active + (event.key === "ArrowRight" ? 1 : -1));
  });

  viewport.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointerup", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer = null;
    if (viewport.hasPointerCapture(event.pointerId))
      viewport.releasePointerCapture(event.pointerId);
    // Вертикальное движение остаётся прокруткой страницы; короткий жест не меняет слайд.
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    show(active + (dx < 0 ? 1 : -1));
    suppressClickUntil = performance.now() + 400;
  });
  viewport.addEventListener("pointercancel", () => {
    pointer = null;
  });
  viewport.addEventListener("lostpointercapture", () => {
    pointer = null;
  });
  viewport.addEventListener(
    "click",
    (event) => {
      if (performance.now() >= suppressClickUntil) return;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
  viewport.addEventListener("dragstart", (event) => event.preventDefault());
  show(active);
})();
