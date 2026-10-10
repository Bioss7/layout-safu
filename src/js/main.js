document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('[data-footer-toggle]');
    const details = document.querySelector('[data-footer-details]');
    toggle?.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(expanded));
        details.hidden = !expanded;
        details.classList.toggle('footer__details--open', expanded);
    });

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
            tab.classList.toggle('pulse-panel__tab--active', tab.dataset.tabContent === key);
            tab.setAttribute('aria-hidden', String(tab.dataset.tabContent !== key));
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
            c.classList.toggle('pulse-card--active', c.dataset.tab === key);
            c.setAttribute('aria-pressed', String(c.dataset.tab === key));
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

// 
document.addEventListener('DOMContentLoaded', () => {
    const points = document.querySelectorAll('.history-timeline__point');
    const cards = document.querySelectorAll('[data-history-card]');

    // SVG для обычной точки
    const dotDefault = `
        <svg class="history-timeline__dot" width="15" height="15" viewBox="0 0 15 15" fill="none"
             xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="7.5" cy="7.5" r="6.5" fill="#CCEFFC" stroke="#0B2D4E" stroke-width="2" />
        </svg>`;

    // SVG для активной точки — полностью заменяет предыдущую
    const dotActive = `
    <svg class="history-timeline__dot history-timeline__dot--active" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#0B2D4E" fill-opacity="0.1" />
        <circle cx="16" cy="16" r="12" fill="#0B2D4E" fill-opacity="0.5" />
        <circle cx="16" cy="16" r="7" fill="#0B2D4E" stroke="#0B2D4E" stroke-width="2" />
    </svg>
    `;

    function setActive(activePoint) {
        const target = activePoint.dataset.target;
        if (!target) return;

        // Сбрасываем все точки
        points.forEach(point => {
            const dot = point.querySelector('.history-timeline__dot');
            const yearEl = point.querySelector('.history-timeline__year');

            point.classList.remove('history-timeline__point--active');
            point.setAttribute('aria-selected', 'false');

            // Полностью заменяем SVG на обычный
            if (dot) dot.outerHTML = dotDefault;
            if (yearEl) yearEl.classList.remove('history-timeline__year--active');
        });

        // Активируем выбранную точку
        activePoint.classList.add('history-timeline__point--active');
        activePoint.setAttribute('aria-selected', 'true');

        // Полностью заменяем SVG на активный
        const activeDot = activePoint.querySelector('.history-timeline__dot');
        if (activeDot) activeDot.outerHTML = dotActive;

        const activeYear = activePoint.querySelector('.history-timeline__year');
        if (activeYear) activeYear.classList.add('history-timeline__year--active');

        // Переключаем карточки
        cards.forEach(card => {
            card.classList.toggle('history-card--active', card.dataset.historyCard === target);
        });
    }

    points.forEach(point => {
        point.setAttribute('tabindex', '0');
        point.addEventListener('click', () => setActive(point));
        point.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActive(point);
            }
        });
    });
});