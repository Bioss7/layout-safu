document.addEventListener('DOMContentLoaded', () => {
    const tabsBlock = document.querySelector('.life-tabs');

    if (!tabsBlock) return;

    const section = tabsBlock.closest('section');
    const tabs = Array.from(tabsBlock.querySelectorAll('.life-tabs__tab[data-life-tab]'));
    const panels = section ? Array.from(section.querySelectorAll('.life-panel[data-life-panel]')) : [];
    const allLinkText = section?.querySelector('[data-life-all-text]');

    if (!tabs.length || !panels.length) return;

    function activate(key, { focus = false } = {}) {
        if (!key) return;

        let activeTab = null;

        tabs.forEach((tab) => {
            const isActive = tab.dataset.lifeTab === key;

            tab.classList.toggle('life-tabs__tab--active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
            tab.setAttribute('tabindex', isActive ? '0' : '-1');

            if (isActive) {
                activeTab = tab;

                if (focus) tab.focus();
            }
        });

        panels.forEach((panel) => {
            const isActive = panel.dataset.lifePanel === key;

            panel.classList.toggle('life-panel--active', isActive);
            panel.setAttribute('aria-hidden', String(!isActive));
        });

        const allLabel = activeTab?.dataset.lifeAll;

        if (allLinkText && allLabel) allLinkText.textContent = allLabel;
    }

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => activate(tab.dataset.lifeTab));

        tab.addEventListener('keydown', (event) => {
            let nextIndex = null;

            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                nextIndex = (index + 1) % tabs.length;
            }

            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                nextIndex = (index - 1 + tabs.length) % tabs.length;
            }

            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = tabs.length - 1;
            if (nextIndex === null) return;

            event.preventDefault();
            activate(tabs[nextIndex].dataset.lifeTab, { focus: true });
        });
    });

    const initialTab =
        tabs.find((tab) => tab.classList.contains('life-tabs__tab--active')) || tabs[0];

    activate(initialTab.dataset.lifeTab);
});
