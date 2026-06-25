/**
 * V2 Free Cast Tracker
 * Derives free cast availability from the spell log (stateless).
 * Detects [Spell, Level, Free] casts and resets on long/short rest.
 */

const FREE_KEYWORD_RE = /\bfree\b/i;

/**
 * Normalize a freeCast value to a recharge type or null (skip tracking).
 * @param {string|boolean} freeCast
 * @returns {'LR'|'SR'|null}
 */
function normalizeRecharge(freeCast) {
    if (!freeCast || freeCast === 'at will') return null;
    if (freeCast === true || freeCast === '1/LR') return 'LR';
    if (freeCast === '1/SR') return 'SR';
    return null;
}

/**
 * Format a freeCast label for display (e.g. "1/LR").
 * @param {string|boolean} freeCast
 * @returns {string}
 */
export function formatFreeCastLabel(freeCast) {
    if (!freeCast) return '';
    if (freeCast === true) return '1/LR';
    return String(freeCast);
}

/**
 * Collect all trackable free-cast spells from character data.
 * @param {object} char - V2 character object
 * @param {object} stats - Output of computeV2CharacterStats()
 * @returns {Array<{ name: string, recharge: 'LR'|'SR', label: string }>}
 */
export function buildFreeCastRegistry(char, stats) {
    const entries = [];
    const seen = new Set();

    for (const entry of (char?.extraSpells || [])) {
        const name = typeof entry === 'string' ? entry : entry?.name;
        if (!name) continue;
        const freeCast = typeof entry === 'object' ? entry.freeCast : '';
        const recharge = normalizeRecharge(freeCast);
        if (!recharge) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push({ name, recharge, label: formatFreeCastLabel(freeCast) });
    }

    for (const spell of (stats?.featBonusSpells || [])) {
        if (!spell?.name || !spell.freeCast) continue;
        const recharge = normalizeRecharge(spell.freeCast);
        if (!recharge) continue;
        const key = spell.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push({ name: spell.name, recharge, label: formatFreeCastLabel(spell.freeCast) });
    }

    return entries;
}

/**
 * Find the spell log index to start scanning from for a given recharge type.
 * @param {Array} log
 * @param {'LR'|'SR'} recharge
 * @returns {number}
 */
function findScanStartIndex(log, recharge) {
    if (!log?.length) return 0;

    for (let i = log.length - 1; i >= 0; i--) {
        const entry = log[i];
        if (entry.type === 'rest') return i + 1;
        if (recharge === 'SR' && entry.type === 'short-rest') return i + 1;
    }

    return 0;
}

/**
 * Whether a spell log cast entry used the free cast keyword.
 * @param {object} entry
 * @returns {boolean}
 */
function isFreeCastEntry(entry) {
    if (entry.type !== 'cast') return false;
    return FREE_KEYWORD_RE.test(entry.details || '');
}

/**
 * Count free casts for a spell since the given scan start index.
 * @param {Array} log
 * @param {number} startIdx
 * @param {string} spellName
 * @returns {number}
 */
function countFreeCastsSince(log, startIdx, spellName) {
    const target = spellName.toLowerCase();
    let used = 0;

    for (let i = startIdx; i < log.length; i++) {
        const entry = log[i];
        if (!isFreeCastEntry(entry)) continue;
        if ((entry.spell || '').toLowerCase() === target) used++;
    }

    return used;
}

/**
 * Compute free cast usage for all registered spells.
 * @param {object} char - V2 character object
 * @param {object} stats - Output of computeV2CharacterStats()
 * @param {Array} log - Spell log entries
 * @returns {Map<string, { name: string, max: number, used: number, recharge: string, label: string, available: boolean }>}
 */
export function computeFreeCastUsage(char, stats, log) {
    const registry = buildFreeCastRegistry(char, stats);
    const usageMap = new Map();

    for (const entry of registry) {
        const key = entry.name.toLowerCase();
        const startIdx = findScanStartIndex(log, entry.recharge);
        const used = countFreeCastsSince(log, startIdx, entry.name);
        const max = 1;

        usageMap.set(key, {
            name: entry.name,
            max,
            used: Math.min(used, max),
            recharge: entry.recharge,
            label: entry.label,
            available: used < max,
        });
    }

    return usageMap;
}

/**
 * Look up usage for a spell by name (case-insensitive).
 * @param {Map} usageMap
 * @param {string} spellName
 * @returns {{ available: boolean, label: string }|null}
 */
export function getFreeCastUsage(usageMap, spellName) {
    if (!usageMap || !spellName) return null;
    return usageMap.get(spellName.toLowerCase()) || null;
}

/**
 * Format free cast status for prompt injection.
 * @param {string|boolean} freeCast - Original freeCast value
 * @param {Map} usageMap
 * @param {string} spellName
 * @returns {string} e.g. " [1/LR free: AVAILABLE]" or ""
 */
export function formatFreeCastPromptTag(freeCast, usageMap, spellName) {
    if (!freeCast) return '';
    if (freeCast === 'at will') return ` [${freeCast} free]`;

    const label = formatFreeCastLabel(freeCast);
    const usage = getFreeCastUsage(usageMap, spellName);
    const status = usage?.available === false ? 'USED' : 'AVAILABLE';
    return ` [${label} free: ${status}]`;
}
