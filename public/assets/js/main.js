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

document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('.js-footer-toggle');
    const details = document.querySelector('.js-footer-details');

    if (toggle && details) {
        toggle.addEventListener('click', () => {
            const isOpen = toggle.getAttribute('aria-expanded') === 'true';

            if (isOpen) {
                details.classList.remove('is-open');
                toggle.setAttribute('aria-expanded', 'false');

                const onClose = () => {
                    details.hidden = true;
                    details.removeEventListener('transitionend', onClose);
                };
                details.addEventListener('transitionend', onClose, { once: true });
            } else {
                details.hidden = false;
                requestAnimationFrame(() => {
                    details.classList.add('is-open');
                });
                toggle.setAttribute('aria-expanded', 'true');
            }
        });
    }

    // Круг
    const progress = document.querySelector('.pulse-circle__progress');
    const dots = document.querySelectorAll('.pulse-circle__dot[data-tab]');
    const cards = document.querySelectorAll('.pulse-card[data-tab]');
    const tabs = document.querySelectorAll('.pulse-panel__tab[data-tab-content]');

    if (!progress || !dots.length || !tabs.length) return;

    const TARGETS = {
        education: { progress: 16, angle: 27 },
        science: { progress: 34, angle: 27 },
        university: { progress: 50, angle: 27 },
        life: { progress: 66, angle: 27 },
        international: { progress: 82, angle: 28 },
        safu: { progress: 100, angle: 28 },
    };

    const DURATION = 800;
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    let currentProgress = 0;
    let currentAngle = 27;
    let rafId = null;

    function animateCircle(toProgress, toAngle, duration = DURATION) {
        if (rafId !== null) cancelAnimationFrame(rafId);

        const fromProgress = currentProgress;
        const fromAngle = currentAngle;
        const start = performance.now();

        function frame(now) {
            const t = Math.min((now - start) / duration, 1);
            const eased = easeOutCubic(t);

            const p = fromProgress + (toProgress - fromProgress) * eased;
            const a = fromAngle + (toAngle - fromAngle) * eased;

            progress.style.setProperty('--progress', p + '%');
            progress.style.setProperty('--from-angle', a + 'deg');

            currentProgress = p;
            currentAngle = a;

            rafId = t < 1 ? requestAnimationFrame(frame) : null;
        }
        rafId = requestAnimationFrame(frame);
    }

    let activeTabKey = null;

    function switchTab(key) {
        if (key === activeTabKey) return;

        tabs.forEach((tab) => {
            tab.classList.toggle('is-active', tab.dataset.tabContent === key);
        });

        activeTabKey = key;
    }

    function activate(key) {
        if (!TARGETS[key]) return;

        // точки
        dots.forEach((d) => {
            d.classList.toggle('pulse-circle__dot--active', d.dataset.tab === key);
        });

        // карточки
        cards.forEach((c) => {
            c.classList.toggle('is-active', c.dataset.tab === key);
        });

        // круг
        const t = TARGETS[key];
        animateCircle(t.progress, t.angle);

        // панель
        switchTab(key);
    }

    dots.forEach((dot) => {
        dot.addEventListener('click', (e) => {
            e.preventDefault();
            activate(dot.dataset.tab);
        });
    });

    cards.forEach((card) => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            activate(card.dataset.tab);
        });
    });

    currentProgress = 0;
    currentAngle = 27;
    activate('education');
});