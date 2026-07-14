/**
 * D&D 5e Lite - Mobile UI
 * FAB toggle and mobile panel drawer behavior.
 * Mirrors the RPG Companion mobile pattern.
 */

/**
 * Close mobile panel with animation.
 */
export function closeMobilePanel() {
    const $panel = $('#dnd-panel');
    const $toggle = $('#dnd-mobile-toggle');

    $panel.removeClass('dnd-mobile-open');
    $toggle.removeClass('active');
    $('.dnd-mobile-overlay').remove();
}

/**
 * Open mobile panel with overlay.
 */
export function openMobilePanel() {
    const $panel = $('#dnd-panel');
    const $toggle = $('#dnd-mobile-toggle');

    $panel.addClass('dnd-mobile-open');
    $toggle.addClass('active');

    const $overlay = $('<div class="dnd-mobile-overlay"></div>');
    $('body').append($overlay);
    $overlay.on('click', () => closeMobilePanel());
}

/**
 * Setup the mobile FAB button.
 */
export function setupMobileFab() {
    const $fab = $('#dnd-mobile-toggle');
    if ($fab.length === 0) return;

    $fab.on('click', () => {
        const $panel = $('#dnd-panel');
        if ($panel.hasClass('dnd-mobile-open')) {
            closeMobilePanel();
        } else {
            openMobilePanel();
        }
    });
}

/**
 * Apply or remove the mobile tab bar for dual-panel (both) mode.
 * On mobile, the left panel is hidden via CSS — the tab bar lets
 * the user switch between game content and character content within
 * the single slide-in drawer.
 */
export function applyMobileTabBar(isBothMode) {
    const gameContainer = document.querySelector('#dnd-panel .dnd-game-container');
    if (!gameContainer) return;

    const existing = gameContainer.querySelector('.dnd-mobile-tab-bar');

    if (!isBothMode) {
        if (existing) existing.remove();
        const pc = document.getElementById('dnd-panel-content');
        if (pc) pc.style.display = '';
        const lc = document.getElementById('dnd-panel-content-left');
        if (lc) lc.style.display = 'none';
        return;
    }

    if (existing) return;

    const tabBar = document.createElement('div');
    tabBar.className = 'dnd-mobile-tab-bar';
    tabBar.innerHTML = `
        <button class="dnd-mobile-tab dnd-mobile-tab-active" data-tab="game">Game</button>
        <button class="dnd-mobile-tab" data-tab="character">Character</button>
    `;

    const header = gameContainer.querySelector('.dnd-panel-header');
    if (header && header.nextSibling) {
        gameContainer.insertBefore(tabBar, header.nextSibling);
    } else {
        gameContainer.appendChild(tabBar);
    }

    tabBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.dnd-mobile-tab');
        if (!btn) return;

        const tab = btn.dataset.tab;
        tabBar.querySelectorAll('.dnd-mobile-tab').forEach(b => b.classList.remove('dnd-mobile-tab-active'));
        btn.classList.add('dnd-mobile-tab-active');

        const panelContent = document.getElementById('dnd-panel-content');
        const leftContent = document.getElementById('dnd-panel-content-left');

        if (tab === 'character') {
            if (panelContent) panelContent.style.display = 'none';
            if (leftContent) {
                gameContainer.appendChild(leftContent);
                leftContent.style.display = '';
            }
        } else {
            if (leftContent) leftContent.style.display = 'none';
            if (panelContent) panelContent.style.display = '';
        }
    });
}
