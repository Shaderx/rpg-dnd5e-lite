/**
 * D&D 5e Lite - Layout Module
 * Panel collapse/expand, positioning, and visibility.
 * Mirrors the RPG Companion's layout.js behaviour.
 */

import { extensionSettings } from '../core/state.js';
import { updateStripWidgets } from './desktop.js';
import { closeMobilePanel, openMobilePanel, applyMobileTabBar } from './mobile.js';

const LEFT_PANEL_SECTIONS = [
    'dnd-character-container',
    'dnd-v1-character-container',
    'dnd-v1-spellbook-container',
    'dnd-v1-companion-container',
    'dnd-sidekick-container',
    'dnd-v2-companion-container',
    'dnd-spellbook-container',
];

/**
 * Update the collapse toggle icon direction.
 */
export function updateCollapseToggleIcon() {
    const $panel = $('#dnd-panel');
    const $icon = $('#dnd-collapse-toggle').find('i');
    const isMobile = window.innerWidth <= 1000;

    if (isMobile) {
        const isLeft = $panel.hasClass('dnd-position-left');
        $icon.removeClass('fa-chevron-left fa-chevron-right');
        $icon.addClass(isLeft ? 'fa-chevron-left' : 'fa-chevron-right');
    } else {
        const isCollapsed = $panel.hasClass('dnd-collapsed');
        const isRight = $panel.hasClass('dnd-position-right');

        $icon.removeClass('fa-chevron-left fa-chevron-right');
        if (isCollapsed) {
            $icon.addClass(isRight ? 'fa-chevron-left' : 'fa-chevron-right');
        } else {
            $icon.addClass(isRight ? 'fa-chevron-right' : 'fa-chevron-left');
        }
    }

    updateLeftCollapseToggleIcon();
}

/**
 * Update the left panel collapse toggle icon direction.
 */
function updateLeftCollapseToggleIcon() {
    const $leftPanel = $('#dnd-panel-left');
    if ($leftPanel.length === 0 || $leftPanel.css('display') === 'none') return;

    const $icon = $('#dnd-collapse-toggle-left').find('i');
    const isCollapsed = $leftPanel.hasClass('dnd-collapsed');

    $icon.removeClass('fa-chevron-left fa-chevron-right');
    $icon.addClass(isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left');
}

/**
 * Setup collapse/expand toggle button.
 */
export function setupCollapseToggle() {
    const $toggle = $('#dnd-collapse-toggle');
    const $panel = $('#dnd-panel');

    $toggle.on('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isMobile = window.innerWidth <= 1000;
        if (isMobile) {
            if ($panel.hasClass('dnd-mobile-open')) {
                closeMobilePanel();
            } else {
                openMobilePanel();
            }
            updateCollapseToggleIcon();
            return;
        }

        const isCollapsed = $panel.hasClass('dnd-collapsed');
        if (isCollapsed) {
            $panel.removeClass('dnd-collapsed');
        } else {
            $panel.addClass('dnd-collapsed');
            updateStripWidgets();
        }

        updateCollapseToggleIcon();
    });

    updateCollapseToggleIcon();
}

/**
 * Setup collapse toggle for the left panel (both mode).
 */
export function setupLeftCollapseToggle() {
    const $toggle = $('#dnd-collapse-toggle-left');
    const $leftPanel = $('#dnd-panel-left');
    if ($toggle.length === 0) return;

    $toggle.off('click').on('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isCollapsed = $leftPanel.hasClass('dnd-collapsed');
        if (isCollapsed) {
            $leftPanel.removeClass('dnd-collapsed');
        } else {
            $leftPanel.addClass('dnd-collapsed');
        }

        updateLeftCollapseToggleIcon();
    });
}

/**
 * Apply panel position (left/right/both).
 */
export function applyPanelPosition() {
    const $panel = $('#dnd-panel');
    const $leftPanel = $('#dnd-panel-left');
    if ($panel.length === 0) return;

    const position = extensionSettings.panelPosition || 'right';

    if (position === 'both') {
        $panel.removeClass('dnd-position-left dnd-position-right').addClass('dnd-position-right');
        $leftPanel[0].style.display = '';
        routeSectionsToPanels();
    } else {
        $leftPanel[0].style.display = 'none';
        mergeSectionsToSingle();
        $panel.removeClass('dnd-position-left dnd-position-right');
        $panel.addClass(`dnd-position-${position}`);
    }

    applyMobileTabBar(position === 'both');
    updateCollapseToggleIcon();
}

/**
 * Move character-related sections into the left panel.
 */
export function routeSectionsToPanels() {
    const leftContent = document.getElementById('dnd-panel-content-left');
    if (!leftContent) return;

    for (const id of LEFT_PANEL_SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.parentElement !== leftContent) {
            leftContent.appendChild(el);
        }
    }
}

/**
 * Move all sections back into the main (single) panel.
 */
export function mergeSectionsToSingle() {
    const mainContent = document.getElementById('dnd-panel-content');
    if (!mainContent) return;

    const referenceEl = mainContent.querySelector('.dnd-collapsible:not([id])');

    for (const id of LEFT_PANEL_SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.parentElement !== mainContent) {
            if (referenceEl) {
                mainContent.insertBefore(el, referenceEl);
            } else {
                mainContent.appendChild(el);
            }
        }
    }
}

/**
 * Update panel visibility based on enabled state.
 */
export function updatePanelVisibility() {
    const $panel = $('#dnd-panel');
    const $leftPanel = $('#dnd-panel-left');
    const $fab = $('#dnd-mobile-toggle');

    if (extensionSettings.enabled) {
        $panel.show();
        $fab.css('display', '');
        $('#dnd-collapse-toggle').show();
        if (extensionSettings.panelPosition === 'both') {
            $leftPanel[0].style.display = '';
        }
    } else {
        $panel.hide();
        $leftPanel[0].style.display = 'none';
        $fab.css('display', 'none');
        $('#dnd-collapse-toggle').hide();
    }
}

/**
 * Update the strip widget class on the panel.
 */
export function updateStripWidgetClass() {
    const $panel = $('#dnd-panel');
    if (extensionSettings.stripWidgetsEnabled) {
        $panel.addClass('dnd-strip-widgets-enabled');
    } else {
        $panel.removeClass('dnd-strip-widgets-enabled');
    }
}
