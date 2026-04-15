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
