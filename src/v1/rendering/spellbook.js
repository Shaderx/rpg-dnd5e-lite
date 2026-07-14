/**
 * V1 Character System - Spellbook Panel
 * Interactive spell list with hover tooltips, click-to-copy, and filter/search.
 */

import { characterV1 } from '../core/state.js';
import { lookupSpellSync } from '../features/spells.js';
import { computeCharacterStats } from '../features/character.js';
import { SPELL_SCHOOLS } from '../core/constants.js';
import { renderSpellbookLevelFilters, matchesSpellbookLevelFilter } from '../../rendering/spellbookLevelFilter.js';

let activeTooltip = null;
let levelFilter = 'all';

const SCHOOL_NAMES = { ...SPELL_SCHOOLS };

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shortLevel(level) { return level === 0 ? 'C' : String(level); }

function formatLevel(level) {
    if (level === 0) return 'Cantrip';
    const s = { 1: 'st', 2: 'nd', 3: 'rd' };
    return `${level}${s[level] || 'th'} Level`;
}

function levelBadgeClass(level) {
    if (level === 0) return 'dnd-spell-level-cantrip';
    if (level <= 3) return 'dnd-spell-level-low';
    if (level <= 6) return 'dnd-spell-level-mid';
    return 'dnd-spell-level-high';
}

function schoolName(code) { return SCHOOL_NAMES[code] || code; }

function stripTags(html) {
    if (!html) return '';
    return html.replace(/{@\w+ ([^}|]+)(?:\|[^}]*)?\}/g, '$1');
}

function flattenEntries(entries, depth = 0) {
    if (!Array.isArray(entries)) return '';
    const blocks = [];
    for (const e of entries) {
        if (typeof e === 'string') {
            blocks.push(stripTags(e));
        } else if (e?.entries) {
            let html = e.name ? `<strong>${esc(e.name)}.</strong> ` : '';
            html += flattenEntries(e.entries, depth + 1);
            blocks.push(html);
        } else if (e?.type === 'list' && Array.isArray(e.items)) {
            for (const item of e.items) {
                if (typeof item === 'string') blocks.push('\u2022 ' + stripTags(item));
                else if (item?.entries) {
                    let html = item.name ? `\u2022 <strong>${esc(item.name)}.</strong> ` : '\u2022 ';
                    html += flattenEntries(item.entries, depth + 1);
                    blocks.push(html);
                }
            }
        }
    }
    return blocks.join(' ').replace(/\s{2,}/g, ' ').trim();
}

function formatTime(timeArr) {
    if (!Array.isArray(timeArr) || !timeArr.length) return '—';
    const t = timeArr[0];
    return typeof t === 'string' ? t : `${t.number} ${t.unit}`;
}

function formatRange(range) {
    if (!range) return '—';
    if (range.type === 'point') {
        const d = range.distance;
        if (!d || d.type === 'self') return 'Self';
        if (d.type === 'touch') return 'Touch';
        if (d.type === 'sight') return 'Sight';
        if (d.type === 'unlimited') return 'Unlimited';
        return `${d.amount} ${d.type}`;
    }
    if (range.type === 'special') return 'Special';
    const d = range.distance;
    return d ? `Self (${d.amount}-${d.type} ${range.type})` : `Self (${range.type})`;
}

function formatComponents(comp) {
    if (!comp) return '—';
    const parts = [];
    if (comp.v) parts.push('V');
    if (comp.s) parts.push('S');
    if (comp.m) {
        const mText = typeof comp.m === 'object' ? comp.m.text : comp.m;
        parts.push(mText ? `M (${mText})` : 'M');
    }
    return parts.join(', ') || '—';
}

function formatDuration(durArr) {
    if (!Array.isArray(durArr) || !durArr.length) return '—';
    const d = durArr[0];
    if (d.type === 'instant') return 'Instantaneous';
    if (d.type === 'permanent') return 'Until dispelled';
    if (d.type === 'special') return 'Special';
    if (d.type === 'timed') {
        const conc = d.concentration ? 'Concentration, up to ' : '';
        return `${conc}${d.duration.amount} ${d.duration.type}${d.duration.amount > 1 ? 's' : ''}`;
    }
    return '—';
}

function buildTooltipContent(spell) {
    if (!spell) return '<div class="dnd-spell-tooltip-name">Unknown</div>';

    const ritualTag = spell.meta?.ritual ? ' (ritual)' : '';
    const levelSchool = spell.level === 0
        ? `${schoolName(spell.school)} cantrip${ritualTag}`
        : `${formatLevel(spell.level)} ${schoolName(spell.school)}${ritualTag}`;

    const desc = flattenEntries(spell.entries);
    let higherLevel = '';
    if (spell.entriesHigherLevel?.length) {
        higherLevel = `<div class="dnd-spell-tooltip-higher"><strong>At Higher Levels.</strong> ${flattenEntries(spell.entriesHigherLevel)}</div>`;
    }

    return `<div class="dnd-spell-tooltip-name">${esc(spell.name)}</div>
<div class="dnd-spell-tooltip-sub">${esc(levelSchool)}</div>
<div class="dnd-spell-tooltip-divider"></div>
<div class="dnd-spell-tooltip-field"><strong>Casting Time:</strong> ${esc(formatTime(spell.time))}</div>
<div class="dnd-spell-tooltip-field"><strong>Range:</strong> ${esc(formatRange(spell.range))}</div>
<div class="dnd-spell-tooltip-field"><strong>Components:</strong> ${esc(formatComponents(spell.components))}</div>
<div class="dnd-spell-tooltip-field"><strong>Duration:</strong> ${esc(formatDuration(spell.duration))}</div>
<div class="dnd-spell-tooltip-divider"></div>
<div class="dnd-spell-tooltip-desc">${desc}</div>${higherLevel}`;
}

/**
 * Gather all character spells (cantrips, known/prepared, extra, feat-granted).
 */
function gatherCharacterSpells() {
    if (!characterV1) return [];

    const spells = [];
    const char = characterV1;

    for (const name of (char.knownCantrips || [])) {
        spells.push({ name, level: 0, source: 'class' });
    }
    for (const name of (char.knownSpells || [])) {
        const spell = lookupSpellSync(name);
        spells.push({ name, level: spell?.level ?? 1, source: 'class' });
    }
    for (const entry of (char.extraSpells || [])) {
        const name = typeof entry === 'string' ? entry : entry.name;
        const spell = lookupSpellSync(name);
        const src = (typeof entry === 'object' && entry.source) ? `extra:${entry.source}` : 'extra';
        const freeCast = (typeof entry === 'object' && entry.freeCast) || '';
        spells.push({ name, level: spell?.level ?? 1, source: src, freeCast });
    }
    for (const name of (char.customSpells || [])) {
        const spell = lookupSpellSync(name);
        spells.push({ name, level: spell?.level ?? 0, source: 'custom' });
    }

    // Subclass spells (always prepared / bonus known)
    const stats = computeCharacterStats(char);
    if (stats?.subclassSpells?.length) {
        for (const name of stats.subclassSpells) {
            if (!spells.some(s => s.name === name)) {
                const spell = lookupSpellSync(name);
                spells.push({ name, level: spell?.level ?? 1, source: 'subclass' });
            }
        }
    }

    // Feat-granted spells
    if (stats?.featBonusCantrips?.length) {
        for (const c of stats.featBonusCantrips) {
            if (!spells.some(s => s.name === c.name)) {
                spells.push({ name: c.name, level: 0, source: `feat:${c.source}` });
            }
        }
    }
    if (stats?.featBonusSpells?.length) {
        for (const s of stats.featBonusSpells) {
            if (!spells.some(sp => sp.name === s.name)) {
                const freeCast = s.freeCast ? '1/LR' : '';
                spells.push({
                    name: s.name,
                    level: s.level || 1,
                    source: `feat:${s.source}`,
                    freeCast,
                    ritualOnly: s.ritualOnly || false,
                });
            }
        }
    }

    spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    return spells;
}

/**
 * Render the V1 spellbook panel.
 */
export function renderV1Spellbook() {
    const container = document.getElementById('dnd-v1-spellbook-container');
    const list = document.getElementById('dnd-v1-spellbook-list');
    const filterBar = document.getElementById('dnd-v1-spellbook-level-filters');
    const titleEl = document.getElementById('dnd-v1-spellbook-title');
    if (!container || !list) return;

    if (!characterV1) {
        container.style.display = 'none';
        return;
    }
    container.style.display = '';

    const spells = gatherCharacterSpells();

    if (!spells.length) {
        list.innerHTML = '<div class="dnd-empty-state">No spells configured</div>';
        if (filterBar) filterBar.style.display = 'none';
        if (titleEl) titleEl.textContent = 'Spellbook';
        return;
    }

    if (filterBar) {
        filterBar.style.display = '';
        renderSpellbookLevelFilters(filterBar, levelFilter, (lv) => {
            levelFilter = lv;
            renderV1Spellbook();
        });
    }
    if (titleEl) titleEl.textContent = `Spellbook (${spells.length})`;

    const filtered = spells.filter(s => matchesSpellbookLevelFilter(levelFilter, s.level));

    if (!filtered.length) {
        list.innerHTML = '<div class="dnd-empty-state">No spells at this level</div>';
        return;
    }

    let html = '';
    for (const spell of filtered) {
        const lvlChar = shortLevel(spell.level);
        const badgeClass = levelBadgeClass(spell.level);
        let sourceTag = '';
        if (spell.source.startsWith('feat:')) sourceTag = `<span class="dnd-v1-spell-source-tag">${esc(spell.source.replace('feat:', ''))}</span>`;
        else if (spell.source.startsWith('extra:')) sourceTag = `<span class="dnd-v1-spell-source-tag">${esc(spell.source.replace('extra:', ''))}</span>`;
        else if (spell.source === 'subclass') sourceTag = '<span class="dnd-v1-spell-source-tag">Subclass</span>';
        const freeCastTag = spell.freeCast ? `<span class="dnd-v1-spell-freecast-tag">${esc(spell.freeCast)}</span>` : '';
        const ritualTag = spell.ritualOnly ? '<span class="dnd-v1-spell-freecast-tag">Ritual</span>' : '';

        html += `<div class="dnd-spellbook-item" data-spell="${esc(spell.name)}" data-source="${esc(spell.source)}">` +
            `<span class="dnd-spellbook-lvl ${badgeClass}">${lvlChar}</span>` +
            `<span class="dnd-spellbook-name">${esc(spell.name)}</span>` +
            freeCastTag + ritualTag + sourceTag +
            '</div>';
    }

    list.innerHTML = html;
    bindSpellbookEvents(list);
}

function bindSpellbookEvents(container) {
    container.querySelectorAll('.dnd-spellbook-item').forEach(el => {
        el.addEventListener('mouseenter', () => {
            const spellData = lookupSpellSync(el.dataset.spell);
            if (spellData) showSpellTooltip(el, spellData);
        });

        el.addEventListener('mouseleave', () => hideSpellTooltip());

        el.addEventListener('click', () => {
            const name = el.dataset.spell;
            const spellData = lookupSpellSync(name);
            const level = spellData?.level !== undefined ? formatLevel(spellData.level) : '?';
            const text = `[${name}, ${level}]`;
            navigator.clipboard.writeText(text).then(() => {
                if (typeof toastr !== 'undefined') {
                    toastr.success(`Copied: ${text}`, '', { timeOut: 1500 });
                }
            }).catch(() => {});
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
    if (left < 8) left = rect.right + 8;

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

/**
 * Initialize spellbook event bindings.
 */
export function initV1Spellbook() {
    // Level filters are built on each renderV1Spellbook() call.
}
