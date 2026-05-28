/**
 * D&D 5e Lite - Spellbook Renderer
 * Compact spell list with rich tooltips on hover and click-to-copy.
 */

import { spellbook } from '../core/state.js';
import { getSpellDetail, formatLevel, shortLevel, schoolName, buildTooltipContent, parseSpellHash } from '../features/spellbook.js';

let activeTooltip = null;

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function levelBadgeClass(level) {
    if (level === 0) return 'dnd-spell-level-cantrip';
    if (level <= 3) return 'dnd-spell-level-low';
    if (level <= 6) return 'dnd-spell-level-mid';
    return 'dnd-spell-level-high';
}

/**
 * Render the spellbook list inside #dnd-spellbook-list.
 */
export function renderSpellbook() {
    const container = document.getElementById('dnd-spellbook-list');
    const titleEl = document.getElementById('dnd-spellbook-title');
    if (!container) return;

    if (!spellbook?.items?.length) {
        container.innerHTML = '<div class="dnd-empty-state">No spellbook loaded</div>';
        if (titleEl) titleEl.textContent = 'Spellbook';
        return;
    }

    if (titleEl) titleEl.textContent = spellbook.name || 'Spellbook';

    const spells = spellbook.items.map(item => {
        const detail = getSpellDetail(item.h);
        return { hash: item.h, detail };
    });

    spells.sort((a, b) => {
        const la = a.detail.level ?? 99;
        const lb = b.detail.level ?? 99;
        if (la !== lb) return la - lb;
        return (a.detail.name || '').localeCompare(b.detail.name || '');
    });

    let html = '';
    for (const { hash, detail } of spells) {
        const name = detail.name || parseSpellHash(hash).name;
        const level = detail.level ?? null;
        const school = detail.school ? schoolName(detail.school) : '';
        const lvlChar = level !== null ? shortLevel(level) : '?';
        const badgeClass = level !== null ? levelBadgeClass(level) : 'dnd-spell-level-unknown';

        html += `<div class="dnd-spellbook-item" data-hash="${escapeHtml(hash)}">` +
            `<span class="dnd-spellbook-lvl ${badgeClass}">${lvlChar}</span>` +
            `<span class="dnd-spellbook-name">${escapeHtml(name)}</span>` +
            (school ? `<span class="dnd-spellbook-school">${escapeHtml(school)}</span>` : '') +
            `</div>`;
    }

    container.innerHTML = html;
    bindSpellbookEvents(container);
}

function bindSpellbookEvents(container) {
    container.querySelectorAll('.dnd-spellbook-item').forEach(el => {
        el.addEventListener('mouseenter', (e) => {
            const hash = el.dataset.hash;
            const detail = getSpellDetail(hash);
            showSpellTooltip(el, detail);
        });

        el.addEventListener('mouseleave', () => {
            hideSpellTooltip();
        });

        el.addEventListener('click', () => {
            const hash = el.dataset.hash;
            const detail = getSpellDetail(hash);
            const name = detail.name || parseSpellHash(hash).name;
            const level = detail.level !== undefined ? formatLevel(detail.level) : '?';
            const text = `[${name}, ${level}]`;
            navigator.clipboard.writeText(text).then(() => {
                if (typeof toastr !== 'undefined') {
                    toastr.success(`Copied: ${text}`, '', { timeOut: 1500 });
                }
            }).catch(() => {
                if (typeof toastr !== 'undefined') {
                    toastr.warning('Failed to copy to clipboard');
                }
            });
        });
    });
}

function showSpellTooltip(anchorEl, spellData) {
    hideSpellTooltip();

    const tip = document.createElement('div');
    tip.className = 'dnd-spell-tooltip';
    tip.innerHTML = buildTooltipContent(spellData);
    document.body.appendChild(tip);
    activeTooltip = tip;

    const rect = anchorEl.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();

    let left = rect.left - tipRect.width - 8;
    if (left < 8) {
        left = rect.right + 8;
    }

    let top = rect.top;
    if (top + tipRect.height > window.innerHeight - 8) {
        top = window.innerHeight - tipRect.height - 8;
    }
    if (top < 8) top = 8;

    const maxH = window.innerHeight - top - 8;
    if (tipRect.height > maxH) {
        tip.style.maxHeight = `${maxH}px`;
        tip.style.overflow = 'hidden';
    }

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.style.opacity = '1';
}

export function hideSpellTooltip() {
    if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
    }
}
