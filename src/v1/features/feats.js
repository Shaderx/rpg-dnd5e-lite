/**
 * V1 Character System - Feats
 * Fetch feat data from CDN, categorize origin vs general feats,
 * provide feat picker helpers.
 */

import { fetchFeats } from '../data/sources.js';

let _parsedFeats = null;

/**
 * Get all feats, categorized.
 * @returns {Promise<object[]>}
 */
export async function getAllFeats() {
    if (_parsedFeats) return _parsedFeats;
    const raw = await fetchFeats();
    if (!raw) { _parsedFeats = []; return []; }
    _parsedFeats = raw.map(parseFeat);
    return _parsedFeats;
}

/**
 * Get origin feats (level 1, granted by backgrounds).
 */
export async function getOriginFeats() {
    const all = await getAllFeats();
    return all.filter(f => f.category === 'Origin');
}

/**
 * Get general feats (available at ASI levels).
 */
export async function getGeneralFeats() {
    const all = await getAllFeats();
    return all.filter(f => f.category === 'General');
}

/**
 * Get feats available at a given level (respects prereq level).
 */
export async function getFeatsForLevel(level) {
    const all = await getAllFeats();
    return all.filter(f => {
        if (f.category === 'Origin') return false;
        if (f.prereqLevel && level < f.prereqLevel) return false;
        return true;
    });
}

/**
 * Find a feat by name.
 */
export async function findFeat(name) {
    const all = await getAllFeats();
    return all.find(f => f.name.toLowerCase() === name.toLowerCase()) || null;
}

/**
 * Parse a raw 5e.tools feat into our format.
 */
function parseFeat(feat) {
    let category = 'General';
    if (feat.category) {
        category = feat.category;
    } else if (feat.prerequisite) {
        for (const pre of feat.prerequisite) {
            if (pre.level && typeof pre.level === 'object' && pre.level.level <= 1) {
                category = 'Origin';
            }
        }
    }

    let prereqLevel = null;
    let prereqAbility = null;
    if (feat.prerequisite) {
        for (const pre of feat.prerequisite) {
            if (pre.level) {
                prereqLevel = typeof pre.level === 'object' ? pre.level.level : pre.level;
            }
            if (pre.ability) prereqAbility = pre.ability;
        }
    }

    // Ability score options the feat can grant
    const abilityOptions = [];
    if (feat.ability) {
        for (const group of feat.ability) {
            if (group.choose) {
                abilityOptions.push({
                    choose: true,
                    from: group.choose.from || [],
                    count: group.choose.count || 1,
                    amount: group.choose.amount || 1,
                });
            } else {
                for (const [key, val] of Object.entries(group)) {
                    abilityOptions.push({ ability: key, bonus: val });
                }
            }
        }
    }

    // Extract mechanical description
    const description = flattenFeatEntries(feat.entries || []);

    return {
        name: feat.name,
        source: feat.source,
        category,
        prereqLevel,
        prereqAbility,
        abilityOptions,
        description,
        repeatable: !!feat.repeatable,
        _raw: feat,
    };
}

function flattenFeatEntries(entries) {
    const parts = [];
    for (const e of entries) {
        if (typeof e === 'string') {
            parts.push(stripTags(e));
        } else if (e?.type === 'list' && e.items) {
            for (const item of e.items) {
                if (typeof item === 'string') parts.push('- ' + stripTags(item));
                else if (item.name && item.entry) parts.push(`- ${item.name}: ${stripTags(item.entry)}`);
                else if (item.name && item.entries) parts.push(`- ${item.name}: ${flattenFeatEntries(item.entries)}`);
                else if (item.entries) parts.push('- ' + flattenFeatEntries(item.entries));
            }
        } else if (e?.entries) {
            if (e.name) parts.push(`${e.name}: ${flattenFeatEntries(e.entries)}`);
            else parts.push(flattenFeatEntries(e.entries));
        }
    }
    return parts.join(' ').replace(/\s{2,}/g, ' ').trim();
}

function stripTags(str) {
    if (!str) return '';
    return str
        .replace(/\{@\w+\s+([^|}]+?)(?:\|[^}]*)?\}/g, '$1')
        .replace(/\{@\w+\s+([^}]+)\}/g, '$1');
}
