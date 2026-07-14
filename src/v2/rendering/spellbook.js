/**
 * V2 Character System - Spellbook Panel
 * Interactive spell list with hover tooltips, click-to-copy, and filter/search.
 */

import { characterV2 } from '../core/characterState.js';
import { saveCharacterV2 } from '../core/characterPersist.js';
import { lookupSpellSync } from '../features/spells.js';
import { computeV2CharacterStats } from '../features/character.js';
import { computeFreeCastUsage, getFreeCastUsage } from '../features/freeCastTracker.js';
import { spellLog } from '../../core/state.js';
import { addManualSpellCast } from '../../features/spellTracker.js';
import { SPELL_SCHOOLS } from '../core/constants.js';
import { renderSpellbookLevelFilters, matchesSpellbookLevelFilter } from '../../rendering/spellbookLevelFilter.js';
import { isPlayerChosenDamageType, collectSpellScalingText } from '../../features/spellScaling.js';

let activeTooltip = null;
let levelFilter = 'all';
let activeMetamagic = [];

function isReactionSpell(spellData) {
    return spellData?.time?.[0]?.unit === 'reaction';
}

function isReactionArmed(spellName) {
    return (characterV2?.preparedReactions || []).includes(spellName);
}

function togglePreparedReaction(spellName) {
    if (!characterV2) return;
    if (!Array.isArray(characterV2.preparedReactions)) characterV2.preparedReactions = [];
    const idx = characterV2.preparedReactions.indexOf(spellName);
    if (idx >= 0) {
        characterV2.preparedReactions.splice(idx, 1);
    } else {
        characterV2.preparedReactions.push(spellName);
    }
    saveCharacterV2(characterV2);
}

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
<div class="dnd-spell-tooltip-field"><strong>Casting Time:</strong> ${esc(formatTime(spell.time) + (spell.meta?.ritual ? ' (ritual)' : ''))}</div>
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
    if (!characterV2) return [];

    const spells = [];
    const char = characterV2;

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
    const stats = computeV2CharacterStats(char);
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
            const existing = spells.find(sp => sp.name === s.name);
            if (existing) {
                if (s.freeCast && !existing.freeCast) existing.freeCast = s.freeCast;
                continue;
            }
            const baseName = s.noConc ? s.name.replace(/\s*\(No Conc\)\s*$/i, '') : s.name;
            const spell = lookupSpellSync(baseName);
            const freeCast = s.freeCast ? '1/LR' : '';
            spells.push({
                name: s.name,
                level: s.level || spell?.level || 1,
                source: `feat:${s.source}`,
                freeCast,
                ritualOnly: s.ritualOnly || false,
                noConc: s.noConc || false,
                baseName: s.noConc ? baseName : undefined,
            });
        }
    }

    spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    return spells;
}

/**
 * Determine how many metamagic options can be active simultaneously.
 * Sorcery Incarnate (Lv7 sorcerer) allows 2; otherwise max 1.
 */
function getMetamagicMaxActive(stats) {
    if (!stats || stats.className?.toLowerCase() !== 'sorcerer') return 1;
    return stats.level >= 7 ? 2 : 1;
}

/**
 * Render metamagic toggle buttons into a container.
 * @param {HTMLElement} container
 * @param {Array<{ id: string, label: string, desc: string }>} options
 * @param {number} maxActive
 */
function renderMetamagicToggles(container, options, maxActive) {
    if (!container) return;
    if (!options?.length) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    activeMetamagic = activeMetamagic.filter(id => options.some(o => o.id === id));

    container.style.display = '';
    let html = '';
    for (const opt of options) {
        const active = activeMetamagic.includes(opt.id) ? ' active' : '';
        html += `<button type="button" class="dnd-metamagic-toggle${active}" data-mm-id="${esc(opt.id)}" title="${esc(opt.desc)}">${esc(opt.label)}</button>`;
    }
    container.innerHTML = html;

    container.querySelectorAll('.dnd-metamagic-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.mmId;
            const idx = activeMetamagic.indexOf(id);
            if (idx >= 0) {
                activeMetamagic.splice(idx, 1);
            } else {
                if (activeMetamagic.length >= maxActive) activeMetamagic.shift();
                activeMetamagic.push(id);
            }
            renderV2Spellbook();
        });
    });
}

/**
 * Extract SP cost string from a metamagic desc field.
 * Handles "(1 SP)", "(2 SP)", and "(SP = spell level, min 1)".
 */
function extractSpCost(desc) {
    if (!desc) return '';
    const m = desc.match(/\((\d+)\s*SP\)/i);
    if (m) return m[1] + 'SP';
    if (/SP\s*=\s*spell level/i.test(desc)) return 'SP=LV';
    return '';
}

/**
 * Build the metamagic suffix for clipboard text, including SP cost.
 * @param {Array<{ id: string, label: string, desc: string }>} options
 * @returns {string} e.g. ", Quickened Spell 2SP" or ", Quickened Spell 2SP, Subtle Spell 1SP"
 */
function buildMetamagicClipboardSuffix(options) {
    if (!activeMetamagic.length || !options?.length) return '';
    const parts = activeMetamagic
        .map(id => {
            const opt = options.find(o => o.id === id);
            if (!opt) return null;
            const cost = extractSpCost(opt.desc);
            return cost ? `${opt.label} ${cost}` : opt.label;
        })
        .filter(Boolean);
    return parts.length ? ', ' + parts.join(', ') : '';
}

/**
 * Render the V2 spellbook panel.
 */
export function renderV2Spellbook() {
    const container = document.getElementById('dnd-v1-spellbook-container');
    const list = document.getElementById('dnd-v1-spellbook-list');
    const filterBar = document.getElementById('dnd-v1-spellbook-level-filters');
    const titleEl = document.getElementById('dnd-v1-spellbook-title');
    if (!container || !list) return;

    if (!characterV2) {
        container.style.display = 'none';
        return;
    }
    container.style.display = '';

    const spells = gatherCharacterSpells();
    const stats = computeV2CharacterStats(characterV2);
    const freeCastUsage = computeFreeCastUsage(characterV2, stats, spellLog);
    const metamagicOptions = stats?.levelChoiceDetails?.metamagic || [];
    const metamagicMaxActive = getMetamagicMaxActive(stats);

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
            renderV2Spellbook();
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
        const spellData = lookupSpellSync(spell.baseName || spell.name);
        const reaction = isReactionSpell(spellData);
        const armed = reaction && isReactionArmed(spell.name);

        let sourceTag = '';
        if (spell.source.startsWith('feat:')) sourceTag = `<span class="dnd-v1-spell-source-tag">${esc(spell.source.replace('feat:', ''))}</span>`;
        else if (spell.source.startsWith('extra:')) sourceTag = `<span class="dnd-v1-spell-source-tag">${esc(spell.source.replace('extra:', ''))}</span>`;
        else if (spell.source === 'subclass') sourceTag = '<span class="dnd-v1-spell-source-tag">Subclass</span>';
        const freeCastTag = spell.freeCast
            ? (() => {
                const usage = getFreeCastUsage(freeCastUsage, spell.name);
                const usedClass = usage && !usage.available ? ' dnd-v1-spell-freecast-tag--used' : '';
                return `<span class="dnd-v1-spell-freecast-tag${usedClass}">${esc(spell.freeCast)}</span>`;
            })()
            : '';
        const ritualTag = spell.ritualOnly ? '<span class="dnd-v1-spell-freecast-tag">Ritual</span>' : '';

        const reactionClasses = reaction ? ` dnd-reaction-spell${armed ? ' dnd-reaction-armed' : ''}` : '';
        const reactionAttr = reaction ? ' data-reaction="true"' : '';
        const reactionTag = reaction
            ? `<span class="dnd-reaction-tag${armed ? ' dnd-reaction-tag--armed' : ''}" title="Reaction — click to ${armed ? 'disarm' : 'arm'}">⚡</span>`
            : '';

        const nocAttr = spell.noConc ? ` data-noconc='true' data-basename='${esc(spell.baseName || '')}'` : '';
        html += `<div class="dnd-spellbook-item${reactionClasses}" data-spell="${esc(spell.name)}" data-source="${esc(spell.source)}" data-freecast="${esc(spell.freeCast || '')}"${reactionAttr}${nocAttr}>` +
            `<span class="dnd-spellbook-lvl ${badgeClass}">${lvlChar}</span>` +
            `<span class="dnd-spellbook-name">${esc(spell.name)}</span>` +
            reactionTag + freeCastTag + ritualTag + sourceTag +
            '</div>';
    }

    list.innerHTML = html;

    let metamagicBar = container.querySelector('.dnd-metamagic-bar');
    if (metamagicOptions.length) {
        if (!metamagicBar) {
            metamagicBar = document.createElement('div');
            metamagicBar.className = 'dnd-metamagic-bar';
        }
        const body = container.querySelector('.dnd-collapsible-body');
        if (body) body.appendChild(metamagicBar);
        renderMetamagicToggles(metamagicBar, metamagicOptions, metamagicMaxActive);
    } else if (metamagicBar) {
        metamagicBar.style.display = 'none';
        metamagicBar.innerHTML = '';
    }

    bindSpellbookEvents(list, freeCastUsage, metamagicOptions);
}

function bindSpellbookEvents(container, freeCastUsage, metamagicOptions) {
    container.querySelectorAll('.dnd-spellbook-item').forEach(el => {
        el.addEventListener('mouseenter', () => {
            const lookupName = el.dataset.basename || el.dataset.spell;
            const spellData = lookupSpellSync(lookupName);
            if (spellData) showSpellTooltip(el, spellData);
        });

        el.addEventListener('mouseleave', () => hideSpellTooltip());

        el.addEventListener('click', (e) => {
            const name = el.dataset.spell;

            if (el.dataset.reaction === 'true') {
                if (e.shiftKey) {
                    const lookupName = el.dataset.basename || name;
                    const sd = lookupSpellSync(lookupName);
                    const lvl = sd?.level ? formatLevel(sd.level) : '';
                    addManualSpellCast(name, lvl);
                    if (typeof toastr !== 'undefined') {
                        toastr.success(`Logged reaction: ${name}`, '', { timeOut: 1500 });
                    }
                    return;
                }
                const wasArmed = isReactionArmed(name);
                togglePreparedReaction(name);
                if (typeof toastr !== 'undefined') {
                    const msg = wasArmed ? `⚡ ${name} disarmed` : `⚡ ${name} armed`;
                    toastr.info(msg, '', { timeOut: 1500 });
                }
                renderV2Spellbook();
                return;
            }

            const noConc = el.dataset.noconc === 'true';
            const lookupName = noConc ? (el.dataset.basename || name) : name;
            const spellData = lookupSpellSync(lookupName);
            const level = spellData?.level !== undefined ? formatLevel(spellData.level) : '?';
            const freeCast = el.dataset.freecast;
            const usage = freeCast ? getFreeCastUsage(freeCastUsage, name) : null;
            const includeFree = freeCast && freeCast !== 'at will' && usage?.available !== false;
            const isConcentration = !noConc && !!spellData?.duration?.[0]?.concentration;
            const mmSuffix = buildMetamagicClipboardSuffix(metamagicOptions);

            let elementToken = '';
            if (spellData && isPlayerChosenDamageType(spellData, collectSpellScalingText(spellData))) {
                const stats = computeV2CharacterStats(characterV2);
                const draconicEl = stats?.empoweredDamageType;
                const defaultEl = draconicEl || (spellData.damageInflict?.[0]) || null;
                if (defaultEl) elementToken = `, ${defaultEl.charAt(0).toUpperCase() + defaultEl.slice(1)}`;
            }

            let text = `[${name}, ${level}`;
            if (includeFree) text += ', Free';
            if (isConcentration) text += ', Conc';
            text += elementToken + mmSuffix + ']';
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
export function initV2Spellbook() {
    // Level filters are built on each renderV2Spellbook() call.
}
