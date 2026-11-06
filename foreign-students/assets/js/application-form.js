(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const root = document.querySelector(".js-contact-form");
    if (!root) return;
    const form = root.querySelector(".js-question-form");
    const fields = [...form.querySelectorAll(".js-field-input")];
    const submit = root.querySelector(".js-submit");
    const result = root.querySelector(".js-form-result");
    const menu = root.querySelector(".js-demo-menu");
    let pending = false;
    let requestId = 0;
    let failed = false;

    function validate(field) {
      const value = field.value.trim();
      let message = "";
      if (!value) message = "Заполните обязательное поле";
      else if (field.name === "name" && !/^[\p{L}\p{M} '\-’]+$/u.test(value))
        message = "Имя содержит запрещённые символы";
      else if (field.type === "email" && field.validity.typeMismatch)
        message = "Укажите корректную электронную почту";
      field.setAttribute("aria-invalid", String(Boolean(message)));
      field.closest(".js-field").classList.toggle("form-field--invalid", Boolean(message));
      document.getElementById(field.getAttribute("aria-describedby")).textContent = message;
      return !message;
    }
    function busy(value) {
      pending = value;
      form.setAttribute("aria-busy", String(value));
      submit.disabled = value;
      submit.textContent = value ? "Отправляем…" : "Отправить";
      fields.forEach((field) => { field.disabled = value; });
      form.querySelectorAll(".js-field-clear").forEach((button) => { button.disabled = value; });
    }
    function reset() {
      ++requestId;
      busy(false);
      form.hidden = false;
      result.hidden = true;
      fields.forEach((field) => {
        field.removeAttribute("aria-invalid");
        field.closest(".js-field").classList.remove("form-field--invalid");
        document.getElementById(field.getAttribute("aria-describedby")).textContent = "";
      });
    }
    function showResult(error) {
      failed = error;
      busy(false);
      form.hidden = true;
      result.hidden = false;
      root.querySelector(".js-result-title").textContent = error ? "Ошибка отправки — демо" : "Заявка заполнена — демо";
      root.querySelector(".js-result-text").textContent = error
        ? "Это демонстрация ошибки. Данные остались в полях формы. Сетевой запрос не выполнялся."
        : "Демонстрация завершена. Данные не отправлялись и не сохранялись. Для реального обращения используйте контакты международного офиса.";
      root.querySelector(".js-form-again").textContent = error ? "Повторить" : "Заполнить ещё раз";
      result.focus({ preventScroll: true });
    }
    async function send() {
      if (pending) return;
      const current = ++requestId;
      busy(true);
      // Только демонстрация состояний: без fetch, хранилищ и сохранения введённых данных.
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (current !== requestId) return;
      showResult(false);
    }
    fields.forEach((field) => {
      field.addEventListener("blur", () => validate(field));
      field.addEventListener("input", () => {
        const clear = field.closest(".js-field").querySelector(".js-field-clear");
        clear.hidden = !field.value;
        if (field.getAttribute("aria-invalid") === "true") validate(field);
      });
    });
    form.querySelectorAll(".js-field-clear").forEach((button) => {
      button.addEventListener("click", () => {
        const field = button.closest(".js-field").querySelector(".js-field-input");
        field.value = "";
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.focus();
      });
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (pending) return;
      const invalid = fields.filter((field) => !validate(field));
      if (invalid.length) { invalid[0].focus(); return; }
      send();
    });
    root.querySelector(".js-form-again").addEventListener("click", () => {
      const retry = failed;
      reset();
      if (retry) send();
      else { form.reset(); fields.forEach((field) => field.dispatchEvent(new Event("input"))); fields[0].focus(); }
    });
    menu.querySelectorAll(".js-demo-state").forEach((button) => {
      button.addEventListener("click", () => {
        reset();
        const state = button.dataset.state;
        fields[0].value = state === "default" ? "" : "Николай Иванов";
        fields[1].value = state === "default" ? "" : "student@example.org";
        fields.forEach((field) => field.dispatchEvent(new Event("input")));
        if (state === "invalid") { fields[0].value = "Имя 123"; fields[1].value = "неверная почта"; fields.forEach(validate); }
        if (state === "pending") busy(true);
        if (state === "success" || state === "error") showResult(state === "error");
        if (state === "retry") send();
        menu.querySelectorAll(".js-demo-state").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      });
    });
  }, { once: true });
})();
