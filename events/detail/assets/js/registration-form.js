(() => {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      const root = document.querySelector(".js-contact-form");
      if (!root || root.dataset.initialized) return;
      root.dataset.initialized = "true";
      const form = root.querySelector(".js-registration-form");
      const fields = [...form.querySelectorAll(".js-field-input, .js-consent")];
      const submit = root.querySelector(".js-submit");
      const label = root.querySelector(".js-submit-label");
      const hint = root.querySelector(".js-hint-text");
      const result = root.querySelector(".js-form-result");
      const resultIcon = root.querySelector(".js-result-icon");
      const successImage = resultIcon.src;
      const errorImage = new URL("result-error.png", successImage).href;
      let pending = false;
      let requestId = 0;
      const focusField = (field) => field.focus();
      function validate(field) {
        const value = field.value.trim();
        let message = "";
        if (
          (field.required || field.dataset.required) &&
          (field.type === "checkbox" ? !field.checked : !value)
        )
          message =
            field.type === "checkbox"
              ? "Необходимо согласие на обработку данных"
              : "Заполните обязательное поле";
        else if (
          ["surname", "name", "patronymic"].includes(field.name) &&
          value &&
          !/^[\p{L}\p{M} '\-’]+$/u.test(value)
        )
          message = "Некорректные символы";
        else if (field.type === "email" && field.validity.typeMismatch)
          message = "Укажите корректную эл. почту";
        else if (
          field.type === "tel" &&
          (value.replace(/\D/g, "").length < 10 || value.replace(/\D/g, "").length > 15)
        )
          message = "Укажите корректный телефон";
        field.setAttribute("aria-invalid", String(Boolean(message)));
        const wrapper = field.closest(".js-field");
        wrapper?.classList.toggle("form-field--invalid", Boolean(message));
        const clear = wrapper?.querySelector(".js-field-clear");
        if (clear) clear.hidden = Boolean(message) || !value;
        document.getElementById(`error-${field.name}`).textContent = message;
        return !message;
      }
      fields.forEach((field) => {
        field.addEventListener("blur", () => {
          if (field.value || field.required) validate(field);
        });
        ["input", "change"].forEach((name) =>
          field.addEventListener(name, () => {
            const clear = field.closest(".js-field")?.querySelector(".js-field-clear");
            if (clear) clear.hidden = !field.value;
            if (field.getAttribute("aria-invalid") === "true") validate(field);
          }),
        );
      });
      form.querySelectorAll(".js-field-clear").forEach((button) =>
        button.addEventListener("click", () => {
          const field = button.closest(".js-field").querySelector(".js-field-input");
          field.value = "";
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.focus();
        }),
      );
      function busy(value) {
        pending = value;
        root.classList.toggle("contact-form--pending", value);
        root.querySelector(".contact-form__required").hidden = value;

        form.setAttribute("aria-busy", String(value));
        submit.disabled = value;
        label.textContent = value ? "Отправляем" : "Зарегистрироваться";
        root.querySelector(".contact-form__spinner").hidden = !value;
        root.querySelector(".contact-form__promise-icon").hidden = value;
        root
          .querySelector(".contact-form__hint")
          .classList.toggle("contact-form__hint--pending", value);
        if (value) hint.textContent = "Пожалуйста, не закрывайте страницу";
        else {
          const lineBreak = document.createElement("br");
          lineBreak.className = "contact-form__hint-break";
          hint.replaceChildren("Гарантируем обратную связь ", lineBreak, "в течение 24 часов");
        }
        fields.forEach((field) => {
          field.disabled = value;
        });
        form.querySelectorAll(".js-field-clear").forEach((button) => {
          button.disabled = value;
        });
      }
      async function send() {
        if (pending) return;
        const currentRequest = ++requestId;
        busy(true);
        // Имитация асинхронного ответа: запросов, хранилищ и сохранения персональных данных нет.
        await new Promise((resolve) => setTimeout(resolve, 1200));
        if (currentRequest !== requestId) return;
        const failed =
          new URLSearchParams(location.search).get("form-demo") === "error" &&
          root.dataset.demoResult !== "retry";
        busy(false);
        showResult(failed);
      }
      function showResult(failed) {
        root.classList.add("contact-form--result");
        root.classList.toggle("contact-form--error", failed);
        form.hidden = true;
        result.hidden = false;
        resultIcon.src = failed ? errorImage : successImage;
        root.querySelector(".js-result-title").textContent = failed
          ? "Не удалось отправить заявку"
          : "Спасибо за заявку!";
        root
          .querySelector(".js-result-title")
          .classList.toggle("contact-form__result-title--error", failed);
        root.querySelector(".js-result-text").textContent = failed
          ? "Произошла техническая ошибка. Данные остались в полях формы, попробуйте отправить заявку ещё раз."
          : "Мы получили вашу заявку и свяжемся с вами по электронной почте или телефону в течение одного рабочего дня.";
        root.querySelector(".js-form-again-label").textContent = failed
          ? "Повторить отправку"
          : "Оставить ещё заявку";
        result.focus({ preventScroll: true });
      }
      // Тестовое меню использует те же поля и состояния, что и обычная отправка.
      root.addEventListener("event-detail:demo-form", (event) => {
        ++requestId;
        busy(false);
        form.reset();
        root.classList.remove("contact-form--error", "contact-form--result");
        root.dataset.demoResult = "success";
        fields.forEach((field) => field.removeAttribute("aria-invalid"));
        root
          .querySelectorAll(".form-field--invalid")
          .forEach((field) => field.classList.remove("form-field--invalid"));
        form.querySelectorAll(".form-field__error").forEach((error) => {
          error.textContent = "";
        });
        form.querySelectorAll(".js-field-clear").forEach((button) => {
          button.hidden = true;
        });
        form.hidden = false;
        result.hidden = true;
        const state = event.detail.state;
        if (state !== "default") {
          const values = {
            surname: "Иванов",
            name: "Сергей",
            patronymic: "Юрьевич",
            phone: "+7 (952) 125-15-48",
            email: "test@example.org",
          };
          for (const [name, value] of Object.entries(values)) {
            form.elements[name].value = value;
            form.elements[name].dispatchEvent(new Event("input", { bubbles: true }));
          }
          form.elements.consent.checked = true;
        }
        if (state === "invalid") {
          form.elements.surname.value = "Иванов 545";
          form.elements.email.value = "неверная почта";
          fields.forEach(validate);
        }
        if (state === "pending") busy(true);
        if (state === "success" || state === "error") showResult(state === "error");
        root.scrollIntoView({ block: "center", behavior: "instant" });
      });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (pending) return;
        const invalid = fields.filter((field) => !validate(field));
        if (invalid.length) {
          focusField(invalid[0]);
          return;
        }
        send();
      });
      root.querySelector(".js-form-again").addEventListener("click", () => {
        if (root.classList.contains("contact-form--error")) {
          root.dataset.demoResult = "retry";
          root.classList.remove("contact-form--result");
          result.hidden = true;
          form.hidden = false;
          send();
          return;
        }
        form.reset();
        fields.forEach((field) => {
          field.removeAttribute("aria-invalid");
          field.closest(".js-field")?.classList.remove("form-field--invalid");
        });
        form.querySelectorAll(".form-field__error").forEach((error) => {
          error.textContent = "";
        });
        form.querySelectorAll(".js-field-clear").forEach((button) => {
          button.hidden = true;
        });
        result.hidden = true;
        form.hidden = false;
        root.classList.remove("contact-form--result");
        form.elements.surname.focus();
      });
    },
    { once: true },
  );
})();
