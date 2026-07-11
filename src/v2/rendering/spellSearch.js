/**
 * V2 Spell Database Search Modal
 * Shift-click spellbook header → fuzzy search all spells available to current class.
 */

import { characterV2 } from '../core/characterState.js';
import { getClassSpells, preloadSpellData, lookupSpellSync } from '../features/spells.js';
import { getSpellSlots, SPELL_SCHOOLS, SUBCLASS_EXTRA_SPELL_LISTS } from '../core/constants.js';

let overlay = null;
let searchTimeout = null;
let activeTooltip = null;
let levelFilter = 'all';
let unlocked = false;

// Session-level cache: keyed by `${classKey}:${maxLevel}` or `all:9`
const spellCache = new Map();

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function schoolName(code) { return SPELL_SCHOOLS[code] || code; }

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

function buildTooltipHtml(spell) {
    if (!spell) return '';
    const levelSchool = spell.level === 0
        ? `${schoolName(spell.school)} cantrip`
        : `${formatLevel(spell.level)} ${schoolName(spell.school)}`;
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

function showTooltip(anchorEl, spell) {
    hideTooltip();
    const tip = document.createElement('div');
    tip.className = 'dnd-spell-tooltip';
    tip.innerHTML = buildTooltipHtml(spell);
    document.body.appendChild(tip);
    activeTooltip = tip;

    const rect = anchorEl.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();

    let left = rect.right + 8;
    if (left + tipRect.width > window.innerWidth - 8) left = rect.left - tipRect.width - 8;
    if (left < 8) left = 8;

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

function hideTooltip() {
    if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
    }
}

function fuzzyScore(query, target) {
    const q = query.toLowerCase();
    const t = target.toLowerCase();

    if (t.includes(q)) return t.indexOf(q);

    let qi = 0;
    let score = 0;
    let lastMatch = -1;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
        if (t[ti] === q[qi]) {
            score += (ti - lastMatch - 1);
            lastMatch = ti;
            qi++;
        }
    }
    return qi === q.length ? score + 100 : -1;
}

function filterSpells(spells, query) {
    if (!query) return spells;
    const scored = [];
    for (const spell of spells) {
        const s = fuzzyScore(query, spell.name);
        if (s >= 0) scored.push({ spell, score: s });
    }
    scored.sort((a, b) => a.score - b.score);
    return scored.map(s => s.spell);
}

function renderResults(resultsDiv, spells) {
    if (!spells.length) {
        resultsDiv.innerHTML = '<div class="dnd-spell-search-empty">No spells found</div>';
        return;
    }

    let html = '';
    for (const spell of spells) {
        const lvl = spell.level === 0 ? 'C' : String(spell.level);
        const badge = levelBadgeClass(spell.level);
        const school = schoolName(spell.school);
        const conc = spell.duration?.[0]?.concentration ? '<span class="dnd-spell-search-tag">C</span>' : '';
        const ritual = spell.meta?.ritual ? '<span class="dnd-spell-search-tag">R</span>' : '';
        html += `<div class="dnd-spell-search-result" data-spell-name="${esc(spell.name)}">
            <span class="dnd-spellbook-lvl ${badge}">${lvl}</span>
            <span class="dnd-spell-search-name">${esc(spell.name)}</span>
            <span class="dnd-spell-search-school">${esc(school)}</span>
            ${conc}${ritual}
        </div>`;
    }
    resultsDiv.innerHTML = html;

    resultsDiv.querySelectorAll('.dnd-spell-search-result').forEach(el => {
        el.addEventListener('mouseenter', () => {
            const spellData = lookupSpellSync(el.dataset.spellName);
            if (spellData) showTooltip(el, spellData);
        });
        el.addEventListener('mouseleave', () => hideTooltip());
    });
}

function renderLevelFilters(container, activeLevel, onSelect) {
    if (!container) return;
    const levels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    let html = '';
    for (const lv of levels) {
        const label = lv === 0 ? 'C' : String(lv);
        const badge = levelBadgeClass(lv);
        const active = activeLevel === lv ? ' active' : '';
        html += `<button type="button" class="dnd-spellbook-lvl-filter ${badge}${active}" data-level="${lv}">${label}</button>`;
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

function getExtraSpellLists(classKey, subclassName) {
    if (!classKey || !subclassName) return [];
    for (const [key, lists] of Object.entries(SUBCLASS_EXTRA_SPELL_LISTS)) {
        const [cls, sub] = key.split('|');
        if (cls === classKey && subclassName.includes(sub)) return lists;
    }
    return [];
}

function mergeSpellArrays(base, extra) {
    const seen = new Set(base.map(s => s.name.toLowerCase()));
    const merged = [...base];
    for (const s of extra) {
        if (!seen.has(s.name.toLowerCase())) {
            seen.add(s.name.toLowerCase());
            merged.push(s);
        }
    }
    return merged;
}

async function fetchClassSpellsCached(classKey, subclassName, maxLv) {
    const key = `class:${classKey}:${subclassName || ''}:${maxLv}`;
    if (spellCache.has(key)) return spellCache.get(key);

    await preloadSpellData();
    let spells = await getClassSpells(classKey, maxLv);

    const extraLists = getExtraSpellLists(classKey, subclassName);
    for (const extraKey of extraLists) {
        const extra = await getClassSpells(extraKey, maxLv);
        spells = mergeSpellArrays(spells, extra);
    }

    spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    spellCache.set(key, spells);
    return spells;
}

async function fetchAllSpellsCached() {
    const key = 'all';
    if (spellCache.has(key)) return spellCache.get(key);

    const spells = await preloadSpellData();
    const sorted = [...spells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    spellCache.set(key, sorted);
    return sorted;
}

function getVisibleSpells(allSpells, query, currentLevelFilter) {
    if (query) {
        return filterSpells(allSpells, query);
    }
    if (currentLevelFilter === 'all') return allSpells;
    return allSpells.filter(s => s.level === currentLevelFilter);
}

let currentClassKey = '';
let currentSubclass = '';
let currentMaxLv = 9;

async function refreshList() {
    if (!overlay) return;
    const input = overlay.querySelector('.dnd-spell-search-input');
    const resultsDiv = overlay.querySelector('.dnd-spell-search-results');
    if (!input || !resultsDiv) return;

    const spells = unlocked
        ? await fetchAllSpellsCached()
        : await fetchClassSpellsCached(currentClassKey, currentSubclass, currentMaxLv);

    const query = input.value.trim();
    const visible = getVisibleSpells(spells, query, levelFilter);
    renderResults(resultsDiv, visible);
}

function updateLockButton() {
    if (!overlay) return;
    const btn = overlay.querySelector('.dnd-spell-search-lock-btn');
    if (!btn) return;
    btn.innerHTML = unlocked
        ? '<i class="fa-solid fa-lock-open"></i>'
        : '<i class="fa-solid fa-lock"></i>';
    btn.title = unlocked
        ? 'Unlocked: showing all levels & no class restriction on max level'
        : `Locked: max spell level ${currentMaxLv} (${characterV2?.className || ''})`;
}

export async function openSpellSearchModal() {
    if (!characterV2) {
        if (typeof toastr !== 'undefined') toastr.warning('No character configured');
        return;
    }

    currentClassKey = (characterV2.className || '').toLowerCase();
    if (!currentClassKey) {
        if (typeof toastr !== 'undefined') toastr.warning('No class set on character');
        return;
    }
    currentSubclass = characterV2.subclassName || '';

    closeSpellSearchModal();

    levelFilter = 'all';
    unlocked = false;

    const slots = getSpellSlots(currentClassKey, characterV2.level || 1, currentSubclass);
    currentMaxLv = 0;
    for (let i = slots.length - 1; i >= 0; i--) { if (slots[i] > 0) { currentMaxLv = i + 1; break; } }
    if (currentMaxLv === 0) currentMaxLv = 9;

    const className = characterV2.className || currentClassKey;

    overlay = document.createElement('div');
    overlay.className = 'dnd-spell-search-overlay';
    overlay.innerHTML = `
        <div class="dnd-spell-search-modal">
            <div class="dnd-spell-search-header">
                <span><i class="fa-solid fa-magnifying-glass"></i> ${esc(className)} Spell Database</span>
                <div class="dnd-spell-search-header-actions">
                    <button class="dnd-spell-search-lock-btn" title="Toggle level/class lock"><i class="fa-solid fa-lock"></i></button>
                    <button class="dnd-spell-search-close-btn"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
            <div class="dnd-spell-search-toolbar">
                <input type="text" class="dnd-spell-search-input" placeholder="Search spells..." autofocus>
                <div class="dnd-spell-search-level-filters"></div>
            </div>
            <div class="dnd-spell-search-results">
                <div class="dnd-spell-search-empty">Loading spell database...</div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector('.dnd-spell-search-input');
    overlay.querySelector('.dnd-spell-search-results');
    const closeBtn = overlay.querySelector('.dnd-spell-search-close-btn');
    const lockBtn = overlay.querySelector('.dnd-spell-search-lock-btn');
    const filterBar = overlay.querySelector('.dnd-spell-search-level-filters');

    closeBtn.addEventListener('click', closeSpellSearchModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSpellSearchModal(); });
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSpellSearchModal(); });

    lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        unlocked = !unlocked;
        updateLockButton();
        refreshList();
    });

    const onLevelSelect = (lv) => {
        levelFilter = lv;
        renderLevelFilters(filterBar, levelFilter, onLevelSelect);
        refreshList();
    };
    renderLevelFilters(filterBar, levelFilter, onLevelSelect);

    updateLockButton();

    await preloadSpellData();
    await refreshList();
    /** @type {HTMLInputElement} */ (input)?.focus();

    input.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => refreshList(), 120);
    });
}

export function closeSpellSearchModal() {
    hideTooltip();
    if (overlay) {
        overlay.remove();
        overlay = null;
    }
    clearTimeout(searchTimeout);
}
