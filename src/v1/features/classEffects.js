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
import { METAMAGIC_OPTIONS } from './levelFeatures.js';

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

// =============================================================================
// BARBARIAN
// =============================================================================

register('barbarian', 'Unarmored Defense', 1, {
    acOverride: (stats) => ({
        formula: 10 + (stats.mods.dex || 0) + (stats.mods.con || 0),
        requiresNoArmor: true,
        allowsShield: true,
    }),
    promptNote: (stats) => `Unarmored Defense: AC = ${10 + (stats.mods.dex || 0) + (stats.mods.con || 0)} (10+DEX+CON) without armor; can use shield`,
});

register('barbarian', 'Rage', 1, {
    promptNote: (stats) => {
        const dmg = RAGE_DAMAGE[stats.level - 1] || 2;
        return `Rage: +${dmg} melee STR damage; resistance to bludgeoning/piercing/slashing; advantage on STR checks/saves; no spells/concentration`;
    },
});

register('barbarian', 'Weapon Mastery', 1, {
    promptNote: () => 'Weapon Mastery: Use mastery properties of 2 chosen weapon types; can swap on LR',
});

register('barbarian', 'Danger Sense', 2, {
    promptNote: () => 'Danger Sense: Advantage on DEX saves against effects you can see; not incapacitated',
});

register('barbarian', 'Reckless Attack', 2, {
    promptNote: () => 'Reckless Attack: Gain advantage on melee STR attacks this turn; attacks against you have advantage until next turn',
});

register('barbarian', 'Primal Knowledge', 3, {
    promptNote: () => 'Primal Knowledge: Gain proficiency in one skill from Animal Handling, Athletics, Intimidation, Nature, Perception, or Survival',
});

register('barbarian', 'Extra Attack', 5, {
    promptNote: (stats) => {
        const n = getExtraAttacks('barbarian', stats.level);
        return n > 1 ? `Extra Attack: ${n} attacks per Attack action` : null;
    },
});

register('barbarian', 'Fast Movement', 5, {
    speedBonus: (level) => level >= 5 ? 10 : 0,
    promptNote: () => 'Fast Movement: +10ft speed when not wearing heavy armor',
});

register('barbarian', 'Feral Instinct', 7, {
    promptNote: () => 'Feral Instinct: Advantage on initiative; if surprised, can act normally if you rage first',
});

register('barbarian', 'Instinctive Pounce', 7, {
    promptNote: () => 'Instinctive Pounce: Move up to half speed when entering Rage',
});

register('barbarian', 'Brutal Strike', 9, {
    promptNote: () => 'Brutal Strike: Forgo Reckless Attack advantage for +1d10 damage; choose Forceful Blow (push 15ft) or Hamstring Blow (-15ft speed)',
});

register('barbarian', 'Relentless Rage', 11, {
    promptNote: () => 'Relentless Rage: DC 10 CON save to stay at 1 HP instead of 0 while raging (DC +5 per use, resets on SR/LR)',
});

register('barbarian', 'Improved Brutal Strike', 13, {
    promptNote: (stats) => {
        const dice = stats.level >= 17 ? '3d10' : '2d10';
        let text = `Improved Brutal Strike: Damage is ${dice}; add Stagger (target next attack at disadvantage) or Sundering Blow (your next attack vs target has advantage)`;
        if (stats.level >= 17) text += '; Overwhelming Blow (push 15ft + knock prone if Large or smaller)';
        return text;
    },
});

register('barbarian', 'Persistent Rage', 15, {
    promptNote: () => 'Persistent Rage: Rage only ends when you choose or fall unconscious; no longer ends early',
});

register('barbarian', 'Indomitable Might', 18, {
    promptNote: () => 'Indomitable Might: STR and CON check minimums equal their scores',
});

register('barbarian', 'Primal Champion', 20, {
    promptNote: () => 'Primal Champion: STR and CON increase by 4 (max 25)',
});

// =============================================================================
// BARD
// =============================================================================

register('bard', 'Bardic Inspiration', 1, {
    promptNote: (stats) => {
        const die = stats.level >= 15 ? 'd12' : stats.level >= 10 ? 'd10' : stats.level >= 5 ? 'd8' : 'd6';
        return `Bardic Inspiration: Bonus action grant ally ${die} inspiration die; CHA mod uses/LR`;
    },
});

register('bard', 'Expertise', 2, {
    promptNote: () => 'Expertise: Double proficiency in 2 chosen skills (2 more at 9th level)',
});

register('bard', 'Jack of All Trades', 2, {
    promptNote: (stats) =>
        `Jack of All Trades: +${Math.floor(stats.proficiency / 2)} to ability checks without proficiency`,
});

register('bard', 'Font of Inspiration', 5, {
    promptNote: () => 'Font of Inspiration: Regain all Bardic Inspiration uses on short or long rest',
});

register('bard', 'Countercharm', 7, {
    promptNote: () => 'Countercharm: Action to give advantage on saves vs charmed/frightened to you and allies within 30ft until end of next turn',
});

register('bard', 'Magical Secrets', 10, {
    promptNote: () => 'Magical Secrets: Learn 2 spells from any class spell list; can replace 1 on level up',
});

register('bard', 'Superior Inspiration', 18, {
    promptNote: () => 'Superior Inspiration: Regain 1 Bardic Inspiration use if you have none at initiative',
});

register('bard', 'Words of Creation', 20, {
    promptNote: () => 'Words of Creation: Give 2 Bardic Inspiration as one bonus action; if only 1 target, add CHA mod to the roll',
});

// =============================================================================
// CLERIC
// =============================================================================

register('cleric', 'Divine Order', 1, {
    promptNote: () => 'Divine Order: Chose Protector (martial weapon + heavy armor proficiency) or Thaumaturge (+1 cantrip + Arcana proficiency)',
});

register('cleric', 'Protector', 1, {
    promptNote: () => 'Protector: Proficiency with martial weapons and heavy armor',
});

register('cleric', 'Thaumaturge', 1, {
    promptNote: () => 'Thaumaturge: Know 1 extra cleric cantrip; proficiency in Arcana',
});

register('cleric', 'Channel Divinity', 2, {
    promptNote: (stats) => {
        const uses = stats.level >= 18 ? 3 : stats.level >= 6 ? 2 : 1;
        return `Channel Divinity: ${uses} use(s)/rest; Divine Spark + Turn Undead + subclass option`;
    },
});

register('cleric', 'Divine Spark', 2, {
    promptNote: (stats) => {
        const dice = stats.proficiency;
        return `Divine Spark: Channel Divinity; heal or deal radiant/necrotic damage (${dice}d8) to target within 30ft`;
    },
});

register('cleric', 'Turn Undead', 2, {
    promptNote: () => 'Turn Undead: Channel Divinity; undead within 30ft WIS save or turned for 1 min (flee, no attacks)',
});

register('cleric', 'Sear Undead', 5, {
    promptNote: (stats) =>
        `Sear Undead: Turned undead take ${(stats.mods.wis || 0) + stats.proficiency} radiant damage when Turn Undead is used`,
});

register('cleric', 'Blessed Strikes', 7, {
    promptNote: () => 'Blessed Strikes: Choose Divine Strike (+1d8 weapon damage once/turn) or Potent Spellcasting (+WIS mod to cleric cantrip damage)',
});

register('cleric', 'Divine Strike', 7, {
    promptNote: (stats) => {
        const dice = stats.level >= 14 ? '2d8' : '1d8';
        return `Divine Strike: Once per turn, weapon deals extra ${dice} radiant damage`;
    },
});

register('cleric', 'Potent Spellcasting', 7, {
    spellDamageBonus: (stats) => ({
        filter: { cantripOnly: true },
        flatBonus: stats.mods.wis || 0,
    }),
    promptNote: (stats) =>
        `Potent Spellcasting: Add WIS mod (+${stats.mods.wis || 0}) to cleric cantrip damage`,
});

register('cleric', 'Divine Intervention', 10, {
    promptNote: () => 'Divine Intervention: Cast any cleric spell of 5th level or lower without material components as a Magic action (1/LR)',
});

register('cleric', 'Improved Blessed Strikes', 14, {
    promptNote: () => 'Improved Blessed Strikes: Divine Strike becomes 2d8; Potent Spellcasting also adds WIS mod to healing from cleric spells',
});

register('cleric', 'Greater Divine Intervention', 20, {
    promptNote: () => 'Greater Divine Intervention: Divine Intervention can cast Wish; once used, 2d4 LR cooldown',
});

// Subclass: Life Domain
register('cleric', 'Disciple of Life', 3, {
    healingBonus: (spellLevel) => 2 + spellLevel,
    promptNote: () => 'Disciple of Life: Healing spells restore extra 2 + spell level HP',
}, { subclass: 'Life' });

register('cleric', 'Blessed Healer', 6, {
    promptNote: () => 'Blessed Healer: When you heal another, you regain 2 + spell level HP',
}, { subclass: 'Life' });

// =============================================================================
// DRUID
// =============================================================================

register('druid', 'Druidic', 1, {
    promptNote: () => 'Druidic: Know Druidic language; can leave hidden messages readable by other druids',
});

register('druid', 'Primal Order', 1, {
    promptNote: () => 'Primal Order: Chose Magician (+1 druid cantrip + Arcana proficiency) or Warden (martial weapon proficiency + medium armor)',
});

register('druid', 'Magician', 1, {
    promptNote: () => 'Magician: Know 1 extra druid cantrip; proficiency in Arcana',
});

register('druid', 'Warden', 1, {
    promptNote: () => 'Warden: Proficiency with martial weapons and training in medium armor',
});

register('druid', 'Wild Companion', 2, {
    promptNote: () => 'Wild Companion: Expend Wild Shape use to cast Find Familiar without material components',
});

register('druid', 'Wild Shape', 2, {
    promptNote: (stats) => {
        const maxCR = stats.level >= 8 ? 1 : stats.level >= 4 ? '1/2' : '1/4';
        return `Wild Shape: Bonus action transform into beast CR ${maxCR} or lower; temp HP = ${stats.level} × beast CR (min 1)`;
    },
});

register('druid', 'Wild Resurgence', 5, {
    promptNote: () => 'Wild Resurgence: Once/LR replace expended spell slot (Lv1) as bonus action; also can expend spell slot to regain Wild Shape use',
});

register('druid', 'Elemental Fury', 7, {
    promptNote: () => 'Elemental Fury: Choose Potent Spellcasting (+WIS mod to druid cantrip damage) or Primal Strike (Wild Shape attacks count as magical)',
});

register('druid', 'Primal Strike', 7, {
    promptNote: () => 'Primal Strike: Attacks in Wild Shape count as magical for overcoming resistance/immunity',
});

register('druid', 'Improved Elemental Fury', 15, {
    promptNote: () => 'Improved Elemental Fury: Potent Spellcasting also adds WIS mod to druid spell healing; Primal Strike adds 1d6 elemental damage to Wild Shape attacks',
});

register('druid', 'Beast Spells', 18, {
    promptNote: () => 'Beast Spells: Can cast spells with V/S components while in Wild Shape',
});

register('druid', 'Archdruid', 20, {
    promptNote: () => 'Archdruid: Unlimited Wild Shape uses; ignore M components (non-consumed, <1000gp); can regain 1 use of Wild Resurgence on initiative if none remain',
});

// =============================================================================
// FIGHTER
// =============================================================================

register('fighter', 'Second Wind', 1, {
    promptNote: (stats) =>
        `Second Wind: Bonus action heal 1d10+${stats.level} HP (${stats.level >= 20 ? '4' : stats.level >= 14 ? '3' : stats.level >= 7 ? '2' : '1'}/LR)`,
});

register('fighter', 'Weapon Mastery', 1, {
    promptNote: (stats) => {
        const count = stats.level >= 16 ? 6 : stats.level >= 10 ? 5 : stats.level >= 4 ? 4 : 3;
        return `Weapon Mastery: Use mastery properties of ${count} chosen weapon types; can swap on LR`;
    },
});

register('fighter', 'Action Surge', 2, {
    promptNote: (stats) => {
        const uses = stats.level >= 17 ? 2 : 1;
        return `Action Surge: ${uses} extra action(s)/LR; not on same turn as another Action Surge`;
    },
});

register('fighter', 'Tactical Mind', 2, {
    promptNote: () => 'Tactical Mind: When failing an ability check, expend Second Wind use to add 1d10 to roll',
});

register('fighter', 'Extra Attack', 5, {
    promptNote: (stats) => {
        const n = getExtraAttacks('fighter', stats.level);
        return n > 1 ? `Extra Attack: ${n} attacks per Attack action` : null;
    },
});

register('fighter', 'Tactical Shift', 5, {
    promptNote: () => 'Tactical Shift: When using Second Wind, move up to half speed without provoking opportunity attacks',
});

register('fighter', 'Indomitable', 9, {
    promptNote: (stats) => {
        const uses = stats.level >= 17 ? 3 : stats.level >= 13 ? 2 : 1;
        return `Indomitable: Reroll a failed save ${uses} time(s)/LR`;
    },
});

register('fighter', 'Tactical Master', 9, {
    promptNote: () => 'Tactical Master: When attacking with a mastery weapon, can replace its mastery property with Push, Sap, or Slow',
});

register('fighter', 'Two Extra Attacks', 11, {
    promptNote: () => 'Two Extra Attacks: 3 attacks per Attack action',
});

register('fighter', 'Studied Attacks', 13, {
    promptNote: () => 'Studied Attacks: When you miss an attack, you have advantage on your next attack against that target before end of next turn',
});

register('fighter', 'Three Extra Attacks', 20, {
    promptNote: () => 'Three Extra Attacks: 4 attacks per Attack action',
});

// Fighting Styles
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

// =============================================================================
// MONK
// =============================================================================

register('monk', 'Unarmored Defense', 1, {
    acOverride: (stats) => ({
        formula: 10 + (stats.mods.dex || 0) + (stats.mods.wis || 0),
        requiresNoArmor: true,
        allowsShield: false,
    }),
    promptNote: (stats) => `Unarmored Defense: AC = ${10 + (stats.mods.dex || 0) + (stats.mods.wis || 0)} (10+DEX+WIS) without armor; no shield`,
});

register('monk', 'Martial Arts', 1, {
    promptNote: (stats) => {
        const die = MARTIAL_ARTS_DIE[stats.level - 1] || 6;
        return `Martial Arts: Unarmed/monk weapon uses d${die}; DEX for attack/damage; bonus action unarmed strike after Attack`;
    },
    meta: { martialArtsDie: true },
});

register('monk', 'Bonus Unarmed Strike', 1, {
    promptNote: () => 'Bonus Unarmed Strike: Make one unarmed strike as a bonus action after Attack action',
});

register('monk', 'Dexterous Attacks', 1, {
    promptNote: () => 'Dexterous Attacks: Can use DEX instead of STR for unarmed strike attack/damage rolls',
});

register('monk', 'Martial Arts Die', 1, {
    promptNote: (stats) => {
        const die = MARTIAL_ARTS_DIE[stats.level - 1] || 6;
        return `Martial Arts Die: d${die} for unarmed strikes and monk weapons instead of normal damage die`;
    },
});

register('monk', 'Monk\'s Focus', 2, {
    promptNote: (stats) =>
        `Monk's Focus: ${stats.level} Focus Points/SR; spend on Flurry of Blows, Patient Defense, Step of the Wind`,
});

register('monk', 'Flurry of Blows', 2, {
    promptNote: () => 'Flurry of Blows: 1 Focus Point; make 2 unarmed strikes as bonus action after Attack',
});

register('monk', 'Patient Defense', 2, {
    promptNote: () => 'Patient Defense: 1 Focus Point; take Dodge as bonus action; or free Dodge at Lv10+',
});

register('monk', 'Step of the Wind', 2, {
    promptNote: () => 'Step of the Wind: 1 Focus Point; Disengage or Dash as bonus action + jump distance doubled for the turn',
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
    promptNote: (stats) => {
        const bonus = stats.level >= 18 ? 30 : stats.level >= 14 ? 25 : stats.level >= 10 ? 20 : stats.level >= 6 ? 15 : 10;
        return `Unarmored Movement: +${bonus}ft speed when not wearing armor or shield`;
    },
});

register('monk', 'Uncanny Metabolism', 2, {
    promptNote: (stats) => {
        const die = MARTIAL_ARTS_DIE[stats.level - 1] || 6;
        return `Uncanny Metabolism: When rolling initiative, regain all Focus Points + heal 1d${die}+${stats.level} HP (1/LR)`;
    },
});

register('monk', 'Deflect Attacks', 3, {
    promptNote: (stats) => {
        const die = MARTIAL_ARTS_DIE[stats.level - 1] || 6;
        return `Deflect Attacks: Reaction to reduce melee/ranged damage by 1d10+DEX+${stats.level}; if reduced to 0, can spend 1 Focus Point to redirect (d${die}+DEX ranged attack)`;
    },
});

register('monk', 'Slow Fall', 4, {
    promptNote: (stats) =>
        `Slow Fall: Reaction to reduce falling damage by ${stats.level * 5}`,
});

register('monk', 'Extra Attack', 5, {
    promptNote: (stats) => {
        const n = getExtraAttacks('monk', stats.level);
        return n > 1 ? `Extra Attack: ${n} attacks per Attack action` : null;
    },
});

register('monk', 'Stunning Strike', 5, {
    promptNote: () => 'Stunning Strike: 1 Focus Point when hitting with Flurry of Blows; target CON save or stunned until start of your next turn',
});

register('monk', 'Empowered Strikes', 6, {
    promptNote: () => 'Empowered Strikes: Unarmed strikes count as magical for overcoming resistance/immunity',
});

register('monk', 'Evasion', 7, {
    promptNote: () => 'Evasion: DEX save for half damage = no damage; fail = half damage',
});

register('monk', 'Acrobatic Movement', 9, {
    promptNote: () => 'Acrobatic Movement: Can move along vertical surfaces and across liquids without falling (only during movement)',
});

register('monk', 'Heightened Focus', 10, {
    promptNote: () => 'Heightened Focus: Flurry of Blows gives 3 unarmed strikes; Patient Defense also restores 1 Focus Point; Step of the Wind distance doubled',
});

register('monk', 'Self-Restoration', 10, {
    promptNote: () => 'Self-Restoration: At end of each turn, automatically end one charmed, frightened, or poisoned condition on yourself',
});

register('monk', 'Deflect Energy', 13, {
    promptNote: () => 'Deflect Energy: Deflect Attacks now works on any damage type, not just melee/ranged attacks',
});

register('monk', 'Disciplined Survivor', 14, {
    promptNote: () => 'Disciplined Survivor: Proficiency in all saving throws; spend 1 Focus Point to reroll a failed save',
});

register('monk', 'Perfect Focus', 15, {
    promptNote: () => 'Perfect Focus: When rolling initiative with fewer than 4 Focus Points, regain up to 4',
});

register('monk', 'Superior Defense', 18, {
    promptNote: () => 'Superior Defense: At start of turn, can spend 3 Focus Points to gain resistance to all damage except force for 1 turn',
});

register('monk', 'Body and Mind', 20, {
    promptNote: () => 'Body and Mind: DEX and WIS increase by 4 (max 25)',
});

// =============================================================================
// PALADIN
// =============================================================================

register('paladin', 'Lay on Hands', 1, {
    promptNote: (stats) =>
        `Lay on Hands: Pool of ${stats.level * 5} HP; touch to heal or spend 5 to cure disease/poison`,
});

register('paladin', 'Weapon Mastery', 1, {
    promptNote: () => 'Weapon Mastery: Use mastery properties of 2 chosen weapon types; can swap on LR',
});

register('paladin', 'Paladin\'s Smite', 2, {
    promptNote: () => 'Paladin\'s Smite: On hit, spend spell slot to deal +2d8 radiant damage (+1d8/slot above 1st, max 5d8); also as bonus action radiant smite spell',
});

register('paladin', 'Channel Divinity', 3, {
    promptNote: () => 'Channel Divinity: Use Divine Sense or subclass channel option; regain uses on LR',
});

register('paladin', 'Divine Sense', 3, {
    promptNote: () => 'Divine Sense: Channel Divinity; bonus action to detect celestials, fiends, undead within 60ft and their location for 10 min',
});

register('paladin', 'Extra Attack', 5, {
    promptNote: (stats) => {
        const n = getExtraAttacks('paladin', stats.level);
        return n > 1 ? `Extra Attack: ${n} attacks per Attack action` : null;
    },
});

register('paladin', 'Faithful Steed', 5, {
    promptNote: () => 'Faithful Steed: Can cast Find Steed without material components or spell slot (1/LR); also castable with slots',
});

register('paladin', 'Aura of Protection', 6, {
    promptNote: (stats) => {
        const range = stats.level >= 18 ? 30 : 10;
        const mod = Math.max(1, stats.mods.cha || 0);
        return `Aura of Protection: You and allies within ${range}ft add +${mod} to saving throws`;
    },
});

register('paladin', 'Abjure Foes', 9, {
    promptNote: () => 'Abjure Foes: Channel Divinity; creatures you choose within 60ft WIS save or frightened + speed 0 for 1 min',
});

register('paladin', 'Aura of Courage', 10, {
    promptNote: (stats) => {
        const range = stats.level >= 18 ? 30 : 10;
        return `Aura of Courage: You and allies within ${range}ft can't be frightened while you're conscious`;
    },
});

register('paladin', 'Radiant Strikes', 11, {
    promptNote: () => 'Radiant Strikes: +1d8 radiant damage on every melee weapon hit',
});

register('paladin', 'Restoring Touch', 14, {
    promptNote: () => 'Restoring Touch: When using Lay on Hands, can also end a spell on the target (as if casting Dispel Magic)',
});

register('paladin', 'Aura Expansion', 18, {
    promptNote: () => 'Aura Expansion: All paladin auras extend to 30ft instead of 10ft',
});

// Fighting Styles for Paladin
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

// =============================================================================
// RANGER
// =============================================================================

register('ranger', 'Favored Enemy', 1, {
    promptNote: () => 'Favored Enemy: Always have Hunter\'s Mark prepared; cast it WIS mod times/LR without concentration or spell slot',
});

register('ranger', 'Weapon Mastery', 1, {
    promptNote: () => 'Weapon Mastery: Use mastery properties of 2 chosen weapon types; can swap on LR',
});

register('ranger', 'Deft Explorer', 2, {
    promptNote: () => 'Deft Explorer: Gain Expertise in one skill you\'re proficient in; +1 language',
});

register('ranger', 'Extra Attack', 5, {
    promptNote: (stats) => {
        const n = getExtraAttacks('ranger', stats.level);
        return n > 1 ? `Extra Attack: ${n} attacks per Attack action` : null;
    },
});

register('ranger', 'Roving', 6, {
    promptNote: () => 'Roving: Speed +10ft; gain climb speed and swim speed equal to your speed',
});

register('ranger', 'Expertise', 9, {
    promptNote: () => 'Expertise: Gain Expertise in another skill you\'re proficient in',
});

register('ranger', 'Tireless', 10, {
    promptNote: (stats) => {
        return `Tireless: Action to gain 1d8+${stats.mods.wis || 0} temp HP (WIS mod times/LR); reduce exhaustion by 1 on SR`;
    },
});

register('ranger', 'Relentless Hunter', 13, {
    promptNote: () => 'Relentless Hunter: Hunter\'s Mark no longer requires concentration',
});

register('ranger', 'Nature\'s Veil', 14, {
    promptNote: () => 'Nature\'s Veil: Bonus action to become invisible until start of next turn (WIS mod uses/LR)',
});

register('ranger', 'Precise Hunter', 17, {
    promptNote: () => 'Precise Hunter: Advantage on attack rolls against the target of your Hunter\'s Mark',
});

register('ranger', 'Feral Senses', 18, {
    promptNote: () => 'Feral Senses: 30ft Blindsight; can\'t have disadvantage on attacks against non-hidden targets within that range',
});

register('ranger', 'Foe Slayer', 20, {
    promptNote: (stats) =>
        `Foe Slayer: Hunter's Mark damage becomes 1d10; once per turn add +${stats.mods.wis || 0} (WIS mod) to attack or damage roll vs marked target`,
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

// =============================================================================
// ROGUE
// =============================================================================

register('rogue', 'Sneak Attack', 1, {
    promptNote: (stats) => {
        const dice = getSneakAttackDice(stats.level);
        return `Sneak Attack: +${dice}d6 once/turn with finesse/ranged weapon when you have advantage or ally within 5ft of target`;
    },
});

register('rogue', 'Expertise', 1, {
    promptNote: () => 'Expertise: Double proficiency in 2 chosen skills (2 more at 6th level)',
});

register('rogue', 'Thieves\' Cant', 1, {
    promptNote: () => 'Thieves\' Cant: Know thieves\' cant; can hide messages in normal conversation and read secret signs/symbols',
});

register('rogue', 'Weapon Mastery', 1, {
    promptNote: () => 'Weapon Mastery: Use mastery properties of 2 chosen weapon types; can swap on LR',
});

register('rogue', 'Cunning Action', 2, {
    promptNote: () => 'Cunning Action: Bonus action Dash, Disengage, or Hide',
});

register('rogue', 'Steady Aim', 3, {
    promptNote: () => 'Steady Aim: Bonus action to gain advantage on next attack this turn; speed becomes 0 for the turn',
});

register('rogue', 'Cunning Strike', 5, {
    promptNote: () => 'Cunning Strike: Forgo Sneak Attack dice for effects: Poison (1d6 cost, CON save or poisoned), Trip (1d6, DEX save or prone), Withdraw (1d6, move half speed no OA)',
});

register('rogue', 'Uncanny Dodge', 5, {
    promptNote: () => 'Uncanny Dodge: Reaction to halve damage from an attack you can see',
});

register('rogue', 'Evasion', 7, {
    promptNote: () => 'Evasion: DEX save for half damage = no damage; fail = half damage',
});

register('rogue', 'Reliable Talent', 7, {
    promptNote: () => 'Reliable Talent: Minimum 10 on any ability check that uses a skill you\'re proficient in',
});

register('rogue', 'Improved Cunning Strike', 11, {
    promptNote: () => 'Improved Cunning Strike: Can apply two Cunning Strike effects at once (pay both costs)',
});

register('rogue', 'Devious Strikes', 14, {
    promptNote: () => 'Devious Strikes: New options: Daze (2d6, CON save or dazed), Knock Out (6d6, surprised target CON save or unconscious 1 min), Obscure (3d6, DEX save or blinded until end of their turn)',
});

register('rogue', 'Slippery Mind', 15, {
    promptNote: () => 'Slippery Mind: Proficiency in WIS and CHA saving throws',
});

register('rogue', 'Elusive', 18, {
    promptNote: () => 'Elusive: No attack roll has advantage against you while you\'re not incapacitated',
});

register('rogue', 'Stroke of Luck', 20, {
    promptNote: () => 'Stroke of Luck: Turn a missed attack into a hit, or treat a failed ability check as natural 20 (1/SR)',
});

// =============================================================================
// SORCERER
// =============================================================================

register('sorcerer', 'Innate Sorcery', 1, {
    promptNote: () => 'Innate Sorcery: Bonus action; for 1 min: +1 to spell attack/DC, advantage on sorcerer spell attacks (2/LR or 2 sorcery point)',
});

register('sorcerer', 'Font of Magic', 2, {
    promptNote: (stats) =>
        `Font of Magic: ${stats.level} sorcery points/LR; convert between points and spell slots`,
});

register('sorcerer', 'Metamagic', 2, {
    promptNote: (stats) => {
        const ids = stats.levelChoiceEffects?.metamagic || [];
        if (ids.length > 0) {
            const labels = ids.map(id => METAMAGIC_OPTIONS.find(o => o.id === id)?.label || id);
            return `Metamagic: ${labels.join(', ')}`;
        }
        return 'Metamagic: Modify spells using sorcery points (chosen options apply)';
    },
});

register('sorcerer', 'Sorcerous Restoration', 5, {
    promptNote: () => 'Sorcerous Restoration: When finishing a SR, regain expended sorcery points equal to half your sorcerer level (rounded down)',
});

register('sorcerer', 'Sorcery Incarnate', 7, {
    promptNote: () => 'Sorcery Incarnate: While Innate Sorcery is active, can use 2 Metamagic options on one spell and use Metamagic even if it was already used this turn',
});

register('sorcerer', 'Arcane Apotheosis', 20, {
    promptNote: () => 'Arcane Apotheosis: While Innate Sorcery is active, spend 1 sorcery point when casting a sorcerer spell of Lv1-4 to cast it without expending a spell slot',
});

// Subclass: Draconic Sorcery (PHB'24) / Draconic Bloodline (PHB'14)
register('sorcerer', 'Draconic Resilience', 3, {
    acOverride: (stats) => ({
        formula: 10 + (stats.mods.dex || 0) + (stats.mods.cha || 0),
        requiresNoArmor: true,
        allowsShield: true,
    }),
    hpBonus: (level) => level,
    promptNote: (stats) => {
        const draconicAC = 10 + (stats.mods.dex || 0) + (stats.mods.cha || 0);
        return `Draconic Resilience: AC = ${draconicAC} (10+DEX+CHA) without armor; +${stats.level} HP from bonus per level`;
    },
}, { subclass: 'Draconic' });

// Subclass: Divine Soul
register('sorcerer', 'Favored by the Gods', 3, {
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
    promptNote: (stats) => {
        const el = stats.draconicElement || 'chosen element';
        return `Elemental Affinity: +${stats.mods.cha || 0} (CHA mod) to ${el} spell damage; spend 1 sorcery point for ${el} resistance for 1 hour`;
    },
}, { subclass: 'Draconic' });

register('sorcerer', 'Dragon Wings', 14, {
    promptNote: () => 'Dragon Wings: Bonus Action to sprout draconic wings for 1 hour (or dismiss, no action), Fly Speed 60ft. 1/LR or spend 3 Sorcery Points to restore use',
}, { subclass: 'Draconic' });

register('sorcerer', 'Dragon Companion', 18, {
    promptNote: () => 'Dragon Companion: Cast Summon Dragon without a material component. 1/LR cast without a spell slot. Can modify to remove Concentration (duration becomes 1 minute)',
}, { subclass: 'Draconic' });

// =============================================================================
// WARLOCK
// =============================================================================

register('warlock', 'Eldritch Invocations', 1, {
    promptNote: () => 'Eldritch Invocations: Special abilities chosen from invocation list',
});

register('warlock', 'Magical Cunning', 2, {
    promptNote: () => 'Magical Cunning: When all pact slots are expended, regain half of them (rounded up) once per LR as a 1-min ritual',
});

register('warlock', 'Contact Patron', 9, {
    promptNote: () => 'Contact Patron: Cast Contact Other Plane to reach patron without expending a spell slot (1/LR)',
});

register('warlock', 'Mystic Arcanum', 11, {
    promptNote: (stats) => {
        const spells = [];
        if (stats.level >= 11) spells.push('6th');
        if (stats.level >= 13) spells.push('7th');
        if (stats.level >= 15) spells.push('8th');
        if (stats.level >= 17) spells.push('9th');
        return `Mystic Arcanum: One ${spells.join(', ')} level spell each, castable 1/LR without pact slot`;
    },
});

register('warlock', 'Eldritch Master', 20, {
    promptNote: () => 'Eldritch Master: 1-min ritual to regain all Pact Magic slots (1/LR); also can replace 1 Mystic Arcanum spell on level up',
});

// Subclass: Hexblade
register('warlock', 'Hex Warrior', 3, {
    overrideWeaponAbility: () => 'cha',
    promptNote: () => 'Hex Warrior: Use CHA for weapon attack/damage rolls',
}, { subclass: 'Hexblade' });

// Subclass: Celestial
register('warlock', 'Radiant Soul', 6, {
    spellDamageBonus: (stats) => ({
        filter: { damageType: 'radiant' },
        flatBonus: stats.mods.cha || 0,
    }),
    promptNote: (stats) => `Radiant Soul: +${stats.mods.cha || 0} (CHA mod) to radiant/fire spell damage`,
}, { subclass: 'Celestial' });

// =============================================================================
// WIZARD
// =============================================================================

register('wizard', 'Arcane Recovery', 1, {
    promptNote: (stats) => {
        const slots = Math.ceil(stats.level / 2);
        return `Arcane Recovery: Recover up to ${slots} levels worth of spell slots on SR (1/LR)`;
    },
});

register('wizard', 'Ritual Adept', 1, {
    promptNote: () => 'Ritual Adept: Can cast any prepared wizard spell as a ritual if it has the ritual tag (+10 min casting time)',
});

register('wizard', 'Scholar', 2, {
    promptNote: () => 'Scholar: Gain Expertise in one INT-based skill you\'re proficient in (Arcana, History, Investigation, Nature, or Religion)',
});

register('wizard', 'Memorize Spell', 5, {
    promptNote: () => 'Memorize Spell: During a SR, can replace one prepared spell with another from your spellbook',
});

register('wizard', 'Spell Mastery', 18, {
    promptNote: () => 'Spell Mastery: Choose one 1st and one 2nd level wizard spell; cast them at lowest level without spell slots while prepared',
});

register('wizard', 'Signature Spells', 20, {
    promptNote: () => 'Signature Spells: Choose two 3rd level wizard spells; always prepared (don\'t count against limit) and cast each at 3rd level 1/SR free',
});

// Subclass: Evocation
register('wizard', 'Empowered Evocation', 10, {
    spellDamageBonus: (stats) => ({
        filter: { school: 'V' },
        flatBonus: stats.mods.int || 0,
    }),
    promptNote: (stats) => `Empowered Evocation: +${stats.mods.int || 0} (INT mod) to evocation spell damage`,
}, { subclass: 'Evocation' });

register('wizard', 'Sculpt Spells', 3, {
    promptNote: () => 'Sculpt Spells: Choose creatures in evocation area spell to automatically save and take no damage',
}, { subclass: 'Evocation' });

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
                f.includes(effect.featureName),
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
        if (effect.promptNote) {
            result.promptNotes.push({ name: effect.featureName, fn: effect.promptNote });
        }
        if (effect.overrideWeaponAbility) result.overrideWeaponAbility = effect.overrideWeaponAbility;
        if (effect.healingBonus) result.healingBonus = effect.healingBonus;
        if (effect.meta) Object.assign(result.meta, effect.meta);
    }

    return result;
}

// Load subclass effects (registers additional features via register())
import { registerAllSubclassEffects } from './subclassEffects.js';
registerAllSubclassEffects(register);
