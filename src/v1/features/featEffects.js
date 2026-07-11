/**
 * V1 Character System - Feat Effects Registry
 * Maps feat names to mechanical bonuses that computeCharacterStats applies.
 *
 * Each entry can provide:
 *   hpBonus(level, stats)         -> number
 *   acBonus(stats)                -> number
 *   speedBonus(stats)             -> number
 *   extraSkills(stats)            -> string[] (skill keys)
 *   extraExpertise(stats)         -> string[] (skill keys)
 *   abilityBonus(stats)           -> { [ability]: bonus }
 *   spellDamageBonus(stats)       -> { filter, flatBonus }
 *   weaponAttackBonus(stats, wpn) -> number
 *   weaponDamageBonus(stats, wpn) -> number
 *   promptNote(stats)             -> string
 */

const FEAT_EFFECTS = {
    'Tough': {
        hpBonus: (level) => level * 2,
    },

    'Medium Armor Master': {
        meta: { mediumArmorMaster: true },
    },

    'Heavy Armor Master': {
        promptNote: (stats) =>
            `Heavy Armor Master: While wearing heavy armor, reduce bludgeoning/piercing/slashing damage by ${stats.proficiency}`,
    },

    'Great Weapon Master': {
        weaponDamageBonus: (stats, wpn) => {
            if (wpn.isHeavy || wpn.isTwoHanded) return stats.proficiency;
            return 0;
        },
        promptNote: (stats) =>
            `Great Weapon Master: +${stats.proficiency} damage on heavy/two-handed weapon attacks`,
    },

    'Sharpshooter': {
        promptNote: () =>
            'Sharpshooter: Ignore half/three-quarters cover; no disadvantage at long range for ranged weapons',
    },

    'Polearm Master': {
        promptNote: () =>
            'Polearm Master: Bonus action d4 bludgeoning butt-end attack with glaive/halberd/quarterstaff/spear; OA when creature enters reach',
    },

    'Sentinel': {
        promptNote: () =>
            'Sentinel: OA reduces speed to 0; can OA even if target Disengages; reaction melee attack when creature within 5ft attacks another target',
    },

    'War Caster': {
        promptNote: () =>
            'War Caster: Advantage on CON saves for concentration; can cast spell as OA instead of melee attack; somatic components with hands full',
    },

    'Resilient': {
        promptNote: () =>
            'Resilient: Proficiency in one chosen saving throw',
    },

    'Lucky': {
        promptNote: () =>
            'Lucky: 3 luck points/LR; spend to reroll d20 or force reroll on attacker',
    },

    'Alert': {
        promptNote: () =>
            'Alert: +5 initiative; cannot be surprised while conscious',
    },

    'Savage Attacker': {
        promptNote: () =>
            'Savage Attacker: Once per turn, reroll melee weapon damage dice and use either result',
    },

    'Elemental Adept': {
        promptNote: () =>
            'Elemental Adept: Spells of chosen element ignore resistance; treat 1s on damage dice as 2s',
    },

    'Healer': {
        promptNote: () =>
            'Healer: Reroll 1s on healing spell dice; healer\'s kit to restore 1d6+4+target HD HP (once per rest per creature)',
    },

    'Skulker': {
        promptNote: () =>
            'Skulker: Can hide when lightly obscured; missing ranged attack doesn\'t reveal position; dim light doesn\'t impose disadvantage on perception',
    },

    'Crossbow Expert': {
        promptNote: () =>
            'Crossbow Expert: Ignore loading; no disadvantage on ranged in melee; bonus action hand crossbow attack after one-handed weapon attack',
    },

    'Dual Wielder': {
        acBonus: (stats) => {
            if (stats.equippedWeaponCount >= 2) return 1;
            return 0;
        },
        promptNote: () =>
            'Dual Wielder: +1 AC when wielding two weapons; can TWF with non-light weapons; draw/stow two weapons',
    },

    'Magic Initiate': {
        promptNote: () =>
            'Magic Initiate: 2 cantrips + 1 1st-level spell (1/LR free cast) from a chosen class list',
    },

    'Ritual Caster': {
        promptNote: () =>
            'Ritual Caster: Ritual casting from a chosen class list; can add ritual spells found in written form',
    },

    'Actor': {
        promptNote: () =>
            'Actor: Advantage on Deception/Performance checks to impersonate; mimic speech/sounds after hearing for 1 min',
    },

    'Athlete': {
        promptNote: () =>
            'Athlete: Standing from prone costs 5ft; climbing doesn\'t cost extra; running jump with 5ft start',
    },

    'Chef': {
        promptNote: () =>
            'Chef: Short rest treats heal extra 1d8 HP; cook special food during LR granting temp HP',
    },

    'Tavern Brawler': {
        promptNote: (stats) =>
            `Tavern Brawler: Unarmed strikes deal 1d4 + ${stats.mods?.str ?? 0} bludgeoning; proficient with improvised weapons; bonus action grapple after unarmed/improvised hit`,
    },

    'Observant': {
        promptNote: () =>
            'Observant: +5 to passive Perception and Investigation; can lip-read',
    },

    'Skilled': {
        promptNote: () =>
            'Skilled: Proficiency in 3 chosen skills or tools',
    },

    'Crafter': {
        promptNote: () =>
            'Crafter: Gain proficiency with 3 artisan\'s tools; craft items at 20% discount; fast crafting during long rest',
    },

    'Musician': {
        promptNote: () =>
            'Musician: Gain proficiency with 3 musical instruments; Inspiring Song gives temp HP (1d4 per song) to allies during short/long rest',
    },

    'Fey Touched': {
        promptNote: () =>
            'Fey Touched: Misty Step + 1 chosen Divination/Enchantment 1st-level spell (each 1/LR free cast, also castable with slots)',
    },

    'Shadow Touched': {
        promptNote: () =>
            'Shadow Touched: Invisibility + 1 chosen Illusion/Necromancy 1st-level spell (each 1/LR free cast, also castable with slots)',
    },

    'Skill Expert': {
        promptNote: () =>
            'Skill Expert: +1 skill proficiency; expertise (double prof) in one skill you are proficient in',
    },
};

/**
 * Get the effect entry for a feat by name.
 * Handles compound names like "Magic Initiate: Cleric" by checking base name.
 * @param {string} featName
 * @returns {object|null}
 */
function normalizeFeatName(name) {
    if (!name) return '';
    return name.replace(/-/g, ' ');
}

export function getFeatEffect(featName) {
    if (!featName) return null;
    if (FEAT_EFFECTS[featName]) return FEAT_EFFECTS[featName];
    const normalized = normalizeFeatName(featName);
    if (FEAT_EFFECTS[normalized]) return FEAT_EFFECTS[normalized];
    const baseName = normalized.split(':')[0].trim();
    return FEAT_EFFECTS[baseName] || null;
}

/**
 * Collect all feat effects from a character's chosen feats.
 * @param {object} asiChoices - { [level]: { type:'feat', feat:'...' } }
 * @param {string} [originFeat] - Background origin feat name
 * @param {object} [originFeatConfig] - Config choices for origin feat (e.g. Skilled picks)
 * @param {object} [featData] - Fallback config store keyed by feat name (used when asiChoices[].featConfig is missing)
 * @returns {object} Aggregated effects
 */
export function collectFeatEffects(asiChoices, originFeat, originFeatConfig, featData) {
    const effects = {
        hpBonus: [],
        acBonus: [],
        speedBonus: [],
        extraSkills: [],
        extraExpertise: [],
        extraTools: [],
        bonusCantrips: [],
        bonusSpells: [],
        spellDamageBonus: [],
        weaponAttackBonus: [],
        weaponDamageBonus: [],
        promptNotes: [],
        meta: {},
    };

    const featNames = [];
    if (originFeat) featNames.push(originFeat);

    for (const choice of Object.values(asiChoices || {})) {
        if (choice?.type === 'feat' && choice.feat) {
            featNames.push(choice.feat);
        }
    }

    for (const name of featNames) {
        const fx = getFeatEffect(name);
        if (!fx) continue;

        if (fx.hpBonus) effects.hpBonus.push(fx.hpBonus);
        if (fx.acBonus) effects.acBonus.push(fx.acBonus);
        if (fx.speedBonus) effects.speedBonus.push(fx.speedBonus);
        if (fx.extraSkills) effects.extraSkills.push(fx.extraSkills);
        if (fx.extraExpertise) effects.extraExpertise.push(fx.extraExpertise);
        if (fx.spellDamageBonus) effects.spellDamageBonus.push(fx.spellDamageBonus);
        if (fx.weaponAttackBonus) effects.weaponAttackBonus.push(fx.weaponAttackBonus);
        if (fx.weaponDamageBonus) effects.weaponDamageBonus.push(fx.weaponDamageBonus);
        if (fx.promptNote) effects.promptNotes.push(fx.promptNote);
        if (fx.meta) Object.assign(effects.meta, fx.meta);
    }

    // Apply origin feat config choices (Skilled, Magic Initiate, etc.)
    if (originFeatConfig) {
        applyOriginFeatConfig(effects, originFeat, originFeatConfig);
    }

    // Apply ASI feat config choices (e.g. Magic Initiate chosen via ASI)
    // Falls back to featData[featName] when featConfig wasn't embedded in asiChoices
    for (const choice of Object.values(asiChoices || {})) {
        if (choice?.type === 'feat' && choice.feat) {
            const config = choice.featConfig || featData?.[choice.feat] || null;
            if (config) {
                applyOriginFeatConfig(effects, choice.feat, config);
            }
        }
    }

    return effects;
}

const SKILL_KEYS = new Set([
    'acrobatics', 'animal-handling', 'arcana', 'athletics', 'deception',
    'history', 'insight', 'intimidation', 'investigation', 'medicine',
    'nature', 'perception', 'performance', 'persuasion', 'religion',
    'sleight-of-hand', 'stealth', 'survival',
]);

function applyOriginFeatConfig(effects, featName, config) {
    // Skilled: user-chosen 3 skills/tools
    if (config.skilledChoices?.length) {
        for (const item of config.skilledChoices) {
            if (SKILL_KEYS.has(item)) {
                effects.extraSkills.push(() => [item]);
            } else {
                effects.extraTools.push(item);
            }
        }
    }

    // Magic Initiate: granted cantrips and spell
    if (config.miCantrips?.length) {
        const listName = config.miClass || 'unknown';
        for (const name of config.miCantrips) {
            effects.bonusCantrips.push({ name, source: `Magic Initiate (${listName})` });
        }
    }
    if (config.miSpell) {
        const listName = config.miClass || 'unknown';
        effects.bonusSpells.push({
            name: config.miSpell,
            source: `Magic Initiate (${listName})`,
            freeCast: true,
            level: 1,
        });
    }

    // Fey Touched: Misty Step + 1 chosen div/ench spell
    const baseName = normalizeFeatName((featName || '').split(':')[0].trim());
    if (baseName === 'Fey Touched') {
        effects.bonusSpells.push({ name: 'Misty Step', source: 'Fey Touched', freeCast: true, level: 2 });
        if (config.ftSpell) {
            effects.bonusSpells.push({ name: config.ftSpell, source: 'Fey Touched', freeCast: true, level: 1 });
        }
    }

    // Shadow Touched: Invisibility + 1 chosen ill/nec spell
    if (baseName === 'Shadow Touched') {
        effects.bonusSpells.push({ name: 'Invisibility', source: 'Shadow Touched', freeCast: true, level: 2 });
        if (config.stSpell) {
            effects.bonusSpells.push({ name: config.stSpell, source: 'Shadow Touched', freeCast: true, level: 1 });
        }
    }

    // Skill Expert: 1 proficiency + 1 expertise
    if (config.seSkill) {
        effects.extraSkills.push(() => [config.seSkill]);
    }
    if (config.seExpertise) {
        effects.extraExpertise.push(() => [config.seExpertise]);
    }

    // Elemental Adept: record chosen damage type for prompt
    if (config.eaDamageType) {
        effects.promptNotes.push(() =>
            `Elemental Adept (${config.eaDamageType}): Spells ignore ${config.eaDamageType} resistance; treat 1s as 2s on ${config.eaDamageType} damage dice`,
        );
    }

    // Resilient: saving throw proficiency
    if (config.resSave) {
        if (!effects.extraSaves) effects.extraSaves = [];
        effects.extraSaves.push(config.resSave);
        effects.promptNotes.push(() =>
            `Resilient: Proficiency in ${config.resSave.toUpperCase()} saving throws`,
        );
    }

    // Ritual Caster: record chosen class + add chosen ritual spells
    if (config.rcClass) {
        effects.promptNotes.push(() =>
            `Ritual Caster (${config.rcClass}): Can cast ${config.rcClass} ritual spells from a ritual book`,
        );
        if (config.rcSpells?.length) {
            for (const spellName of config.rcSpells) {
                effects.bonusSpells.push({
                    name: spellName,
                    source: `Ritual Caster (${config.rcClass})`,
                    ritualOnly: true,
                });
            }
        }
    }

    // Crafter: 3 artisan's tools
    if (config.crafterTools?.length) {
        for (const tool of config.crafterTools) {
            effects.extraTools.push(tool);
        }
    }

    // Musician: 3 instruments
    if (config.musicianInstruments?.length) {
        for (const inst of config.musicianInstruments) {
            effects.extraTools.push(inst);
        }
    }
}

/**
 * Parse the ability bonus from a feat's ASI choice.
 * @param {object} choice - { type:'feat', feat:'...', featAbility:'str' }
 * @param {object} featData - { [featName]: { chosenAbility: 'dex', ... } }
 * @returns {{ [ability]: number }} Ability bonuses from this feat
 */
export function parseFeatAbilityBonus(choice, featData) {
    if (!choice || choice.type !== 'feat') return {};
    const bonus = {};
    if (choice.featAbility) {
        bonus[choice.featAbility] = (bonus[choice.featAbility] || 0) + 1;
    }
    const fd = featData?.[choice.feat];
    if (fd?.chosenAbility) {
        bonus[fd.chosenAbility] = (bonus[fd.chosenAbility] || 0) + 1;
    }
    return bonus;
}
