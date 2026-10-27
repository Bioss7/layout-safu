// Общий раскрывающийся блок подвала.
document.addEventListener("DOMContentLoaded", () => {
  const footer = document.querySelector(".footer");
  if (!footer) return;
  const toggle = footer.querySelector(".js-footer-toggle");
  const details = footer.querySelector(".js-footer-details");
  if (!toggle || !details) return;

  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(expanded));
    details.hidden = !expanded;
    details.classList.toggle("footer__details--open", expanded);
  });
});
