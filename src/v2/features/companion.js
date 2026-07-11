/**
 * V2 Companion Module - Data & Scaling
 * Provides creature lists, steed template, and stat computation helpers
 * for the standalone companion card system.
 */

import { FAMILIAR_CREATURES, PRIMAL_COMPANIONS, computeCompanionStats } from './levelFeatures.js';
import { v2Companions, createDefaultCompanion } from '../core/state.js';
import { saveV2Companions } from '../core/persistence.js';
import { character } from '../../core/state.js';
import { getProficiencyBonus } from '../core/constants.js';

// Re-export for convenience
export { FAMILIAR_CREATURES, PRIMAL_COMPANIONS, computeCompanionStats };

// ============================================================
// CATEGORY METADATA
// ============================================================

export const CATEGORY_META = {
    familiar: { label: 'Familiar', icon: 'fa-dove', color: '#8e6cef' },
    primal: { label: 'Primal Companion', icon: 'fa-paw', color: '#4da84d' },
    steed: { label: 'Otherworldly Steed', icon: 'fa-horse', color: '#d4943a' },
};

export const CREATURE_TYPE_OPTIONS = ['celestial', 'fey', 'fiend'];

// ============================================================
// OTHERWORLDLY STEED TEMPLATE (PHB 2024)
// ============================================================

export const STEED_TEMPLATE = {
    label: 'Otherworldly Steed',
    size: 'Large',
    type: 'Celestial/Fey/Fiend',
    speed: '60 ft',
    baseHp: 5,
    hpPerSlot: 10,
    baseAc: 10,
    acPerSlot: 1,
    flySpeedThreshold: 4,
    flySpeed: 60,
    str: 18, dex: 12, con: 14, int: 6, wis: 12, cha: 14,
    senses: '',
    skills: '',
    attack: { name: 'Otherworldly Strike', reach: '5 ft', damageDice: '1d8', damageType: 'radiant, psychic, or necrotic' },
    traits: {
        celestial: { name: 'Healing Touch (1/Long Rest)', desc: 'The steed touches a creature and restores 2d8 + its spell slot level hit points.' },
        fey: { name: 'Fey Step (1/Long Rest)', desc: 'The steed teleports up to 60 feet to an unoccupied space it can see, carrying its rider along.' },
        fiend: { name: 'Fell Glare (1/Long Rest)', desc: 'The steed targets one creature within 30 feet. The target must succeed on a Wisdom saving throw or be frightened until the end of its next turn.' },
    },
    sharedTraits: [
        { name: 'Life Bond', desc: 'When the steed drops to 0 hit points, it disappears, leaving behind no physical form. The steed reappears the next time you cast Find Steed.' },
    ],
};

/**
 * Compute scaled stats for an Otherworldly Steed.
 * @param {number} slotLevel - Spell slot level used to summon (2-9)
 * @param {string} creatureType - 'celestial', 'fey', or 'fiend'
 * @param {number} profBonus - Caster's proficiency bonus
 */
export function computeSteedStats(slotLevel, creatureType, profBonus) {
    const t = STEED_TEMPLATE;
    const hp = t.baseHp + (t.hpPerSlot * slotLevel);
    const ac = t.baseAc + (t.acPerSlot * slotLevel);
    const strMod = Math.floor((t.str - 10) / 2);
    const attackBonus = strMod + profBonus;
    const hasFly = slotLevel >= t.flySpeedThreshold;
    const speed = hasFly ? `${t.speed}, fly ${t.flySpeed} ft` : t.speed;

    const hitStr = attackBonus >= 0 ? `+${attackBonus}` : `${attackBonus}`;
    const actionDesc = `Melee Weapon Attack: ${hitStr} to hit, reach ${t.attack.reach}, one target. Hit: ${t.attack.damageDice} + ${slotLevel} ${t.attack.damageType} damage.`;

    const traits = [...t.sharedTraits];
    if (creatureType && t.traits[creatureType]) {
        traits.unshift(t.traits[creatureType]);
    }

    return {
        name: t.label,
        size: t.size,
        type: creatureType ? creatureType.charAt(0).toUpperCase() + creatureType.slice(1) : 'Otherworldly',
        speed,
        hp,
        ac,
        str: t.str, dex: t.dex, con: t.con,
        int: t.int, wis: t.wis, cha: t.cha,
        senses: t.senses,
        skills: t.skills,
        traits,
        actions: [{ name: t.attack.name, desc: actionDesc }],
        attackBonus,
        profBonus,
        hasFly,
    };
}

// ============================================================
// COMPANION CRUD
// ============================================================

/**
 * Build a companion object from a familiar creature key.
 */
export function buildFamiliarCompanion(creatureKey, customName, creatureType) {
    const creature = FAMILIAR_CREATURES[creatureKey];
    if (!creature) return null;

    return createDefaultCompanion({
        category: 'familiar',
        name: customName || creature.label,
        creatureName: creature.label,
        creatureSource: creatureKey,
        creatureType: creature.chainOnly ? creature.type.toLowerCase() : (creatureType || 'fey'),
        hp: { average: creature.hp, formula: '' },
        ac: creature.ac,
        speed: creature.speed,
        str: creature.str, dex: creature.dex, con: creature.con,
        int: creature.int, wis: creature.wis, cha: creature.cha,
        size: creature.size,
        senses: creature.senses || '',
        skills: creature.skills || '',
        actions: (creature.actions || []).map(a => ({ name: a.name, desc: a.desc })),
        traits: (creature.traits || []).map(t => ({ name: t.name, desc: t.desc })),
    });
}

/**
 * Build a companion object from a primal companion template key.
 */
export function buildPrimalCompanion(templateKey, customName, rangerLevel) {
    const base = PRIMAL_COMPANIONS[templateKey];
    if (!base) return null;

    const pb = getProficiencyBonus(rangerLevel || 1);
    const stats = computeCompanionStats(templateKey, rangerLevel || 3, pb, 0);
    if (!stats) return null;

    return createDefaultCompanion({
        category: 'primal',
        name: customName || base.label,
        creatureName: base.label,
        creatureSource: templateKey,
        creatureType: 'beast',
        hp: { average: stats.hp, formula: `${base.baseHP} + ${base.hpPerLevel} x ranger level` },
        ac: stats.ac,
        speed: base.speed,
        str: base.str, dex: base.dex, con: base.con,
        int: base.int, wis: base.wis, cha: base.cha,
        size: base.size,
        senses: '',
        skills: '',
        actions: (stats.actions || []).map(a => ({ name: a.name, desc: a.desc })),
        traits: (base.traits || []).map(t => ({ name: t.name, desc: t.desc })),
        scalingLevel: rangerLevel || 3,
    });
}

/**
 * Build a companion object from the steed template.
 */
export function buildSteedCompanion(customName, creatureType, slotLevel) {
    const pb = character?.level ? getProficiencyBonus(character.level) : 2;
    const stats = computeSteedStats(slotLevel || 2, creatureType || 'celestial', pb);

    return createDefaultCompanion({
        category: 'steed',
        name: customName || 'Otherworldly Steed',
        creatureName: STEED_TEMPLATE.label,
        creatureSource: 'steed',
        creatureType: creatureType || 'celestial',
        hp: { average: stats.hp, formula: `${STEED_TEMPLATE.baseHp} + ${STEED_TEMPLATE.hpPerSlot} x slot level` },
        ac: stats.ac,
        speed: stats.speed,
        str: STEED_TEMPLATE.str, dex: STEED_TEMPLATE.dex, con: STEED_TEMPLATE.con,
        int: STEED_TEMPLATE.int, wis: STEED_TEMPLATE.wis, cha: STEED_TEMPLATE.cha,
        size: STEED_TEMPLATE.size,
        senses: stats.senses,
        skills: stats.skills,
        actions: (stats.actions || []).map(a => ({ name: a.name, desc: a.desc })),
        traits: (stats.traits || []).map(t => ({ name: t.name, desc: t.desc })),
        scalingLevel: slotLevel || 2,
    });
}

// ============================================================
// SCALING RECOMPUTATION
// ============================================================

/**
 * Recompute scaled stats for a companion in-place.
 * Returns the computed display stats object.
 */
export function getComputedStats(companion) {
    if (companion.category === 'primal' && companion.creatureSource) {
        const level = companion.scalingLevel || 3;
        const pb = getProficiencyBonus(level);
        const stats = computeCompanionStats(companion.creatureSource, level, pb, 0);
        if (stats) {
            return {
                hp: stats.hp,
                ac: stats.ac,
                speed: companion.speed,
                actions: stats.actions,
                traits: stats.traits,
                attackBonus: stats.attackBonus,
                profBonus: stats.profBonus,
            };
        }
    }

    if (companion.category === 'steed') {
        const slotLevel = companion.scalingLevel || 2;
        const pb = character?.level ? getProficiencyBonus(character.level) : 2;
        const stats = computeSteedStats(slotLevel, companion.creatureType, pb);
        return {
            hp: stats.hp,
            ac: stats.ac,
            speed: stats.speed,
            actions: stats.actions,
            traits: stats.traits,
            attackBonus: stats.attackBonus,
            profBonus: stats.profBonus,
            hasFly: stats.hasFly,
        };
    }

    // Familiar: static stats
    return {
        hp: companion.hp?.average ?? 1,
        ac: companion.ac ?? 10,
        speed: companion.speed || '30 ft',
        actions: companion.actions || [],
        traits: companion.traits || [],
    };
}

// ============================================================
// TOGGLE HELPERS
// ============================================================

/**
 * Toggle a companion's enabled state independently.
 * Multiple companions may be enabled at the same time.
 */
export function toggleCompanionEnabled(id) {
    const comp = v2Companions.find(c => c.id === id);
    if (!comp) return;
    comp.enabled = !comp.enabled;
    saveV2Companions(v2Companions);
}

/**
 * Delete a companion by id.
 */
export function deleteCompanion(id) {
    const idx = v2Companions.findIndex(c => c.id === id);
    if (idx < 0) return;
    v2Companions.splice(idx, 1);
    saveV2Companions(v2Companions);
}

/**
 * Add a new companion to the list.
 */
export function addCompanion(companion) {
    v2Companions.push(companion);
    saveV2Companions(v2Companions);
}

/**
 * Update a companion in-place and save.
 */
export function updateCompanion(id, updates) {
    const comp = v2Companions.find(c => c.id === id);
    if (!comp) return;
    Object.assign(comp, updates);
    saveV2Companions(v2Companions);
}
