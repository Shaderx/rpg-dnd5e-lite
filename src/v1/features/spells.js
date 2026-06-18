/**
 * V1 Character System - Spells
 * Class-based spell management: fetch spell data, filter by class list,
 * compute damage/healing annotations with cantrip scaling and class bonuses.
 */

import { fetchSpellSource, fetchSpellClassLookup } from '../data/sources.js';
import { CANTRIP_BREAKPOINTS, SPELL_SCHOOLS, getModifier } from '../core/constants.js';

const V1_SPELL_SOURCES = ['xphb', 'xge'];

let _allSpells = null;
let _allSpellsInflight = null;

/**
 * Preload all spell data from configured sources, deduplicating by name.
 */
export async function preloadSpellData() {
    if (_allSpells) return _allSpells;
    if (_allSpellsInflight) return _allSpellsInflight;

    _allSpellsInflight = Promise.all([
        ...V1_SPELL_SOURCES.map(s => fetchSpellSource(s)),
        fetchSpellClassLookup(),
    ]).then(results => {
        const seen = new Set();
        const spells = [];
        for (let i = 0; i < V1_SPELL_SOURCES.length; i++) {
            if (!results[i]) continue;
            for (const spell of results[i]) {
                const key = spell.name.toLowerCase();
                if (!seen.has(key)) {
                    seen.add(key);
                    spells.push(spell);
                }
            }
        }
        _allSpells = spells;
        _allSpellsInflight = null;
        return spells;
    });
    return _allSpellsInflight;
}

/**
 * Get spells available to a class, filtered by level.
 * @param {string} classKey - Lowercase class name
 * @param {number} maxSpellLevel - Max spell level to include
 * @returns {Promise<object[]>}
 */
export async function getClassSpells(classKey, maxSpellLevel) {
    const [spells, lookup] = await Promise.all([
        preloadSpellData(),
        fetchSpellClassLookup(),
    ]);

    if (!spells) return [];
    const lk = lookup || {};

    return spells.filter(spell => {
        if (spell.level > maxSpellLevel) return false;
        return isSpellOnClassList(spell, classKey, lk);
    });
}

/**
 * Get cantrips available to a class.
 */
export async function getClassCantrips(classKey) {
    return getClassSpells(classKey, 0);
}

/**
 * Check if a spell is on a class's spell list via the class lookup table.
 * Mirrors the working sidekick implementation: lookup[sourceLower][nameLower].class/classVariant
 */
function isSpellOnClassList(spell, classKey, lookup) {
    const srcKey = (spell.source || '').toLowerCase();
    const nameKey = (spell.name || '').toLowerCase();
    const capClass = capitalize(classKey);

    const entry = lookup[srcKey]?.[nameKey];
    if (entry) {
        for (const section of [entry.class, entry.classVariant]) {
            if (!section) continue;
            for (const classSrc of Object.values(section)) {
                if (classSrc[classKey] || classSrc[capClass]) return true;
            }
        }
    }

    // Fallback: check spell's own class references
    if (spell.classes?.fromClassList) {
        return spell.classes.fromClassList.some(
            c => c.name.toLowerCase() === classKey
        );
    }

    return false;
}

function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Lookup a spell by name from the loaded cache.
 */
export async function lookupSpell(spellName) {
    const spells = await preloadSpellData();
    if (!spells) return null;
    const lowerName = spellName.toLowerCase();
    return spells.find(s => s.name.toLowerCase() === lowerName) || null;
}

/**
 * Lookup a spell synchronously from the already-loaded cache.
 */
export function lookupSpellSync(spellName) {
    if (!_allSpells) return null;
    const lowerName = spellName.toLowerCase();
    return _allSpells.find(s => s.name.toLowerCase() === lowerName) || null;
}

/**
 * Get spell damage/healing info with scaling and class bonuses.
 * Enhanced version of the sidekick getSpellDamageInfo with upcasting support.
 *
 * @param {string} spellName
 * @param {number} characterLevel - For cantrip scaling breakpoints
 * @param {object} [bonuses] - { potentMod, empoweredSchool, empoweredMod, healingBonus }
 * @returns {object|null}
 */
export function getSpellDamageInfo(spellName, characterLevel, bonuses = {}) {
    const spell = lookupSpellSync(spellName);
    if (!spell) return null;

    const { potentMod = 0, empoweredSchool, empoweredMod = 0, healingBonusFn } = bonuses;

    const dmgTypes = spell.damageInflict || [];
    const dmgType = dmgTypes[0] || '';
    const isCantrip = spell.level === 0;
    const school = spell.school || '';
    const miscTags = spell.miscTags || [];
    const isHealing = miscTags.includes('HL');
    const savingThrow = (spell.savingThrow || [])[0] || null;
    const spellAttack = (spell.spellAttack || [])[0] || null;
    const conditionInflict = spell.conditionInflict || [];

    const entriesStr = (spell.entries || [])
        .map(e => typeof e === 'string' ? e : '')
        .join(' ');

    // Extract base damage dice
    let baseDice = null;
    const dmgMatch = entriesStr.match(/\{@damage\s+([^}]+)\}/);
    if (dmgMatch) baseDice = dmgMatch[1].trim();

    // Extract healing dice
    let healDice = null;
    if (isHealing) {
        const healMatch = entriesStr.match(/\{@dice\s+([^}]+)\}/);
        if (healMatch) healDice = healMatch[1].trim();
        if (!healDice && baseDice) healDice = baseDice;
    }

    // Compute bonus modifier from class features
    let bonusMod = 0;
    if (isCantrip && potentMod) {
        bonusMod = potentMod;
    } else if (!isCantrip && empoweredSchool && school === empoweredSchool && empoweredMod) {
        bonusMod = empoweredMod;
    }

    // Cantrip scaling
    let dice = baseDice;
    let scaling = false;
    if (isCantrip && spell.scalingLevelDice?.scaling) {
        scaling = true;
        const scaleTable = spell.scalingLevelDice.scaling;
        dice = baseDice || scaleTable['1'] || null;
        for (const bp of CANTRIP_BREAKPOINTS) {
            if (characterLevel >= bp && scaleTable[String(bp)]) {
                dice = scaleTable[String(bp)];
            }
        }
    }

    // Apply bonus mod to dice string
    if (dice && bonusMod > 0) {
        dice = `${dice} + ${bonusMod}`;
    }
    if (healDice && bonusMod > 0) {
        healDice = `${healDice} + ${bonusMod}`;
    }

    // Healing class bonus (e.g. Life Domain: +2+spell level)
    let healingClassBonus = null;
    if (isHealing && healingBonusFn) {
        healingClassBonus = healingBonusFn(spell.level);
    }
    if (healDice && healingClassBonus) {
        healDice = `${healDice} + ${healingClassBonus}`;
    }

    // Upcasting info
    let upcastInfo = null;
    if (!isCantrip && spell.entriesHigherLevel) {
        upcastInfo = parseUpcastInfo(spell.entriesHigherLevel);
    }

    return {
        dice,
        type: dmgType,
        isCantrip,
        scaling,
        school,
        schoolName: SPELL_SCHOOLS[school] || school,
        isHealing,
        healDice,
        healingClassBonus,
        savingThrow,
        spellAttack,
        conditionInflict,
        spellLevel: spell.level,
        upcastInfo,
        hasDamageAndHeal: !!(baseDice && isHealing),
    };
}

/**
 * Parse upcasting information from entriesHigherLevel.
 * Extracts the dice scaling pattern for annotations.
 */
function parseUpcastInfo(entries) {
    if (!entries || !Array.isArray(entries)) return null;

    for (const entry of entries) {
        const text = typeof entry === 'string'
            ? entry
            : (entry.entries || []).map(e => typeof e === 'string' ? e : '').join(' ');

        // Match patterns like "1d8 for each slot level above 1st"
        const diceMatch = text.match(/\{@(?:damage|dice)\s+(\d+d\d+)\}.*?(?:each|every)\s+(?:slot\s+)?level\s+above\s+(\d+)/i);
        if (diceMatch) {
            return { dice: diceMatch[1], aboveLevel: parseInt(diceMatch[2]) || 1 };
        }

        // Match patterns like "increases by 1d6"
        const incMatch = text.match(/increases?\s+by\s+\{@(?:damage|dice)\s+(\d+d\d+)\}/i);
        if (incMatch) {
            return { dice: incMatch[1], aboveLevel: entries[0]?.level || 1 };
        }
    }
    return null;
}

/**
 * Build a spell annotation string for prompt injection.
 * Enhanced version with upcasting info and dual damage/heal support.
 */
export function buildSpellAnnotation(spellName, info) {
    if (!info) return spellName;

    const parts = [];

    if (info.hasDamageAndHeal && info.dice) {
        parts.push(`${info.dice}${info.type ? ' ' + info.type : ''} + heal`);
    } else if (info.isHealing && info.healDice) {
        parts.push(`heal ${info.healDice}`);
    } else if (info.dice) {
        parts.push(`${info.dice}${info.type ? ' ' + info.type : ''}`);
    }

    if (info.savingThrow) {
        parts.push(`${info.savingThrow.substring(0, 3).toUpperCase()} save`);
    } else if (info.spellAttack) {
        parts.push(info.spellAttack === 'R' ? 'ranged atk' : 'melee atk');
    }

    if (info.conditionInflict?.length > 0) {
        parts.push(info.conditionInflict.join('/'));
    }

    if (info.upcastInfo) {
        parts.push(`+${info.upcastInfo.dice}/slot above ${ordinal(info.upcastInfo.aboveLevel)}`);
    }

    return parts.length > 0 ? `${spellName} (${parts.join(', ')})` : spellName;
}

function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Get the maximum spell level available from a slot array.
 */
export function getMaxSpellLevel(slots) {
    if (!slots) return 0;
    for (let i = slots.length - 1; i >= 0; i--) {
        if (slots[i] > 0) return i + 1;
    }
    return 0;
}

/**
 * Format a spell slots array as a display string.
 */
export function formatSlots(slots) {
    if (!slots) return 'none';
    const nonZero = [];
    for (let i = 0; i < slots.length; i++) {
        if (slots[i] > 0) nonZero.push(`${ordinal(i + 1)}: ${slots[i]}`);
    }
    return nonZero.length > 0 ? nonZero.join(', ') : 'none';
}
