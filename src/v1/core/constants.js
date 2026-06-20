/**
 * V1 Character System - Constants
 * Core D&D 5e rules data: class tables, proficiency, ability scores, etc.
 * Covers PHB'24 (XPHB) + XGE source books.
 */

export const CDN_DATA = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data';

export const V1_SOURCES = ['XPHB', 'XGE', 'XDMG', 'XMM'];

export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const ABILITY_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const POINT_BUY_COSTS = {
    8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};
export const POINT_BUY_TOTAL = 27;

export function getProficiencyBonus(level) {
    return Math.ceil(level / 4) + 1;
}

export function getModifier(score) {
    return Math.floor((score - 10) / 2);
}

// Hit die face value per class (PHB'24)
export const HIT_DICE = {
    barbarian: 12,
    fighter: 10,
    paladin: 10,
    ranger: 10,
    bard: 8,
    cleric: 8,
    druid: 8,
    monk: 8,
    rogue: 8,
    warlock: 8,
    sorcerer: 6,
    wizard: 6,
};

// Spellcasting ability per class
export const SPELLCASTING_ABILITY = {
    bard: 'cha',
    cleric: 'wis',
    druid: 'wis',
    paladin: 'cha',
    ranger: 'wis',
    sorcerer: 'cha',
    warlock: 'cha',
    wizard: 'int',
    fighter: 'int',   // Eldritch Knight
    rogue: 'int',     // Arcane Trickster
};

// Save proficiencies granted by each class (PHB'24)
export const CLASS_SAVE_PROFICIENCIES = {
    barbarian: ['str', 'con'],
    bard: ['dex', 'cha'],
    cleric: ['wis', 'cha'],
    druid: ['int', 'wis'],
    fighter: ['str', 'con'],
    monk: ['str', 'dex'],
    paladin: ['wis', 'cha'],
    ranger: ['str', 'dex'],
    rogue: ['dex', 'int'],
    sorcerer: ['con', 'cha'],
    warlock: ['wis', 'cha'],
    wizard: ['int', 'wis'],
};

// Number of skill proficiency choices per class at creation
export const CLASS_SKILL_COUNT = {
    barbarian: 2,
    bard: 3,
    cleric: 2,
    druid: 2,
    fighter: 2,
    monk: 2,
    paladin: 2,
    ranger: 3,
    rogue: 4,
    sorcerer: 2,
    warlock: 2,
    wizard: 2,
};

// Skill options per class (PHB'24)
export const CLASS_SKILL_OPTIONS = {
    barbarian: ['animal-handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'],
    bard: ['acrobatics', 'animal-handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight-of-hand', 'stealth', 'survival'],
    cleric: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
    druid: ['arcana', 'animal-handling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'],
    fighter: ['acrobatics', 'animal-handling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'],
    monk: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'],
    paladin: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'],
    ranger: ['animal-handling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'],
    rogue: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight-of-hand', 'stealth'],
    sorcerer: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'],
    warlock: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'],
    wizard: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'],
};

// All skills and their governing ability
export const SKILLS = {
    'acrobatics': 'dex',
    'animal-handling': 'wis',
    'arcana': 'int',
    'athletics': 'str',
    'deception': 'cha',
    'history': 'int',
    'insight': 'wis',
    'intimidation': 'cha',
    'investigation': 'int',
    'medicine': 'wis',
    'nature': 'int',
    'perception': 'wis',
    'performance': 'cha',
    'persuasion': 'cha',
    'religion': 'int',
    'sleight-of-hand': 'dex',
    'stealth': 'dex',
    'survival': 'wis',
};

export const SKILL_LABELS = {
    'acrobatics': 'Acrobatics',
    'animal-handling': 'Animal Handling',
    'arcana': 'Arcana',
    'athletics': 'Athletics',
    'deception': 'Deception',
    'history': 'History',
    'insight': 'Insight',
    'intimidation': 'Intimidation',
    'investigation': 'Investigation',
    'medicine': 'Medicine',
    'nature': 'Nature',
    'perception': 'Perception',
    'performance': 'Performance',
    'persuasion': 'Persuasion',
    'religion': 'Religion',
    'sleight-of-hand': 'Sleight of Hand',
    'stealth': 'Stealth',
    'survival': 'Survival',
};

// ASI levels per class (PHB'24 — all classes share the same levels)
export const ASI_LEVELS = [4, 8, 12, 16, 19];

// Armor proficiencies by class
export const CLASS_ARMOR_PROFICIENCY = {
    barbarian: ['light', 'medium', 'shield'],
    bard: ['light'],
    cleric: ['light', 'medium', 'shield'],
    druid: ['light', 'medium', 'shield'],
    fighter: ['light', 'medium', 'heavy', 'shield'],
    monk: [],
    paladin: ['light', 'medium', 'heavy', 'shield'],
    ranger: ['light', 'medium', 'shield'],
    rogue: ['light'],
    sorcerer: [],
    warlock: ['light'],
    wizard: [],
};

// Weapon proficiencies by class
export const CLASS_WEAPON_PROFICIENCY = {
    barbarian: ['simple', 'martial'],
    bard: ['simple'],
    cleric: ['simple'],
    druid: ['simple'],
    fighter: ['simple', 'martial'],
    monk: ['simple', 'martial'],
    paladin: ['simple', 'martial'],
    ranger: ['simple', 'martial'],
    rogue: ['simple', 'martial'],
    sorcerer: ['simple'],
    warlock: ['simple'],
    wizard: ['simple'],
};

// Full caster spell slot progression (Bard, Cleric, Druid, Sorcerer, Wizard)
// Each row: [1st, 2nd, 3rd, 4th, 5th, 6th, 7th, 8th, 9th]
export const FULL_CASTER_SLOTS = [
    [2,0,0,0,0,0,0,0,0], // 1
    [3,0,0,0,0,0,0,0,0], // 2
    [4,2,0,0,0,0,0,0,0], // 3
    [4,3,0,0,0,0,0,0,0], // 4
    [4,3,2,0,0,0,0,0,0], // 5
    [4,3,3,0,0,0,0,0,0], // 6
    [4,3,3,1,0,0,0,0,0], // 7
    [4,3,3,2,0,0,0,0,0], // 8
    [4,3,3,3,1,0,0,0,0], // 9
    [4,3,3,3,2,0,0,0,0], // 10
    [4,3,3,3,2,1,0,0,0], // 11
    [4,3,3,3,2,1,0,0,0], // 12
    [4,3,3,3,2,1,1,0,0], // 13
    [4,3,3,3,2,1,1,0,0], // 14
    [4,3,3,3,2,1,1,1,0], // 15
    [4,3,3,3,2,1,1,1,0], // 16
    [4,3,3,3,2,1,1,1,1], // 17
    [4,3,3,3,3,1,1,1,1], // 18
    [4,3,3,3,3,2,1,1,1], // 19
    [4,3,3,3,3,2,2,1,1], // 20
];

// Half-caster spell slot progression (Paladin, Ranger — no slots until level 2)
export const HALF_CASTER_SLOTS = [
    [0,0,0,0,0], // 1
    [2,0,0,0,0], // 2
    [3,0,0,0,0], // 3
    [3,0,0,0,0], // 4
    [4,2,0,0,0], // 5
    [4,2,0,0,0], // 6
    [4,3,0,0,0], // 7
    [4,3,0,0,0], // 8
    [4,3,2,0,0], // 9
    [4,3,2,0,0], // 10
    [4,3,3,0,0], // 11
    [4,3,3,0,0], // 12
    [4,3,3,1,0], // 13
    [4,3,3,1,0], // 14
    [4,3,3,2,0], // 15
    [4,3,3,2,0], // 16
    [4,3,3,3,1], // 17
    [4,3,3,3,1], // 18
    [4,3,3,3,2], // 19
    [4,3,3,3,2], // 20
];

// Third-caster slots (Eldritch Knight, Arcane Trickster)
export const THIRD_CASTER_SLOTS = [
    [0,0,0,0], // 1
    [0,0,0,0], // 2
    [2,0,0,0], // 3
    [3,0,0,0], // 4
    [3,0,0,0], // 5
    [3,0,0,0], // 6
    [4,2,0,0], // 7
    [4,2,0,0], // 8
    [4,2,0,0], // 9
    [4,3,0,0], // 10
    [4,3,0,0], // 11
    [4,3,0,0], // 12
    [4,3,2,0], // 13
    [4,3,2,0], // 14
    [4,3,2,0], // 15
    [4,3,3,0], // 16
    [4,3,3,0], // 17
    [4,3,3,0], // 18
    [4,3,3,1], // 19
    [4,3,3,1], // 20
];

// Warlock Pact Magic slots (PHB'24): { slots, slotLevel }
export const WARLOCK_PACT_SLOTS = [
    { slots: 1, level: 1 }, // 1
    { slots: 2, level: 1 }, // 2
    { slots: 2, level: 1 }, // 3
    { slots: 2, level: 2 }, // 4
    { slots: 2, level: 2 }, // 5
    { slots: 2, level: 3 }, // 6
    { slots: 2, level: 3 }, // 7
    { slots: 2, level: 4 }, // 8
    { slots: 2, level: 4 }, // 9
    { slots: 2, level: 5 }, // 10
    { slots: 3, level: 5 }, // 11
    { slots: 3, level: 5 }, // 12
    { slots: 3, level: 5 }, // 13
    { slots: 3, level: 5 }, // 14
    { slots: 3, level: 5 }, // 15
    { slots: 3, level: 5 }, // 16
    { slots: 4, level: 5 }, // 17
    { slots: 4, level: 5 }, // 18
    { slots: 4, level: 5 }, // 19
    { slots: 4, level: 5 }, // 20
];

// Caster type by class
export const CASTER_TYPE = {
    bard: 'full',
    cleric: 'full',
    druid: 'full',
    sorcerer: 'full',
    wizard: 'full',
    paladin: 'half',
    ranger: 'half',
    warlock: 'pact',
    fighter: 'third',  // Eldritch Knight (only with subclass)
    rogue: 'third',    // Arcane Trickster (only with subclass)
};

// Subclasses that grant spellcasting to third-casters
export const SPELLCASTING_SUBCLASSES = {
    fighter: ['Eldritch Knight'],
    rogue: ['Arcane Trickster'],
};

// Subclasses that grant access to another class's spell list
// key = "className|subclassName", value = additional classKey(s) for spell lookups
export const SUBCLASS_EXTRA_SPELL_LISTS = {
    'sorcerer|Divine Soul': ['cleric'],
    'fighter|Eldritch Knight': ['wizard'],
    'rogue|Arcane Trickster': ['wizard'],
};

/**
 * Get spell slots for a class at a given level.
 * @returns {number[]} Array of slot counts per spell level, or empty array if non-caster
 */
export function getSpellSlots(classKey, level, subclassName) {
    const type = CASTER_TYPE[classKey];
    if (!type) return [];

    if (type === 'third') {
        const validSubs = SPELLCASTING_SUBCLASSES[classKey] || [];
        if (!subclassName || !validSubs.some(s => subclassName.includes(s))) return [];
        return THIRD_CASTER_SLOTS[level - 1] || [];
    }

    if (type === 'pact') {
        const pact = WARLOCK_PACT_SLOTS[level - 1];
        if (!pact) return [];
        const slots = new Array(5).fill(0);
        slots[pact.level - 1] = pact.slots;
        return slots;
    }

    if (type === 'half') return HALF_CASTER_SLOTS[level - 1] || [];
    return FULL_CASTER_SLOTS[level - 1] || [];
}

// Cantrips known progression for full casters (PHB'24)
export const CANTRIPS_KNOWN = {
    bard:     [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
    cleric:   [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
    druid:    [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
    sorcerer: [4,4,4,5,5,5,5,5,5,6,6,6,6,6,6,6,6,6,6,6],
    warlock:  [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
    wizard:   [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
    fighter:  [0,0,2,2,2,2,2,2,2,3,3,3,3,3,3,3,3,3,3,3],
    rogue:    [0,0,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
};

// Spells known for known-casters (Warlock, EK, AT)
// PHB'24 moved Bard, Ranger, Sorcerer to prepared casters
export const SPELLS_KNOWN = {
    warlock:  [2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15],
    fighter:  [0,0,3,4,4,4,5,6,6,7,8,8,9,10,10,11,11,11,12,13],
    rogue:    [0,0,3,4,4,4,5,6,6,7,8,8,9,10,10,11,11,11,12,13],
};

// PHB'24 prepared-caster classes (prepare from full class list each day)
export const PREPARED_CASTERS = ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'wizard'];

// PHB'24 fixed prepared-spell progressions (Bard, Sorcerer, Ranger use a table, not level+mod)
export const PREPARED_SPELLS_FIXED = {
    sorcerer: [2,4,6,7,9,10,11,12,14,15,16,16,17,17,18,18,19,20,21,22],
    bard:     [4,5,6,7,9,10,11,12,14,15,16,16,17,17,18,18,19,20,21,22],
    ranger:   [2,3,4,5,6,6,7,7,9,9,10,10,11,11,12,12,14,14,15,15],
};

/**
 * Number of spells a prepared caster can prepare.
 * Bard, Sorcerer, Ranger use fixed progression tables (PHB'24).
 * Paladin uses floor(level/2) + abilityMod.
 * Cleric, Druid, Wizard use level + abilityMod.
 * @returns {number}
 */
export function getPreparedCount(classKey, level, abilityMod) {
    if (!PREPARED_CASTERS.includes(classKey)) return 0;
    const fixed = PREPARED_SPELLS_FIXED[classKey];
    if (fixed) return fixed[level - 1] ?? 0;
    const casterType = CASTER_TYPE[classKey];
    const effectiveLevel = casterType === 'half' ? Math.floor(level / 2) : level;
    return Math.max(1, effectiveLevel + abilityMod);
}

// Martial Arts die for Monk (PHB'24)
export const MARTIAL_ARTS_DIE = [
    6,6,6,6,8,8,8,8,8,8,10,10,10,10,10,10,12,12,12,12
];

// Rage damage bonus for Barbarian
export const RAGE_DAMAGE = [
    2,2,2,2,2,2,2,2,3,3,3,3,3,3,3,4,4,4,4,4
];

// Sneak Attack dice for Rogue
export function getSneakAttackDice(level) {
    return Math.ceil(level / 2);
}

// Extra attacks by class and level
export function getExtraAttacks(classKey, level) {
    if (classKey === 'fighter') {
        if (level >= 20) return 4;
        if (level >= 11) return 3;
        if (level >= 5) return 2;
    }
    if (['paladin', 'ranger', 'barbarian', 'monk'].includes(classKey)) {
        if (level >= 5) return 2;
    }
    return 1;
}

// Cantrip damage scaling breakpoints (character level, not class level)
export const CANTRIP_BREAKPOINTS = [1, 5, 11, 17];

// Spell school codes used in 5e.tools data
export const SPELL_SCHOOLS = {
    A: 'Abjuration',
    C: 'Conjuration',
    D: 'Divination',
    E: 'Enchantment',
    V: 'Evocation',
    I: 'Illusion',
    N: 'Necromancy',
    T: 'Transmutation',
};

// Damage types for resistances and spell annotations
export const DAMAGE_TYPES = [
    'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
    'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
];

// Creature types for custom species
export const CREATURE_TYPES = [
    'Humanoid', 'Fey', 'Celestial', 'Fiend', 'Construct',
    'Undead', 'Aberration', 'Beast', 'Dragon', 'Elemental',
    'Giant', 'Monstrosity', 'Ooze', 'Plant',
];

// Common languages
export const COMMON_LANGUAGES = [
    'Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish',
    'Goblin', 'Halfling', 'Orc', 'Abyssal', 'Celestial',
    'Draconic', 'Deep Speech', 'Infernal', 'Primordial',
    'Sylvan', 'Undercommon',
];

// ============================================================
// CLASS RESOURCE SCALING (PHB'24)
// ============================================================

// Barbarian rage uses per long rest (unlimited at L17+ in PHB'24)
export const RAGE_USES = [
    2,2,3,3,3,3,4,4,4,4,4,5,5,5,5,6,6,-1,-1,-1
]; // -1 = unlimited

// Channel Divinity uses per short rest (Cleric PHB'24)
export const CHANNEL_DIVINITY_USES_CLERIC = [
    0,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,3,3,3
];

// Channel Divinity uses per long rest (Paladin PHB'24)
export const CHANNEL_DIVINITY_USES_PALADIN = [
    0,0,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2
];

// Action Surge uses per short rest (Fighter)
export const ACTION_SURGE_USES = [
    0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2
];

// Indomitable uses per long rest (Fighter)
export const INDOMITABLE_USES = [
    0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3
];

/**
 * Compute class resources for a given class/level/ability mods.
 * @returns {{ label: string, value: string|number, recharge: string }[]}
 */
export function getClassResources(classKey, level, mods) {
    const res = [];

    switch (classKey) {
        case 'barbarian': {
            const uses = RAGE_USES[level - 1];
            res.push({ label: 'Rage', value: uses === -1 ? 'Unlimited' : uses, recharge: 'LR' });
            break;
        }
        case 'bard': {
            const uses = Math.max(1, mods.cha || 0);
            const recharge = level >= 5 ? 'SR' : 'LR';
            res.push({ label: 'Bardic Inspiration', value: uses, recharge });
            break;
        }
        case 'cleric': {
            const uses = CHANNEL_DIVINITY_USES_CLERIC[level - 1];
            if (uses > 0) res.push({ label: 'Channel Divinity', value: uses, recharge: 'SR' });
            break;
        }
        case 'druid': {
            if (level >= 2) res.push({ label: 'Wild Shape', value: level >= 20 ? 'Unlimited' : 2, recharge: 'SR' });
            break;
        }
        case 'fighter': {
            if (level >= 2) res.push({ label: 'Second Wind', value: 1, recharge: 'SR' });
            const surge = ACTION_SURGE_USES[level - 1];
            if (surge > 0) res.push({ label: 'Action Surge', value: surge, recharge: 'SR' });
            const indom = INDOMITABLE_USES[level - 1];
            if (indom > 0) res.push({ label: 'Indomitable', value: indom, recharge: 'LR' });
            break;
        }
        case 'monk': {
            if (level >= 2) res.push({ label: 'Focus Points', value: level, recharge: 'SR' });
            break;
        }
        case 'paladin': {
            res.push({ label: 'Lay on Hands', value: `${level * 5} HP`, recharge: 'LR' });
            const cdUses = CHANNEL_DIVINITY_USES_PALADIN[level - 1];
            if (cdUses > 0) res.push({ label: 'Channel Divinity', value: cdUses, recharge: 'LR' });
            break;
        }
        case 'sorcerer': {
            if (level >= 2) res.push({ label: 'Sorcery Points', value: level, recharge: 'LR' });
            break;
        }
        default:
            break;
    }

    return res;
}
