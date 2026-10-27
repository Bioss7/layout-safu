(() => {
  function initQuestionForm() {
    const form = document.querySelector(".js-question-form");
    if (!form) return;
    const fields = [...form.querySelectorAll(".js-field-input")];
    const topicTrigger = form.querySelector(".js-topic-trigger");
    const status = form.querySelector(".js-form-status");

    function validate(field) {
      if (field.disabled || field.readOnly) return true;
      let message = "";
      if (!field.value.trim()) message = "Заполните это поле.";
      else if (field.type === "email" && field.validity.typeMismatch)
        message = "Укажите корректный адрес электронной почты.";

      const wrapper = field.closest(".js-field");
      wrapper.classList.toggle("form-field--error", Boolean(message));
      field.setAttribute("aria-invalid", String(Boolean(message)));
      if (field.name === "topic")
        topicTrigger.setAttribute("aria-invalid", String(Boolean(message)));
      wrapper.querySelector(".form-field__error").textContent = message;
      return !message;
    }

    fields.forEach((field) => {
      const updateFilled = () =>
        field
          .closest(".js-field")
          .classList.toggle("form-field--filled", Boolean(field.value.trim()));
      updateFilled();
      field.addEventListener("input", updateFilled);
      field.addEventListener("change", updateFilled);
      field.addEventListener("blur", () => validate(field));
      field.addEventListener("change", () => validate(field));
      field.addEventListener("input", () => {
        status.hidden = true;
        if (field.getAttribute("aria-invalid") === "true") validate(field);
      });
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const invalid = fields.filter((field) => !validate(field));
      if (invalid.length) {
        const first = invalid[0];
        (first.name === "topic" ? topicTrigger : first).focus();
        status.hidden = true;
        return;
      }
      // Статическая форма: подключение отправки выполняется при интеграции с Битрикс.
      status.textContent =
        "Сообщение не отправлено: форма пока не подключена. Напишите на abiturient@narfu.ru.";
      status.hidden = false;
    });
  }

  // Каждый компонент подключается отдельно и запускается после готовности DOM.
  document.addEventListener("DOMContentLoaded", initQuestionForm, { once: true });
})();
