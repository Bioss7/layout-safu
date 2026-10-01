document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('.js-footer-toggle');
    const details = document.querySelector('.js-footer-details');

    if (!toggle || !details) return;

    toggle.addEventListener('click', () => {
        const isOpen = toggle.getAttribute('aria-expanded') === 'true';

        if (isOpen) {
            // Закрываем
            details.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');

            const onClose = () => {
                details.hidden = true;
                details.removeEventListener('transitionend', onClose);
            };
            details.addEventListener('transitionend', onClose, { once: true });
        } else {
            // Открываем
            details.hidden = false;
            requestAnimationFrame(() => {
                details.classList.add('is-open');
            });
            toggle.setAttribute('aria-expanded', 'true');
        }
    });
});

(function () {
    const circle = document.querySelector('.pulse-circle');
    if (!circle) return;

    const dots = circle.querySelectorAll('.pulse-circle__dot');

    dots.forEach((dot) => {
        dot.addEventListener('click', () => {
            dots.forEach((d) => d.classList.remove('pulse-circle__dot--active'));
            dot.classList.add('pulse-circle__dot--active');
        });
    });

    // по умолчанию активна первая
    if (dots.length && !circle.querySelector('.pulse-circle__dot--active')) {
        dots[0].classList.add('pulse-circle__dot--active');
    }
})();