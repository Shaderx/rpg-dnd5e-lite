/**
 * Shared spellbook level filter bar (C, 1–9) for collapsible module headers.
 */

export const SPELLBOOK_FILTER_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export function levelFilterLabel(level) {
    return level === 0 ? 'C' : String(level);
}

export function levelFilterBadgeClass(level) {
    if (level === 0) return 'dnd-spell-level-cantrip';
    if (level <= 3) return 'dnd-spell-level-low';
    if (level <= 6) return 'dnd-spell-level-mid';
    return 'dnd-spell-level-high';
}

export function levelFilterTitle(level) {
    if (level === 0) return 'Cantrips';
    const s = { 1: 'st', 2: 'nd', 3: 'rd' };
    return `${level}${s[level] || 'th'} level`;
}

/**
 * Render C–9 filter buttons into a header container.
 * @param {HTMLElement|null} container
 * @param {'all'|number} activeLevel - 'all' or 0–9
 * @param {(level: 'all'|number) => void} onSelect
 */
export function renderSpellbookLevelFilters(container, activeLevel, onSelect) {
    if (!container) return;

    let html = '';
    for (const lv of SPELLBOOK_FILTER_LEVELS) {
        const label = levelFilterLabel(lv);
        const badge = levelFilterBadgeClass(lv);
        const active = activeLevel === lv ? ' active' : '';
        html += `<button type="button" class="dnd-spellbook-lvl-filter ${badge}${active}" data-level="${lv}" title="${levelFilterTitle(lv)}">${label}</button>`;
    }
    container.innerHTML = html;

    container.querySelectorAll('.dnd-spellbook-lvl-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const n = parseInt(btn.dataset.level, 10);
            onSelect(activeLevel === n ? 'all' : n);
        });
    });
}

/** @param {'all'|number} filter @param {number} spellLevel */
export function matchesSpellbookLevelFilter(filter, spellLevel) {
    return filter === 'all' || spellLevel === filter;
}
