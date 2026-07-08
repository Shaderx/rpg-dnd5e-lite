/**
 * V1 Character System - Spells
 * Class-based spell management: fetch spell data, filter by class list,
 * compute damage/healing annotations with cantrip scaling and class bonuses.
 */

import { fetchSpellSource, fetchSpellClassLookup } from '../data/sources.js';
import { CANTRIP_BREAKPOINTS, SPELL_SCHOOLS, getModifier } from '../core/constants.js';
import {
    buildUpcastTable,
    parseUpcastInfo,
    parseUpcastExtra,
    formatSpellRange,
    parseCantripRangeScaling,
    parseBeamCount,
    getStatsAtCastLevel,
    ordinal,
    collectSpellScalingText,
    isPlayerChosenDamageType,
    hasPrimaryDamage,
} from '../../features/spellScaling.js';

const V1_SPELL_SOURCES = ['xphb', 'xge'];

let _allSpells = null;
let _allSpellsInflight = null;

export function clearSpellMemory() {
    _allSpells = null;
    _allSpellsInflight = null;
}

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

    const { potentMod = 0, empoweredSchool, empoweredMod = 0, empoweredDamageType, empoweredDamageTypeMod = 0, healingBonusFn, castLevel = null, chosenElement = null } = bonuses;

    const dmgTypes = spell.damageInflict || [];
    const dmgType = dmgTypes[0] || '';
    const isCantrip = spell.level === 0;
    const school = spell.school || '';
    const miscTags = spell.miscTags || [];
    const isHealing = miscTags.includes('HL');
    const savingThrow = (spell.savingThrow || [])[0] || null;
    const spellAttack = (spell.spellAttack || [])[0] || null;
    const conditionInflict = spell.conditionInflict || [];

    const entriesStr = collectSpellScalingText(spell);
    const isChosenType = isPlayerChosenDamageType(spell, entriesStr);
    const omitDamageType = isChosenType && !chosenElement;
    const effectiveDmgTypes = chosenElement ? [chosenElement] : dmgTypes;

    let baseDice = null;
    if (hasPrimaryDamage(spell)) {
        const dmgMatch = entriesStr.match(/\{@damage\s+([^}]+)\}/);
        if (dmgMatch) baseDice = dmgMatch[1].trim().split('+')[0].trim();
    }

    let healDice = null;
    if (isHealing) {
        const healMatch = entriesStr.match(/\{@dice\s+([^}]+)\}/);
        if (healMatch) healDice = healMatch[1].trim().split('+')[0].trim();
        if (!healDice && baseDice) healDice = baseDice;
    }

    let bonusMod = 0;
    if (isCantrip && potentMod) {
        bonusMod = potentMod;
    } else if (!isCantrip && empoweredSchool && school === empoweredSchool && empoweredMod) {
        bonusMod = empoweredMod;
    }
    if (empoweredDamageType && empoweredDamageTypeMod && effectiveDmgTypes.includes(empoweredDamageType)) {
        bonusMod = Math.max(bonusMod, empoweredDamageTypeMod);
    }

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

    if (dice && bonusMod > 0) dice = `${dice} + ${bonusMod}`;
    if (healDice && bonusMod > 0) healDice = `${healDice} + ${bonusMod}`;

    let healingClassBonus = null;
    if (isHealing && healingBonusFn) {
        healingClassBonus = healingBonusFn(spell.level);
    }
    if (healDice && healingClassBonus) {
        healDice = `${healDice} + ${healingClassBonus}`;
    }

    const baseRange = formatSpellRange(spell.range);
    const range = isCantrip
        ? parseCantripRangeScaling(entriesStr, characterLevel, baseRange)
        : baseRange;
    const beamCount = isCantrip ? parseBeamCount(entriesStr, characterLevel) : 1;

    let upcastInfo = null;
    let upcastExtra = null;
    let upcastTable = null;
    if (!isCantrip && spell.entriesHigherLevel) {
        upcastInfo = parseUpcastInfo(spell.entriesHigherLevel, spell.level);
        upcastExtra = parseUpcastExtra(spell.entriesHigherLevel);
        const rawBaseDice = baseDice || healDice;
        if (rawBaseDice && upcastInfo) {
            upcastTable = buildUpcastTable(baseDice, healDice, upcastInfo, spell.level);
            if (bonusMod > 0) {
                for (const slot of Object.keys(upcastTable)) {
                    const row = upcastTable[slot];
                    if (row.dice) row.dice = `${row.dice} + ${bonusMod}`;
                    if (row.healDice) row.healDice = `${row.healDice} + ${bonusMod}`;
                }
            }
            if (healingClassBonus) {
                for (const slot of Object.keys(upcastTable)) {
                    if (upcastTable[slot].healDice) {
                        upcastTable[slot].healDice = `${upcastTable[slot].healDice} + ${healingClassBonus}`;
                    }
                }
            }
        }
    }

    const atCast = castLevel != null ? getStatsAtCastLevel({ dice, healDice, upcastTable }, castLevel) : null;

    return {
        dice,
        type: omitDamageType ? '' : (chosenElement || dmgType),
        omitDamageType,
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
        upcastExtra,
        upcastTable,
        hasDamageAndHeal: !!(baseDice && isHealing),
        range,
        baseRange,
        beamCount,
        castLevel,
        atCastLevel: atCast,
    };
}

/**
 * Build a spell annotation string for prompt injection.
 */
export function buildSpellAnnotation(spellName, info) {
    if (!info) return spellName;

    const parts = [];
    const dice = info.atCastLevel?.dice ?? info.dice;
    const healDice = info.atCastLevel?.healDice ?? info.healDice;

    if (info.hasDamageAndHeal && dice) {
        parts.push(`${dice}${!info.omitDamageType && info.type ? ' ' + info.type : ''} + heal`);
    } else if (info.isHealing && healDice) {
        parts.push(`heal ${healDice}`);
    } else if (dice) {
        parts.push(`${dice}${!info.omitDamageType && info.type ? ' ' + info.type : ''}`);
    }

    if (info.savingThrow) {
        parts.push(`${info.savingThrow.substring(0, 3).toUpperCase()} save`);
    } else if (info.spellAttack) {
        parts.push(info.spellAttack === 'R' ? 'ranged atk' : 'melee atk');
    }

    if (info.conditionInflict?.length > 0) {
        parts.push(info.conditionInflict.join('/'));
    }

    if (info.range && info.baseRange && info.range !== info.baseRange) {
        parts.push(`range ${info.range}`);
    }

    if (info.beamCount > 1) {
        parts.push(`${info.beamCount} beams`);
    }

    if (info.castLevel != null && info.upcastInfo && !info.atCastLevel) {
        parts.push(`cast at ${ordinal(info.castLevel)}`);
    }

    if (info.upcastInfo && !info.castLevel) {
        parts.push(`+${info.upcastInfo.dice}/slot above ${ordinal(info.upcastInfo.aboveLevel)}`);
    }

    return parts.length > 0 ? `${spellName} (${parts.join(', ')})` : spellName;
}

// Re-export for inject prompt formatting
export { formatSpellRange, getStatsAtCastLevel, ordinal } from '../../features/spellScaling.js';

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
