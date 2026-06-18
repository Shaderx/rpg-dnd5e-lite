/**
 * V1 Character System - Class Feature Effect Registry
 * Maps class/subclass features to computed bonuses and prompt notes.
 *
 * Each entry is keyed by a feature identifier and provides handler functions
 * that receive the current stats context and return bonus values or prompt text.
 *
 * Effect types:
 *   spellDamageBonus(stats)       -> { filter: { school?, damageType?, cantripOnly? }, flatBonus }
 *   weaponDamageBonus(stats, wpn) -> number
 *   weaponAttackBonus(stats, wpn) -> number
 *   acOverride(stats)             -> { formula, requiresNoArmor, allowsShield }
 *   acBonus(stats)                -> number
 *   hpBonus(level, stats)         -> number
 *   speedBonus(level, stats)      -> number
 *   promptNote(stats)             -> string
 *   overrideWeaponAbility(stats)  -> string (ability key)
 */

import { MARTIAL_ARTS_DIE, RAGE_DAMAGE, getSneakAttackDice, getExtraAttacks } from '../core/constants.js';

const CLASS_EFFECTS = {};

/**
 * Register a class or subclass feature effect.
 * @param {string} classKey - Lowercase class name
 * @param {string} featureName - Display name of the feature
 * @param {number} minLevel - Minimum class level required
 * @param {object} effects - Effect handlers (promptNote, acBonus, etc.)
 * @param {object} [opts] - Optional metadata: { subclass?, optIn? }
 *   subclass: string - If set, feature only applies when character has this subclass
 *   optIn: boolean - If true, feature requires explicit selection (fighting styles)
 */
function register(classKey, featureName, minLevel, effects, opts = {}) {
    const id = `${classKey}_${featureName}`;
    CLASS_EFFECTS[id] = { classKey, featureName, minLevel, ...effects, _subclass: opts.subclass || null, _optIn: opts.optIn || false };
}

// --- Barbarian ---

register('barbarian', 'Unarmored Defense', 1, {
    acOverride: (stats) => ({
        formula: 10 + (stats.mods.dex || 0) + (stats.mods.con || 0),
        requiresNoArmor: true,
        allowsShield: true,
    }),
});

register('barbarian', 'Rage', 1, {
    promptNote: (stats) => {
        const dmg = RAGE_DAMAGE[stats.level - 1] || 2;
        return `Rage: +${dmg} melee STR damage while raging; resistance to bludgeoning/piercing/slashing; advantage on STR checks/saves`;
    },
});

register('barbarian', 'Reckless Attack', 2, {
    promptNote: () => 'Reckless Attack: Gain advantage on melee STR attacks this turn; attacks against you have advantage until next turn',
});

register('barbarian', 'Danger Sense', 2, {
    promptNote: () => 'Danger Sense: Advantage on DEX saves against effects you can see',
});

register('barbarian', 'Extra Attack', 5, {
    promptNote: (stats) => {
        const n = getExtraAttacks('barbarian', stats.level);
        return n > 1 ? `Extra Attack: ${n} attacks per Attack action` : null;
    },
});

register('barbarian', 'Fast Movement', 5, {
    speedBonus: (level) => level >= 5 ? 10 : 0,
});

register('barbarian', 'Brutal Strike', 9, {
    promptNote: (stats) =>
        stats.level >= 9 ? 'Brutal Strike: Forgo advantage from Reckless Attack for +1d10 damage and special effect' : null,
});

// --- Bard ---

register('bard', 'Bardic Inspiration', 1, {
    promptNote: (stats) => {
        const die = stats.level >= 15 ? 'd12' : stats.level >= 10 ? 'd10' : stats.level >= 5 ? 'd8' : 'd6';
        return `Bardic Inspiration: Bonus action grant ally ${die} inspiration die (CHA mod uses/LR)`;
    },
});

register('bard', 'Jack of All Trades', 2, {
    promptNote: (stats) =>
        `Jack of All Trades: +${Math.floor(stats.proficiency / 2)} to ability checks without proficiency`,
});

register('bard', 'Expertise', 2, {
    promptNote: () => 'Expertise: Double proficiency in 2 chosen skills (2 more at 9th level)',
});

register('bard', 'Font of Inspiration', 7, {
    promptNote: () => 'Font of Inspiration: Regain all Bardic Inspiration uses on short or long rest',
});

// --- Cleric ---

register('cleric', 'Channel Divinity', 2, {
    promptNote: (stats) => {
        const uses = stats.level >= 18 ? 3 : stats.level >= 6 ? 2 : 1;
        return `Channel Divinity: ${uses} uses/rest; Turn Undead + subclass channel option`;
    },
});

register('cleric', 'Divine Intervention', 10, {
    promptNote: () => 'Divine Intervention: Call on deity for aid (DM determines effect)',
});

// Subclass: Life Domain
register('cleric', 'Disciple of Life', 1, {
    healingBonus: (spellLevel) => 2 + spellLevel,
    promptNote: () => 'Disciple of Life: Healing spells restore extra 2 + spell level HP',
}, { subclass: 'Life' });

register('cleric', 'Blessed Healer', 6, {
    promptNote: () => 'Blessed Healer: When you heal another, you regain 2 + spell level HP',
}, { subclass: 'Life' });

// Subclass: Light Domain
register('cleric', 'Potent Spellcasting', 8, {
    spellDamageBonus: (stats) => ({
        filter: { cantripOnly: true },
        flatBonus: stats.mods.wis || 0,
    }),
}, { subclass: 'Light' });

// --- Druid ---

register('druid', 'Wild Shape', 2, {
    promptNote: (stats) => {
        const maxCR = stats.level >= 8 ? 1 : stats.level >= 4 ? '1/2' : '1/4';
        return `Wild Shape: Transform into beast of CR ${maxCR} or lower`;
    },
});

// --- Fighter ---

register('fighter', 'Second Wind', 1, {
    promptNote: (stats) =>
        `Second Wind: Bonus action heal 1d10 + ${stats.level} HP (1/short rest)`,
});

register('fighter', 'Action Surge', 2, {
    promptNote: (stats) => {
        const uses = stats.level >= 17 ? 2 : 1;
        return `Action Surge: ${uses} extra action(s) per rest`;
    },
});

register('fighter', 'Extra Attack', 5, {
    promptNote: (stats) => {
        const n = getExtraAttacks('fighter', stats.level);
        return n > 1 ? `Extra Attack: ${n} attacks per Attack action` : null;
    },
});

register('fighter', 'Indomitable', 9, {
    promptNote: (stats) => {
        const uses = stats.level >= 17 ? 3 : stats.level >= 13 ? 2 : 1;
        return `Indomitable: Reroll a failed save ${uses} time(s)/LR`;
    },
});

// Fighting Styles (apply based on character's chosen fighting style stored in featData)
register('fighter', 'Fighting Style: Archery', 1, {
    weaponAttackBonus: (_stats, wpn) => wpn.isRanged ? 2 : 0,
}, { optIn: true });

register('fighter', 'Fighting Style: Defense', 1, {
    acBonus: (stats) => stats.hasArmor ? 1 : 0,
}, { optIn: true });

register('fighter', 'Fighting Style: Dueling', 1, {
    weaponDamageBonus: (stats, wpn) => {
        if (!wpn.isTwoHanded && !wpn.isRanged && stats.equippedWeaponCount <= 1) return 2;
        return 0;
    },
}, { optIn: true });

register('fighter', 'Fighting Style: Great Weapon Fighting', 1, {
    promptNote: () => 'Great Weapon Fighting: Reroll 1s and 2s on damage dice with two-handed/versatile weapons',
}, { optIn: true });

register('fighter', 'Fighting Style: Two-Weapon Fighting', 1, {
    promptNote: () => 'Two-Weapon Fighting: Add ability modifier to off-hand bonus action attack damage',
}, { optIn: true });

// --- Monk ---

register('monk', 'Unarmored Defense', 1, {
    acOverride: (stats) => ({
        formula: 10 + (stats.mods.dex || 0) + (stats.mods.wis || 0),
        requiresNoArmor: true,
        allowsShield: false,
    }),
});

register('monk', 'Martial Arts', 1, {
    promptNote: (stats) => {
        const die = MARTIAL_ARTS_DIE[stats.level - 1] || 6;
        return `Martial Arts: Unarmed/monk weapon uses d${die}; DEX for attack/damage; bonus action unarmed strike after Attack`;
    },
    meta: { martialArtsDie: true },
});

register('monk', 'Unarmored Movement', 2, {
    speedBonus: (level) => {
        if (level >= 18) return 30;
        if (level >= 14) return 25;
        if (level >= 10) return 20;
        if (level >= 6) return 15;
        if (level >= 2) return 10;
        return 0;
    },
});

register('monk', 'Extra Attack', 5, {
    promptNote: (stats) => {
        const n = getExtraAttacks('monk', stats.level);
        return n > 1 ? `Extra Attack: ${n} attacks per Attack action` : null;
    },
});

register('monk', 'Stunning Strike', 5, {
    promptNote: () => 'Stunning Strike: Spend 1 ki after melee hit; target makes CON save or is stunned until end of your next turn',
});

register('monk', 'Evasion', 7, {
    promptNote: () => 'Evasion: DEX save for half damage = no damage; fail = half damage',
});

// --- Paladin ---

register('paladin', 'Divine Sense', 1, {
    promptNote: () => 'Divine Sense: Detect celestials, fiends, undead within 60ft (1+CHA mod uses/LR)',
});

register('paladin', 'Lay on Hands', 1, {
    promptNote: (stats) =>
        `Lay on Hands: Pool of ${stats.level * 5} HP; touch to heal or spend 5 to cure disease/poison`,
});

register('paladin', 'Divine Smite', 2, {
    promptNote: () =>
        'Divine Smite: On melee hit, spend spell slot for +2d8 radiant damage (+1d8/slot above 1st, +1d8 vs undead/fiend, max 5d8)',
});

register('paladin', 'Extra Attack', 5, {
    promptNote: (stats) => {
        const n = getExtraAttacks('paladin', stats.level);
        return n > 1 ? `Extra Attack: ${n} attacks per Attack action` : null;
    },
});

register('paladin', 'Aura of Protection', 6, {
    promptNote: (stats) => {
        const range = stats.level >= 18 ? 30 : 10;
        const mod = stats.mods.cha || 0;
        return `Aura of Protection: You and allies within ${range}ft add +${Math.max(1, mod)} to saving throws`;
    },
});

register('paladin', 'Improved Divine Smite', 11, {
    promptNote: () => 'Improved Divine Smite: +1d8 radiant damage on every melee weapon hit',
});

// Fighting Styles for Paladin (same patterns as Fighter)
register('paladin', 'Fighting Style: Defense', 2, {
    acBonus: (stats) => stats.hasArmor ? 1 : 0,
}, { optIn: true });

register('paladin', 'Fighting Style: Dueling', 2, {
    weaponDamageBonus: (stats, wpn) => {
        if (!wpn.isTwoHanded && !wpn.isRanged && stats.equippedWeaponCount <= 1) return 2;
        return 0;
    },
}, { optIn: true });

register('paladin', 'Fighting Style: Great Weapon Fighting', 2, {
    promptNote: () => 'Great Weapon Fighting: Reroll 1s and 2s on damage dice with two-handed/versatile weapons',
}, { optIn: true });

register('paladin', 'Blessed Warrior', 2, {
    promptNote: () => 'Blessed Warrior: 2 Cleric cantrips using CHA as spellcasting ability',
}, { optIn: true });

// --- Ranger ---

register('ranger', 'Favored Foe', 1, {
    promptNote: (stats) => {
        const die = stats.level >= 14 ? 'd8' : stats.level >= 6 ? 'd6' : 'd4';
        return `Favored Foe: Mark target; deal extra 1${die} damage once/turn (concentration, WIS mod uses/LR)`;
    },
});

register('ranger', 'Extra Attack', 5, {
    promptNote: (stats) => {
        const n = getExtraAttacks('ranger', stats.level);
        return n > 1 ? `Extra Attack: ${n} attacks per Attack action` : null;
    },
});

// Ranger Fighting Styles
register('ranger', 'Fighting Style: Archery', 2, {
    weaponAttackBonus: (_stats, wpn) => wpn.isRanged ? 2 : 0,
}, { optIn: true });

register('ranger', 'Fighting Style: Defense', 2, {
    acBonus: (stats) => stats.hasArmor ? 1 : 0,
}, { optIn: true });

register('ranger', 'Fighting Style: Dueling', 2, {
    weaponDamageBonus: (stats, wpn) => {
        if (!wpn.isTwoHanded && !wpn.isRanged && stats.equippedWeaponCount <= 1) return 2;
        return 0;
    },
}, { optIn: true });

register('ranger', 'Fighting Style: Two-Weapon Fighting', 2, {
    promptNote: () => 'Two-Weapon Fighting: Add ability modifier to off-hand bonus action attack damage',
}, { optIn: true });

register('ranger', 'Druidic Warrior', 2, {
    promptNote: () => 'Druidic Warrior: 2 Druid cantrips using WIS as spellcasting ability',
}, { optIn: true });

// --- Rogue ---

register('rogue', 'Sneak Attack', 1, {
    promptNote: (stats) => {
        const dice = getSneakAttackDice(stats.level);
        return `Sneak Attack: +${dice}d6 once/turn with finesse/ranged weapon when you have advantage or ally is adjacent to target`;
    },
});

register('rogue', 'Expertise', 1, {
    promptNote: () => 'Expertise: Double proficiency bonus in 2 chosen skills (2 more at 6th level)',
});

register('rogue', 'Cunning Action', 2, {
    promptNote: () => 'Cunning Action: Bonus action Dash, Disengage, or Hide',
});

register('rogue', 'Evasion', 7, {
    promptNote: () => 'Evasion: DEX save for half damage = no damage; fail = half damage',
});

register('rogue', 'Reliable Talent', 11, {
    promptNote: () => 'Reliable Talent: Minimum 10 on proficient ability checks',
});

// --- Sorcerer ---

register('sorcerer', 'Metamagic', 3, {
    promptNote: () => 'Metamagic: Modify spells using sorcery points (chosen options apply)',
});

register('sorcerer', 'Font of Magic', 2, {
    promptNote: (stats) =>
        `Font of Magic: ${stats.level} sorcery points/LR; convert between points and spell slots`,
});

// Subclass: Draconic Bloodline
register('sorcerer', 'Draconic Resilience', 1, {
    acOverride: (stats) => ({
        formula: 13 + (stats.mods.dex || 0),
        requiresNoArmor: true,
        allowsShield: true,
    }),
    hpBonus: (level) => level,
}, { subclass: 'Draconic' });

// Subclass: Divine Soul
register('sorcerer', 'Favored by the Gods', 1, {
    promptNote: () => 'Favored by the Gods: When failing a save or missing an attack, add 2d4 to the roll (1/SR)',
}, { subclass: 'Divine Soul' });

register('sorcerer', 'Empowered Healing', 6, {
    promptNote: () => 'Empowered Healing: Spend 1 sorcery point to reroll healing dice when you or ally within 5ft rolls healing',
}, { subclass: 'Divine Soul' });

register('sorcerer', 'Otherworldly Wings', 14, {
    promptNote: () => 'Otherworldly Wings: Bonus action to sprout spectral wings, 30ft fly speed',
}, { subclass: 'Divine Soul' });

register('sorcerer', 'Unearthly Recovery', 18, {
    promptNote: (stats) => `Unearthly Recovery: When below half HP at start of turn, regain HP equal to half max (${Math.floor(stats.hp / 2)}) once/LR`,
}, { subclass: 'Divine Soul' });

register('sorcerer', 'Elemental Affinity', 6, {
    spellDamageBonus: (stats) => ({
        filter: { damageType: stats.draconicElement || null },
        flatBonus: stats.mods.cha || 0,
    }),
}, { subclass: 'Draconic' });

// --- Warlock ---

register('warlock', 'Eldritch Invocations', 2, {
    promptNote: () => 'Eldritch Invocations: Special abilities chosen from invocation list',
});

register('warlock', 'Pact Boon', 3, {
    promptNote: () => 'Pact Boon: Pact of the Blade/Chain/Tome chosen feature',
});

// Subclass: Hexblade
register('warlock', 'Hex Warrior', 1, {
    overrideWeaponAbility: () => 'cha',
    promptNote: () => 'Hex Warrior: Use CHA for weapon attack/damage rolls',
}, { subclass: 'Hexblade' });

// Subclass: Celestial
register('warlock', 'Radiant Soul', 6, {
    spellDamageBonus: (stats) => ({
        filter: { damageType: 'radiant' },
        flatBonus: stats.mods.cha || 0,
    }),
}, { subclass: 'Celestial' });

// --- Wizard ---

// Subclass: Evocation
register('wizard', 'Empowered Evocation', 10, {
    spellDamageBonus: (stats) => ({
        filter: { school: 'V' },
        flatBonus: stats.mods.int || 0,
    }),
}, { subclass: 'Evocation' });

register('wizard', 'Sculpt Spells', 2, {
    promptNote: () => 'Sculpt Spells: Choose creatures in evocation area spell to automatically save and take no damage',
}, { subclass: 'Evocation' });

register('wizard', 'Arcane Recovery', 1, {
    promptNote: (stats) => {
        const slots = Math.ceil(stats.level / 2);
        return `Arcane Recovery: Recover up to ${slots} levels worth of spell slots on short rest (1/LR)`;
    },
});

// ==============================
// Public API
// ==============================

/**
 * Get all applicable class effects for a given class, subclass, and level.
 * Uses data-driven _subclass and _optIn fields set during registration.
 *
 * @param {string} classKey - Lowercase class name
 * @param {string|null} subclassName - Subclass name (for subclass-specific effects)
 * @param {number} level
 * @param {string[]} [chosenFeatures] - Feature names the player has chosen (fighting styles, etc.)
 * @returns {object[]} Array of applicable effect entries
 */
export function getApplicableClassEffects(classKey, subclassName, level, chosenFeatures = []) {
    const results = [];

    for (const [id, effect] of Object.entries(CLASS_EFFECTS)) {
        if (effect.classKey !== classKey) continue;
        if (level < effect.minLevel) continue;

        // Opt-in features (fighting styles) require explicit selection
        if (effect._optIn) {
            const isChosen = chosenFeatures.some(f =>
                f === effect.featureName ||
                effect.featureName.includes(f) ||
                f.includes(effect.featureName)
            );
            if (!isChosen) continue;
        }

        // Subclass-gated features require matching subclass
        if (effect._subclass) {
            if (!subclassName) continue;
            if (!subclassName.toLowerCase().includes(effect._subclass.toLowerCase())) continue;
        }

        results.push({ id, ...effect });
    }

    return results;
}

/**
 * Collect aggregated effects from all applicable class features.
 * @returns {object} Same shape as featEffects.collectFeatEffects result
 */
export function collectClassEffects(classKey, subclassName, level, chosenFeatures = []) {
    const applicable = getApplicableClassEffects(classKey, subclassName, level, chosenFeatures);

    const result = {
        acOverrides: [],
        acBonus: [],
        hpBonus: [],
        speedBonus: [],
        spellDamageBonus: [],
        weaponAttackBonus: [],
        weaponDamageBonus: [],
        promptNotes: [],
        overrideWeaponAbility: null,
        healingBonus: null,
        meta: {},
    };

    for (const effect of applicable) {
        if (effect.acOverride) result.acOverrides.push(effect.acOverride);
        if (effect.acBonus) result.acBonus.push(effect.acBonus);
        if (effect.hpBonus) result.hpBonus.push(effect.hpBonus);
        if (effect.speedBonus) result.speedBonus.push(effect.speedBonus);
        if (effect.spellDamageBonus) result.spellDamageBonus.push(effect.spellDamageBonus);
        if (effect.weaponAttackBonus) result.weaponAttackBonus.push(effect.weaponAttackBonus);
        if (effect.weaponDamageBonus) result.weaponDamageBonus.push(effect.weaponDamageBonus);
        if (effect.promptNote) result.promptNotes.push(effect.promptNote);
        if (effect.overrideWeaponAbility) result.overrideWeaponAbility = effect.overrideWeaponAbility;
        if (effect.healingBonus) result.healingBonus = effect.healingBonus;
        if (effect.meta) Object.assign(result.meta, effect.meta);
    }

    return result;
}

// Load subclass effects (registers additional features via register())
import { registerAllSubclassEffects } from './subclassEffects.js';
registerAllSubclassEffects(register);
