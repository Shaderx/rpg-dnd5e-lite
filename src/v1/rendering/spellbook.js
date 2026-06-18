/**
 * V1 Character System - Spellbook Panel
 * Interactive spell list with hover tooltips, click-to-copy, filter/search,
 * and an "Add Spell" modal for browsing CDN spell data by class.
 */

import { characterV1 } from '../core/state.js';
import { saveCharacterV1 } from '../core/persistence.js';
import { preloadSpellData, getClassSpells, getClassCantrips, lookupSpellSync } from '../features/spells.js';
import { computeCharacterStats } from '../features/character.js';
import { SPELL_SCHOOLS } from '../core/constants.js';

let activeTooltip = null;
let addSpellDebounce = null;

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

/**
 * Gather all character spells (cantrips, known/prepared, extra, feat-granted).
 */
function gatherCharacterSpells() {
    if (!characterV1) return [];

    const spells = [];
    const char = characterV1;

    for (const name of (char.selectedCantrips || [])) {
        spells.push({ name, level: 0, source: 'class' });
    }
    for (const name of (char.selectedSpells || [])) {
        const spell = lookupSpellSync(name);
        spells.push({ name, level: spell?.level ?? 1, source: 'class' });
    }
    for (const name of (char.extraSpells || [])) {
        const spell = lookupSpellSync(name);
        spells.push({ name, level: spell?.level ?? 1, source: 'extra' });
    }
    for (const name of (char.customSpells || [])) {
        const spell = lookupSpellSync(name);
        spells.push({ name, level: spell?.level ?? 0, source: 'custom' });
    }

    // Feat-granted spells
    const stats = computeCharacterStats(char);
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
                spells.push({ name: s.name, level: s.level || 1, source: `feat:${s.source}` });
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
    const filterRow = document.getElementById('dnd-v1-spellbook-filter');
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
        if (filterRow) filterRow.style.display = 'none';
        if (titleEl) titleEl.textContent = 'Spellbook';
        return;
    }

    if (filterRow) filterRow.style.display = '';
    if (titleEl) titleEl.textContent = `Spellbook (${spells.length})`;

    // Apply filters
    const searchInput = document.getElementById('dnd-v1-spellbook-search');
    const levelFilter = document.getElementById('dnd-v1-spellbook-level-filter');
    const query = (searchInput?.value || '').toLowerCase().trim();
    const levelVal = levelFilter?.value || 'all';

    const filtered = spells.filter(s => {
        if (query && !s.name.toLowerCase().includes(query)) return false;
        if (levelVal !== 'all' && s.level !== parseInt(levelVal)) return false;
        return true;
    });

    if (!filtered.length) {
        list.innerHTML = '<div class="dnd-empty-state">No spells match filter</div>';
        return;
    }

    let html = '';
    for (const spell of filtered) {
        const lvlChar = shortLevel(spell.level);
        const badgeClass = levelBadgeClass(spell.level);
        const spellData = lookupSpellSync(spell.name);
        const school = spellData?.school ? schoolName(spellData.school) : '';
        const sourceTag = spell.source.startsWith('feat:') ? `<span class="dnd-v1-spell-source-tag">${esc(spell.source.replace('feat:', ''))}</span>` : '';
        const isCustom = spell.source === 'custom';

        html += `<div class="dnd-spellbook-item${isCustom ? ' v1-custom-spell' : ''}" data-spell="${esc(spell.name)}" data-source="${esc(spell.source)}">` +
            `<span class="dnd-spellbook-lvl ${badgeClass}">${lvlChar}</span>` +
            `<span class="dnd-spellbook-name">${esc(spell.name)}</span>` +
            (school ? `<span class="dnd-spellbook-school">${esc(school)}</span>` : '') +
            sourceTag +
            (isCustom ? `<button class="dnd-v1-spell-remove" data-spell="${esc(spell.name)}" title="Remove"><i class="fa-solid fa-xmark"></i></button>` : '') +
            `</div>`;
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

        el.addEventListener('click', (e) => {
            if (e.target.closest('.dnd-v1-spell-remove')) return;
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

    container.querySelectorAll('.dnd-v1-spell-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = btn.dataset.spell;
            if (characterV1?.customSpells) {
                characterV1.customSpells = characterV1.customSpells.filter(s => s !== name);
                saveCharacterV1(characterV1);
                renderV1Spellbook();
            }
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
    const searchInput = document.getElementById('dnd-v1-spellbook-search');
    const levelFilter = document.getElementById('dnd-v1-spellbook-level-filter');

    if (searchInput) searchInput.oninput = () => renderV1Spellbook();
    if (levelFilter) levelFilter.onchange = () => renderV1Spellbook();

    const addBtn = document.getElementById('dnd-v1-spellbook-add');
    if (addBtn) addBtn.onclick = () => openAddSpellModal();

    const closeBtn = document.getElementById('dnd-v1-add-spell-close');
    if (closeBtn) closeBtn.onclick = () => closeAddSpellModal();

    const overlay = document.getElementById('dnd-v1-add-spell-modal');
    if (overlay) overlay.onclick = (e) => { if (e.target === overlay) closeAddSpellModal(); };
}

function openAddSpellModal() {
    const modal = document.getElementById('dnd-v1-add-spell-modal');
    if (modal) modal.style.display = 'flex';

    const classSelect = document.getElementById('dnd-v1-add-spell-class');
    const levelSelect = document.getElementById('dnd-v1-add-spell-level');
    const searchInput = document.getElementById('dnd-v1-add-spell-search');
    const results = document.getElementById('dnd-v1-add-spell-results');

    if (classSelect) {
        if (characterV1?.className) {
            classSelect.value = characterV1.className.toLowerCase();
        }
        classSelect.onchange = () => runAddSpellSearch();
    }
    if (levelSelect) levelSelect.onchange = () => runAddSpellSearch();
    if (searchInput) {
        searchInput.value = '';
        searchInput.oninput = () => {
            clearTimeout(addSpellDebounce);
            addSpellDebounce = setTimeout(runAddSpellSearch, 200);
        };
    }
    if (results) results.innerHTML = '<div class="dnd-empty-state">Select a class and search for spells</div>';
}

function closeAddSpellModal() {
    const modal = document.getElementById('dnd-v1-add-spell-modal');
    if (modal) modal.style.display = 'none';
}

async function runAddSpellSearch() {
    const results = document.getElementById('dnd-v1-add-spell-results');
    const classSelect = document.getElementById('dnd-v1-add-spell-class');
    const levelSelect = document.getElementById('dnd-v1-add-spell-level');
    const searchInput = document.getElementById('dnd-v1-add-spell-search');
    if (!results) return;

    const classKey = classSelect?.value || '';
    const levelVal = levelSelect?.value || 'all';
    const query = (searchInput?.value || '').toLowerCase().trim();

    if (!classKey && !query) {
        results.innerHTML = '<div class="dnd-empty-state">Select a class or type to search</div>';
        return;
    }

    results.innerHTML = '<div class="dnd-empty-state">Loading...</div>';

    let spells;
    if (classKey) {
        const maxLevel = levelVal === 'all' ? 9 : parseInt(levelVal);
        spells = await getClassSpells(classKey, maxLevel);
        if (levelVal !== 'all') {
            spells = spells.filter(s => s.level === parseInt(levelVal));
        }
    } else {
        const all = await preloadSpellData();
        spells = (all || []).filter(s => {
            if (levelVal !== 'all' && s.level !== parseInt(levelVal)) return false;
            return true;
        });
    }

    if (query) {
        spells = spells.filter(s => s.name.toLowerCase().includes(query));
    }

    spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    const shown = spells.slice(0, 50);

    if (!shown.length) {
        results.innerHTML = '<div class="dnd-empty-state">No spells found</div>';
        return;
    }

    const existing = new Set([
        ...(characterV1?.selectedCantrips || []),
        ...(characterV1?.selectedSpells || []),
        ...(characterV1?.extraSpells || []),
        ...(characterV1?.customSpells || []),
    ].map(s => s.toLowerCase()));

    let html = '';
    for (const spell of shown) {
        const isOwned = existing.has(spell.name.toLowerCase());
        const lvlChar = shortLevel(spell.level);
        const badgeClass = levelBadgeClass(spell.level);
        const school = spell.school ? schoolName(spell.school) : '';

        html += `<div class="dnd-v1-add-spell-item${isOwned ? ' v1-spell-owned' : ''}" data-spell="${esc(spell.name)}">` +
            `<span class="dnd-spellbook-lvl ${badgeClass}">${lvlChar}</span>` +
            `<span class="dnd-spellbook-name">${esc(spell.name)}</span>` +
            (school ? `<span class="dnd-spellbook-school">${esc(school)}</span>` : '') +
            (isOwned ? '<span class="v1-spell-owned-tag">Known</span>' : `<button class="dnd-v1-add-spell-btn" data-spell="${esc(spell.name)}"><i class="fa-solid fa-plus"></i></button>`) +
            `</div>`;
    }
    if (spells.length > 50) {
        html += `<div class="dnd-empty-state">${spells.length - 50} more spells — refine your search</div>`;
    }

    results.innerHTML = html;

    results.querySelectorAll('.dnd-v1-add-spell-item').forEach(el => {
        el.addEventListener('mouseenter', () => {
            const spellData = lookupSpellSync(el.dataset.spell);
            if (spellData) showSpellTooltip(el, spellData);
        });
        el.addEventListener('mouseleave', () => hideSpellTooltip());
    });

    results.querySelectorAll('.dnd-v1-add-spell-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const name = btn.dataset.spell;
            addCustomSpell(name);
            btn.closest('.dnd-v1-add-spell-item')?.classList.add('v1-spell-owned');
            btn.replaceWith(Object.assign(document.createElement('span'), { className: 'v1-spell-owned-tag', textContent: 'Added' }));
        };
    });
}

function addCustomSpell(name) {
    if (!characterV1) return;
    if (!characterV1.customSpells) characterV1.customSpells = [];
    if (characterV1.customSpells.includes(name)) return;
    characterV1.customSpells.push(name);
    saveCharacterV1(characterV1);
    renderV1Spellbook();
}
