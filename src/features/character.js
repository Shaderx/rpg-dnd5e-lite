/**
 * D&D 5e Lite - Character
 * Fetches class/subclass data from the 5e.tools jsDelivr mirror,
 * extracts class tables and features up to a given level.
 */

import { character, classDataCache, setCharacter } from '../core/state.js';
import { saveCharacter } from '../core/persistence.js';

const CDN_BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/class';
const CDN_DATA = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data';

let _classIndex = null;
let _indexInflight = null;
let _optFeatures = null;
let _optFeatInflight = null;

const ABILITY_NAMES = {
    str: 'STR', dex: 'DEX', con: 'CON',
    int: 'INT', wis: 'WIS', cha: 'CHA',
};

/**
 * Fetch and cache the class index (maps class name to filename).
 * @returns {Promise<Object>} e.g. { sorcerer: "class-sorcerer.json", ... }
 */
export async function fetchClassIndex() {
    if (_classIndex) return _classIndex;
    if (_indexInflight) return _indexInflight;
    _indexInflight = fetch(`${CDN_BASE}/index.json`, { signal: AbortSignal.timeout(10000) })
        .then(r => r.ok ? r.json() : null)
        .then(data => { _classIndex = data; return data; })
        .catch(err => { console.warn('[D&D 5e Lite] Class index fetch failed:', err); return null; })
        .finally(() => { _indexInflight = null; });
    return _indexInflight;
}

/**
 * Fetch and cache a class data file.
 * @param {string} filename e.g. "class-sorcerer.json"
 * @returns {Promise<Object|null>}
 */
export async function fetchClassData(filename) {
    if (classDataCache.has(filename)) return classDataCache.get(filename);
    try {
        const r = await fetch(`${CDN_BASE}/${filename}`, { signal: AbortSignal.timeout(20000) });
        if (!r.ok) return null;
        const data = await r.json();
        classDataCache.set(filename, data);
        return data;
    } catch (err) {
        console.warn(`[D&D 5e Lite] Class data fetch failed for "${filename}":`, err);
        return null;
    }
}

/**
 * Fetch and cache the optional features file (metamagic, invocations, etc.).
 */
export async function fetchOptionalFeatures() {
    if (_optFeatures) return _optFeatures;
    if (_optFeatInflight) return _optFeatInflight;
    _optFeatInflight = fetch(`${CDN_DATA}/optionalfeatures.json`, { signal: AbortSignal.timeout(15000) })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            if (data?.optionalfeature) {
                _optFeatures = new Map();
                for (const f of data.optionalfeature) {
                    _optFeatures.set(`${f.name}|${f.source}`, f);
                }
            }
            return _optFeatures;
        })
        .catch(err => { console.warn('[D&D 5e Lite] Optional features fetch failed:', err); return null; })
        .finally(() => { _optFeatInflight = null; });
    return _optFeatInflight;
}

/**
 * Get the class object matching className + classSource from the data file.
 * Skips entries with _copy (those are derivative stubs).
 */
export function getClassObject(data, className, classSource) {
    if (!data?.class) return null;
    return data.class.find(c =>
        c.name === className &&
        c.source === classSource &&
        !c._copy
    ) || data.class.find(c =>
        c.name === className &&
        c.source === classSource
    ) || null;
}

/**
 * List available classes with their sources from a data file.
 * Returns [{ name, source }] excluding _copy stubs.
 */
export function listClasses(data) {
    if (!data?.class) return [];
    return data.class
        .filter(c => !c._copy)
        .map(c => ({ name: c.name, source: c.source }));
}

/**
 * List available subclasses for a given class/source.
 * Includes _copy subclasses (cross-source compatibility entries like XGE
 * subclasses available for the XPHB base class).
 */
export function getSubclasses(data, className, classSource) {
    if (!data?.subclass) return [];
    return data.subclass
        .filter(s =>
            s.className === className &&
            s.classSource === classSource
        )
        .map(s => ({
            name: s.name,
            shortName: s.shortName,
            source: s.source,
            isCopy: !!s._copy,
        }));
}

/**
 * Get class features up to maxLevel.
 * Includes _copy features, resolving them to the originals for content.
 */
export function getClassFeatures(data, className, classSource, maxLevel) {
    if (!data?.classFeature) return [];
    const feats = data.classFeature.filter(f =>
        f.className === className &&
        f.classSource === classSource &&
        f.level <= maxLevel
    );
    return feats.map(f => f._copy ? resolveFeatureCopy(data.classFeature, f) : f);
}

/**
 * Get subclass features up to maxLevel.
 * Uses the subclass's subclassFeatures manifest to correctly resolve
 * cross-source features (e.g. XGE Divine Soul on XPHB Sorcerer).
 */
export function getSubclassFeatures(data, subShortName, subSource, className, classSource, maxLevel) {
    if (!data?.subclassFeature) return [];

    const subclass = data.subclass?.find(s =>
        s.className === className &&
        s.classSource === classSource &&
        s.shortName === subShortName &&
        s.source === subSource
    );

    if (subclass?.subclassFeatures?.length) {
        return resolveSubclassManifest(data, subclass.subclassFeatures, maxLevel);
    }

    return data.subclassFeature.filter(f =>
        f.className === className &&
        f.classSource === classSource &&
        f.subclassShortName === subShortName &&
        f.subclassSource === subSource &&
        f.level <= maxLevel
    );
}

/**
 * Parse a subclassFeatures manifest and resolve each entry to a real feature.
 * Manifest format: "name|className|classSource|subShortName|subSource|level"
 * When a manifest entry is a _copy, also pulls in sibling features from the
 * same original level (e.g. Divine Magic + Favored by the Gods alongside
 * the main Divine Soul feature).
 */
function resolveSubclassManifest(data, manifest, maxLevel) {
    const results = [];
    const added = new Set();

    for (const ref of manifest) {
        const parts = ref.split('|');
        const fName = parts[0];
        const fClsSrc = parts[2] || null;
        const fSubShort = parts[3] || null;
        const fSubSrc = parts[4] || null;
        const fLevel = parseInt(parts[5]);
        if (isNaN(fLevel) || fLevel > maxLevel) continue;

        let feat = findSubclassFeature(data, fName, fLevel, fClsSrc, fSubShort, fSubSrc);

        if (feat?._copy) {
            const copyInfo = feat._copy;
            const siblings = findSiblingFeatures(data, copyInfo, fSubShort, fSubSrc);
            for (const sib of siblings) {
                const key = `${sib.name}|${fLevel}`;
                if (added.has(key)) continue;
                added.add(key);
                results.push({ ...sib, level: fLevel, classSource: feat.classSource });
            }
        } else if (feat) {
            const key = `${feat.name}|${feat.level}`;
            if (!added.has(key)) {
                added.add(key);
                results.push(feat);
            }
        }
    }
    return results;
}

function findSubclassFeature(data, name, level, classSource, subShort, subSource) {
    const all = data.subclassFeature || [];
    if (classSource) {
        const exact = all.find(f =>
            f.name === name && f.level === level &&
            f.classSource === classSource &&
            (!subShort || f.subclassShortName === subShort) &&
            (!subSource || f.subclassSource === subSource)
        );
        if (exact) return exact;
    }
    return all.find(f =>
        f.name === name && f.level === level &&
        (!subShort || f.subclassShortName === subShort) &&
        (!subSource || f.subclassSource === subSource) &&
        !f._copy
    ) || null;
}

/**
 * Find all non-copy sibling features at the same original level/class/subclass.
 */
function findSiblingFeatures(data, copyInfo, subShort, subSource) {
    const all = data.subclassFeature || [];
    return all.filter(f =>
        f.className === copyInfo.className &&
        f.classSource === copyInfo.classSource &&
        f.subclassShortName === (copyInfo.subclassShortName || subShort) &&
        f.subclassSource === (copyInfo.subclassSource || subSource) &&
        f.level === copyInfo.level &&
        !f._copy
    );
}

/**
 * Build class table data up to maxLevel.
 * Returns { colGroups, colLabels, rows }.
 * colGroups: [{ title, span }] for a grouped header row.
 */
export function buildClassTable(classObj, maxLevel) {
    const groups = classObj?.classTableGroups || [];
    const colLabels = ['Lvl', 'Prof'];
    const colGroups = [{ title: '', span: 2 }];
    const rows = [];

    for (const g of groups) {
        const labels = Array.isArray(g.colLabels) ? g.colLabels : [];
        const span = labels.length;
        colGroups.push({ title: g.title || '', span });
        for (const label of labels) {
            colLabels.push(abbreviateLabel(stripTags(label)));
        }
    }

    for (let lvl = 0; lvl < maxLevel; lvl++) {
        const row = [lvl + 1, `+${Math.ceil((lvl + 1) / 4) + 1}`];
        for (const g of groups) {
            const gRow = g.rows?.[lvl] ?? g.rowsSpellProgression?.[lvl];
            if (Array.isArray(gRow)) {
                for (const val of gRow) {
                    row.push(formatTableCell(val));
                }
            }
        }
        rows.push(row);
    }

    return { colGroups, colLabels, rows };
}

const LABEL_ABBREVIATIONS = {
    'sorcery points': 'SP',
    'cantrips known': 'Cntrp',
    'spells known': 'Spells',
    'spells prepared': 'Prep',
    'spell slots': 'Slots',
    'ki points': 'Ki',
    'rages': 'Rages',
    'rage damage': 'R.Dmg',
    'martial arts': 'MA',
    'sneak attack': 'Sneak',
    'unarmored movement': 'Move',
    'invocations known': 'Invoc',
    'cantrips': 'Cntrp',
};

function abbreviateLabel(label) {
    const lower = label.toLowerCase();
    if (LABEL_ABBREVIATIONS[lower]) return LABEL_ABBREVIATIONS[lower];
    if (/^\d+(st|nd|rd|th)$/.test(label)) return label;
    return label;
}

function formatTableCell(val) {
    if (val === 0) return '—';
    if (typeof val === 'object' && val !== null) {
        if (val.type === 'bonus') return `+${val.value}`;
        if (val.type === 'dice') {
            const d = val.toRoll?.[0];
            return d ? `${d.number}d${d.faces}` : String(val);
        }
        return JSON.stringify(val);
    }
    return String(val);
}

/**
 * Format proficiencies from a class object for display.
 */
export function formatProficiencies(classObj) {
    if (!classObj) return {};
    const saves = (classObj.proficiency || []).map(p => ABILITY_NAMES[p] || p.toUpperCase());
    const hd = classObj.hd ? `${classObj.hd.number}d${classObj.hd.faces}` : '?';
    return { saves, hd };
}

function stripTags(str) {
    if (typeof str !== 'string') return String(str ?? '');
    return str.replace(/{@\w+ ([^}|]+)(?:\|[^}]*)?\}/g, '$1');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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

/**
 * Flatten 5e.tools entry arrays into HTML.
 * Resolves refOptionalfeature entries from the cached optional features data.
 * Each distinct block (named entry, optional feature, list item) gets its own line.
 */
export function flattenEntries(entries, depth = 0) {
    if (!Array.isArray(entries)) return '';
    const blocks = [];
    for (const e of entries) {
        if (typeof e === 'string') {
            blocks.push({ html: stripTags(e), block: false });
        } else if (e?.type === 'options' && Array.isArray(e.entries)) {
            blocks.push({ html: flattenEntries(e.entries, depth + 1), block: true });
        } else if (e?.type === 'refOptionalfeature' && e.optionalfeature) {
            const resolved = _optFeatures?.get(e.optionalfeature);
            if (resolved) {
                let html = `<strong>${escapeHtml(resolved.name)}.</strong>`;
                if (resolved.entries) html += ' ' + flattenEntries(resolved.entries, depth + 1);
                blocks.push({ html, block: true });
            } else {
                const name = e.optionalfeature.split('|')[0];
                blocks.push({ html: `\u2022 ${escapeHtml(name)}`, block: true });
            }
        } else if (e?.entries) {
            let html = '';
            if (e.name) html += `<strong>${escapeHtml(stripTags(e.name))}.</strong> `;
            html += flattenEntries(e.entries, depth + 1);
            blocks.push({ html, block: !!e.name });
        } else if (e?.type === 'list' && Array.isArray(e.items)) {
            for (const item of e.items) {
                if (typeof item === 'string') {
                    blocks.push({ html: `\u2022 ${stripTags(item)}`, block: true });
                } else if (item?.entries) {
                    let html = item.name ? `\u2022 <strong>${escapeHtml(stripTags(item.name))}.</strong> ` : '\u2022 ';
                    html += flattenEntries(item.entries, depth + 1);
                    blocks.push({ html, block: true });
                }
            }
        } else if (e?.type === 'table') {
            blocks.push({ html: renderInlineTable(e), block: true });
        } else if (e?.type === 'abilityDc' || e?.type === 'abilityAttackMod') {
            blocks.push({ html: `<em>${escapeHtml(e.name)} = 8 + proficiency + ${(e.attributes || []).map(a => ABILITY_NAMES[a] || a).join('/')}</em>`, block: true });
        }
    }

    const parts = [];
    for (const b of blocks) {
        if (b.block && parts.length > 0) parts.push('<br>');
        parts.push(b.html);
    }
    return parts.join(' ');
}

/**
 * Ensure class data and optional features are loaded for the current character config.
 */
export async function ensureCharacterData() {
    if (!character?.classFile) return null;
    const [classData] = await Promise.all([
        fetchClassData(character.classFile),
        fetchOptionalFeatures(),
    ]);
    return classData;
}

/**
 * Save a character config.
 */
export function saveCharacterConfig(config) {
    setCharacter(config);
    saveCharacter(config);
}

/**
 * Clear the current character.
 */
export function clearCharacter() {
    setCharacter(null);
    saveCharacter(null);
}
