/**
 * D&D 5e Lite - Spellbook
 * Parses 5e.tools spell sublist hashes, fetches spell data from the 5e.tools
 * data API (via jsDelivr CDN mirror), caches results, and builds tooltip HTML.
 */

import { spellbook, spellDataCache, setSpellbook } from '../core/state.js';
import { saveSpellbook } from '../core/persistence.js';

const SCHOOL_NAMES = {
    A: 'Abjuration',
    C: 'Conjuration',
    D: 'Divination',
    E: 'Enchantment',
    V: 'Evocation',
    I: 'Illusion',
    N: 'Necromancy',
    T: 'Transmutation',
};

const DATA_URLS = [
    src => `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/spells/spells-${src}.json`,
    src => `https://raw.githubusercontent.com/5etools-mirror-3/homebrew/master/spell/${src}.json`,
    src => `https://5e.tools/data/spells/spells-${src}.json`,
];

const _inflight = new Map();
const _failedSources = new Set();

export function clearSpellbookCache() {
    spellDataCache.clear();
    _failedSources.clear();
}

/**
 * Parse a 5e.tools spell hash into { name, source }.
 * Hash format: `{urlEncodedName}_{sourceId}` — split on the LAST underscore.
 */
export function parseSpellHash(hash) {
    const decoded = decodeURIComponent(hash);
    const lastUnderscore = decoded.lastIndexOf('_');
    if (lastUnderscore < 0) return { name: decoded, source: '' };
    return {
        name: decoded.substring(0, lastUnderscore),
        source: decoded.substring(lastUnderscore + 1),
    };
}

function titleCase(str) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Format a spell level number into its display string.
 */
export function formatLevel(level) {
    if (level === 0) return 'Cantrip';
    const suffixes = { 1: 'st', 2: 'nd', 3: 'rd' };
    return `${level}${suffixes[level] || 'th'} Level`;
}

/** Short level label for compact display: "C", "1", "2", etc. */
export function shortLevel(level) {
    return level === 0 ? 'C' : String(level);
}

/**
 * Get the school full name from its single-letter code.
 */
export function schoolName(code) {
    return SCHOOL_NAMES[code] || code;
}

/**
 * Fetch a source JSON with fallback URLs. Returns parsed JSON or null.
 */
async function fetchSourceJson(srcKey) {
    for (const urlFn of DATA_URLS) {
        const url = urlFn(srcKey);
        try {
            const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!r.ok) continue;
            const data = await r.json();
            if (data?.spell?.length) return data;
        } catch { /* try next */ }
    }
    return null;
}

/**
 * Fetch spell data for all given sources, matching only the hashes we need.
 * Populates spellDataCache. Sources that already failed are skipped.
 * @param {string[]} hashes - Spell hashes from the sublist items
 */
export async function fetchSpellData(hashes) {
    const needed = new Map();
    for (const h of hashes) {
        if (spellDataCache.has(h)) continue;
        const { name, source } = parseSpellHash(h);
        const srcLower = source.toLowerCase();
        if (_failedSources.has(srcLower)) continue;
        if (!needed.has(srcLower)) needed.set(srcLower, []);
        needed.get(srcLower).push({ hash: h, name: name.toLowerCase(), source: source.toLowerCase() });
    }

    if (needed.size === 0) return;

    const fetches = [];
    for (const [srcKey, entries] of needed) {
        let promise = _inflight.get(srcKey);
        if (!promise) {
            promise = fetchSourceJson(srcKey)
                .then(data => {
                    if (!data?.spell) {
                        console.warn(`[D&D 5e Lite] No spell data found for source "${srcKey}"`);
                        _failedSources.add(srcKey);
                        return;
                    }
                    const lookup = new Map();
                    for (const s of data.spell) {
                        lookup.set(`${s.name.toLowerCase()}|${s.source.toLowerCase()}`, s);
                    }
                    for (const entry of entries) {
                        const match = lookup.get(`${entry.name}|${entry.source}`);
                        if (match) spellDataCache.set(entry.hash, match);
                    }
                })
                .catch(err => {
                    console.warn(`[D&D 5e Lite] Spell fetch failed for "${srcKey}":`, err);
                    _failedSources.add(srcKey);
                })
                .finally(() => _inflight.delete(srcKey));
            _inflight.set(srcKey, promise);
        }
        fetches.push(promise);
    }

    await Promise.all(fetches);
}

/**
 * Get cached spell data for a hash, or return a minimal fallback
 * with a title-cased name parsed from the hash.
 */
export function getSpellDetail(hash) {
    if (spellDataCache.has(hash)) return spellDataCache.get(hash);
    const { name, source } = parseSpellHash(hash);
    return { name: titleCase(name), source: source.toUpperCase(), _fallback: true };
}

function formatTime(timeArr) {
    if (!Array.isArray(timeArr) || timeArr.length === 0) return '—';
    const t = timeArr[0];
    if (typeof t === 'string') return t;
    return `${t.number} ${t.unit}`;
}

function formatRange(range) {
    if (!range) return '—';
    if (range.type === 'point') {
        const d = range.distance;
        if (!d) return 'Self';
        if (d.type === 'self') return 'Self';
        if (d.type === 'touch') return 'Touch';
        if (d.type === 'sight') return 'Sight';
        if (d.type === 'unlimited') return 'Unlimited';
        return `${d.amount} ${d.type}`;
    }
    if (range.type === 'special') return 'Special';
    if (range.type === 'radius' || range.type === 'sphere' || range.type === 'cone' ||
        range.type === 'line' || range.type === 'cube' || range.type === 'hemisphere') {
        const d = range.distance;
        return d ? `Self (${d.amount}-${d.type} ${range.type})` : `Self (${range.type})`;
    }
    return '—';
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
    if (!Array.isArray(durArr) || durArr.length === 0) return '—';
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

function flattenEntries(entries, depth = 0) {
    if (!Array.isArray(entries)) return '';
    const blocks = [];
    for (const e of entries) {
        if (typeof e === 'string') {
            blocks.push({ html: e, block: false });
        } else if (e?.type === 'options' && Array.isArray(e.entries)) {
            blocks.push({ html: flattenEntries(e.entries, depth + 1), block: true });
        } else if (e?.entries) {
            let html = '';
            if (e.name) html += `<strong>${escapeHtml(e.name)}.</strong> `;
            html += flattenEntries(e.entries, depth + 1);
            blocks.push({ html, block: !!e.name });
        } else if (e?.type === 'list' && Array.isArray(e.items)) {
            for (const item of e.items) {
                if (typeof item === 'string') {
                    blocks.push({ html: `\u2022 ${item}`, block: true });
                } else if (item?.entries) {
                    let html = item.name ? `\u2022 <strong>${escapeHtml(item.name)}.</strong> ` : '\u2022 ';
                    html += flattenEntries(item.entries, depth + 1);
                    blocks.push({ html, block: true });
                }
            }
        } else if (e?.type === 'table') {
            blocks.push({ html: renderInlineTable(e), block: true });
        }
    }
    const parts = [];
    for (const b of blocks) {
        if (b.block && parts.length > 0) parts.push('<br>');
        parts.push(b.html);
    }
    return parts.join(' ');
}

function renderInlineTable(tbl) {
    let html = '';
    if (tbl.caption) html += `<div class="dnd-inline-table-caption">${escapeHtml(stripTags(tbl.caption))}</div>`;
    html += '<table class="dnd-inline-table"><thead><tr>';
    for (const col of (tbl.colLabels || [])) {
        html += `<th>${escapeHtml(stripTags(col))}</th>`;
    }
    html += '</tr></thead><tbody>';
    for (const row of (tbl.rows || [])) {
        html += '<tr>';
        for (const cell of row) {
            const val = typeof cell === 'string' ? cell : (cell?.toString?.() ?? '');
            html += `<td>${escapeHtml(stripTags(val))}</td>`;
        }
        html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function stripTags(html) {
    return html.replace(/{@\w+ ([^}|]+)(?:\|[^}]*)?\}/g, '$1');
}

/**
 * Build rich tooltip HTML for a spell data object.
 */
export function buildTooltipContent(spell) {
    if (!spell || spell._fallback) {
        const src = spell?.source || '';
        return `<div class="dnd-spell-tooltip-name">${escapeHtml(spell?.name || '???')}</div>
                <div class="dnd-spell-tooltip-sub">${src ? escapeHtml(src) + ' — ' : ''}Third-party source</div>
                <div class="dnd-spell-tooltip-divider"></div>
                <div class="dnd-spell-tooltip-desc">Spell data not available in mirror.<br>Click to copy, hover on others for details.</div>`;
    }

    const ritualTag = spell.meta?.ritual ? ' (ritual)' : '';
    const levelSchool = spell.level === 0
        ? `${schoolName(spell.school)} cantrip${ritualTag}`
        : `${formatLevel(spell.level)} ${schoolName(spell.school)}${ritualTag}`;

    const desc = stripTags(flattenEntries(spell.entries));

    let higherLevel = '';
    if (spell.entriesHigherLevel?.length) {
        higherLevel = `<div class="dnd-spell-tooltip-higher"><strong>At Higher Levels.</strong> ${stripTags(flattenEntries(spell.entriesHigherLevel))}</div>`;
    }

    return `<div class="dnd-spell-tooltip-name">${escapeHtml(spell.name)}</div>
<div class="dnd-spell-tooltip-sub">${escapeHtml(levelSchool)}</div>
<div class="dnd-spell-tooltip-divider"></div>
<div class="dnd-spell-tooltip-field"><strong>Casting Time:</strong> ${escapeHtml(formatTime(spell.time))}</div>
<div class="dnd-spell-tooltip-field"><strong>Range:</strong> ${escapeHtml(formatRange(spell.range))}</div>
<div class="dnd-spell-tooltip-field"><strong>Components:</strong> ${escapeHtml(formatComponents(spell.components))}</div>
<div class="dnd-spell-tooltip-field"><strong>Duration:</strong> ${escapeHtml(formatDuration(spell.duration))}</div>
<div class="dnd-spell-tooltip-divider"></div>
<div class="dnd-spell-tooltip-desc">${desc}</div>${higherLevel}`;
}

/**
 * Import a 5e.tools spells-sublist JSON object.
 * Validates, saves to chat metadata, and triggers data fetching.
 * @returns {{ ok: boolean, error?: string, name?: string, count?: number }}
 */
export async function importSpellbook(json) {
    if (!json || typeof json !== 'object') {
        return { ok: false, error: 'Invalid JSON object.' };
    }
    if (json.fileType !== 'spells-sublist') {
        return { ok: false, error: `Unexpected fileType: "${json.fileType}". Expected "spells-sublist".` };
    }
    if (!Array.isArray(json.items) || json.items.length === 0) {
        return { ok: false, error: 'No spell items found in the file.' };
    }

    const data = {
        name: json.name || 'Unnamed Spellbook',
        items: json.items.map(i => ({ h: i.h })),
        sources: json.sources || [],
    };

    setSpellbook(data);
    saveSpellbook(data);

    const hashes = data.items.map(i => i.h);
    await fetchSpellData(hashes);

    return { ok: true, name: data.name, count: data.items.length };
}

/**
 * Clear the current spellbook from state and storage.
 */
export function clearSpellbook() {
    setSpellbook(null);
    saveSpellbook(null);
}

/**
 * Ensure spell data is fetched for the current spellbook.
 * Called after loading spellbook from chat_metadata on chat change.
 */
export async function ensureSpellData() {
    if (!spellbook?.items?.length) return;
    const hashes = spellbook.items.map(i => i.h);
    await fetchSpellData(hashes);
}
