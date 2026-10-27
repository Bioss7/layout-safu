(() => {
  function initInfoDialog() {
    const dialog = document.querySelector(".js-info-dialog");
    if (!dialog) return;
    const title = dialog.querySelector(".js-info-title");
    const body = dialog.querySelector(".js-info-body");
    let opener;

    function open(trigger, heading, text) {
      opener = trigger;
      title.textContent = heading;
      body.textContent = text;
      dialog.showModal();
      document.body.classList.add("no-scroll");
    }

    document.querySelectorAll(".js-info").forEach((trigger) => {
      trigger.addEventListener("click", () =>
        open(trigger, trigger.dataset.infoTitle, trigger.dataset.infoText),
      );
    });
    document.querySelectorAll(".js-review-read, .js-review-play").forEach((trigger) => {
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        const card = trigger.closest(".review-card");
        const isVideo = trigger.classList.contains("js-review-play");
        open(
          trigger,
          card.querySelector(".review-card__title").textContent,
          isVideo
            ? "Видео будет подключено при интеграции страницы."
            : card.querySelector(".review-card__text").textContent.replace(/\s+/g, " ").trim(),
        );
      });
    });
    document.querySelector(".js-review-all")?.addEventListener("click", (event) => {
      event.preventDefault();
      open(
        event.currentTarget,
        "Истории выпускников",
        "Раздел со всеми историями будет подключён при интеграции страницы.",
      );
    });
    dialog
      .querySelectorAll(".js-info-close")
      .forEach((button) => button.addEventListener("click", () => dialog.close()));
    dialog.addEventListener("click", (event) => {
      // Закрываем окно только по клику за его границами.
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    });
    dialog.addEventListener("close", () => {
      document.body.classList.remove("no-scroll");
      opener?.focus({ preventScroll: true });
    });
  }

  // Каждый компонент подключается отдельно и запускается после готовности DOM.
  document.addEventListener("DOMContentLoaded", initInfoDialog, { once: true });
})();
