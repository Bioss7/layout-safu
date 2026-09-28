// modal
document.addEventListener("DOMContentLoaded", function () {
  const modalBtn = document.querySelectorAll("[data-modal]");
  const body = document.body;
  const modalClose = document.querySelectorAll(".modal__close");
  const modal = document.querySelectorAll(".modal");

  // Переменные для отслеживания свайпа
  let touchStartY = 0;
  let touchCurrentY = 0;
  let isSwiping = false;
  let currentModalElement = null;
  let isScrollingContent = false;

  modalBtn.forEach((item) => {
    item.addEventListener("click", (event) => {
      let $this = event.currentTarget;
      let modalId = $this.getAttribute("data-modal");
      let modalElement = document.getElementById(modalId);
      let modalContent = modalElement.querySelector(".modal__content");

      modalContent.addEventListener("click", (event) => {
        event.stopPropagation();
      });

      modalElement.classList.add("show");
      body.classList.add("no-scroll");

      // Анимация появления - модалка выезжает снизу
      setTimeout(() => {
        modalContent.style.transform = "translateY(0)";
        modalContent.style.opacity = "1";
      }, 10);

      // Сохраняем текущий модальный элемент для свайпа
      currentModalElement = modalElement;
    });
  });

  modalClose.forEach((item) => {
    item.addEventListener("click", (event) => {
      let currentModal = event.currentTarget.closest(".modal");
      closeModal(currentModal, true);
    });
  });

  modal.forEach((item) => {
    item.addEventListener("click", (event) => {
      let currentModal = event.currentTarget;
      closeModal(currentModal, false);
    });
  });

  // ---- Обработчики свайпа вниз ----
  function handleTouchStart(event) {
    const modalElement = event.currentTarget;
    if (!modalElement.classList.contains("show")) return;

    const touch = event.touches[0];
    touchStartY = touch.clientY;
    touchCurrentY = touchStartY;
    isSwiping = true;
    currentModalElement = modalElement;
    isScrollingContent = false;
  }

  function handleTouchMove(event) {
    if (!isSwiping || !currentModalElement) return;

    const touch = event.touches[0];
    touchCurrentY = touch.clientY;
    const deltaY = touchCurrentY - touchStartY;

    // Проверяем, находится ли скролл в контенте
    const dynamicContent = currentModalElement.querySelector(".modal__dynamic-content");
    const modalContent = currentModalElement.querySelector(".modal__content");

    if (dynamicContent) {
      const isAtTop = dynamicContent.scrollTop === 0;
      const isScrollingDown = deltaY > 0;

      // Если контент прокручен вниз и свайп вниз - не закрываем, даем скроллить
      if (!isAtTop && isScrollingDown) {
        isScrollingContent = true;
        return;
      }

      // Если контент вверху и свайп вниз - можно закрывать
      if (isAtTop && isScrollingDown) {
        isScrollingContent = false;
      }

      // Если свайп вверх - даем скроллить
      if (deltaY < 0) {
        isScrollingContent = true;
        return;
      }
    }

    // Если это свайп вниз для закрытия
    if (deltaY > 0 && !isScrollingContent) {
      const opacity = Math.max(0, 1 - deltaY / 400);
      modalContent.style.transform = `translateY(${deltaY}px)`;
      modalContent.style.opacity = opacity;
      modalContent.style.transition = "none";
      event.preventDefault();
    }
  }

  function handleTouchEnd(event) {
    if (!isSwiping || !currentModalElement) return;

    const deltaY = touchCurrentY - touchStartY;
    const modalContent = currentModalElement.querySelector(".modal__content");

    if (isScrollingContent) {
      isSwiping = false;
      currentModalElement = null;
      isScrollingContent = false;
      return;
    }

    if (deltaY > 80) {
      closeModal(currentModalElement, false); // Свайп - прокрутка будет
    } else if (deltaY > 0) {
      modalContent.style.transition = "transform 300ms ease, opacity 300ms ease";
      modalContent.style.transform = "translateY(0)";
      modalContent.style.opacity = "1";
    }

    isSwiping = false;
    currentModalElement = null;
    isScrollingContent = false;
  }

  modal.forEach((modalElement) => {
    modalElement.addEventListener("touchstart", handleTouchStart, { passive: true });
    modalElement.addEventListener("touchmove", handleTouchMove, { passive: false });
    modalElement.addEventListener("touchend", handleTouchEnd, { passive: true });
  });

  function closeModal(currentModal, isCloseButton = false) {
    if (!currentModal) return;

    let modalContent = currentModal.querySelector(".modal__content");
    let header = currentModal.querySelector(".modal__header");

    modalContent.style.transition = "transform 300ms ease, opacity 300ms ease";
    modalContent.style.transform = "translateY(100%)";
    modalContent.style.opacity = "0";

    setTimeout(() => {
      currentModal.classList.remove("show");
      body.classList.remove("no-scroll");

      modalContent.style.transform = "";
      modalContent.style.opacity = "";
      modalContent.style.transition = "";

      if (header) {
        header.classList.remove("with-back");
      }

      // Прокрутка к секции #top при закрытии модалки ТОЛЬКО если это НЕ крестик
      if (!isCloseButton) {
        const topSection = document.getElementById("top");
        if (topSection) {
          topSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      }
    }, 300);

    // Сбрасываем состояние свайпа
    isSwiping = false;
    currentModalElement = null;
    isScrollingContent = false;
  }

  // Закрытие модального окна по клавише Esc
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || event.keyCode === 27) {
      const openModal = document.querySelector(".modal.show");
      if (openModal) {
        closeModal(openModal, true);
      }
    }
  });
});