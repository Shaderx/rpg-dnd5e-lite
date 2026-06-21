/**
 * V1 Character System - Core Engine
 * createCharacter(): build a new character object from wizard selections.
 * computeCharacterStats(): derive all stats from a stored character object.
 */

import {
    ABILITY_KEYS, ABILITY_LABELS, ASI_LEVELS,
    getProficiencyBonus, getModifier, getSpellSlots, CANTRIPS_KNOWN,
    SPELLS_KNOWN, PREPARED_CASTERS, getPreparedCount, SKILLS, SKILL_LABELS,
    HIT_DICE, SPELLCASTING_ABILITY, CASTER_TYPE, SPELLCASTING_SUBCLASSES,
    MARTIAL_ARTS_DIE, getClassResources,
} from '../core/constants.js';
import { collectFeatEffects, parseFeatAbilityBonus } from './featEffects.js';
import { collectClassEffects } from './classEffects.js';
import { collectLevelChoiceEffects, computeCompanionStats, FAMILIAR_CREATURES, METAMAGIC_OPTIONS, ELDRITCH_INVOCATIONS, PACT_BOON_OPTIONS, BATTLE_MASTER_MANEUVERS, ARCANE_SHOT_OPTIONS, SUBCLASS_LEVEL_FEATURES } from './levelFeatures.js';
import { getSubclassSpells } from './subclassSpells.js';
import { getResolvedClassFeaturesSync } from './classData.js';
import { computeAC, computeWeaponStats } from './equipment.js';
import { getSpellDamageInfo, buildSpellAnnotation, getMaxSpellLevel, formatSlots } from './spells.js';

/**
 * Create a new V1 character object from config modal selections.
 * @param {object} config - All wizard selections
 * @returns {object} Character object ready for persistence
 */
export function createCharacter(config) {
    return {
        id: config.editId || `pc_${Date.now()}`,
        name: config.name || '',

        // Species
        speciesName: config.speciesName || '',
        speciesSource: config.speciesSource || 'XPHB',
        speciesTraits: config.speciesTraits || [],
        speciesSpeed: config.speciesSpeed ?? 30,
        speciesSize: config.speciesSize || 'Medium',
        speciesDarkvision: config.speciesDarkvision ?? 0,
        speciesResistances: config.speciesResistances || [],
        speciesLanguages: config.speciesLanguages || [],
        speciesCreatureType: config.speciesCreatureType || 'Humanoid',

        // Background
        backgroundName: config.backgroundName || '',
        backgroundSource: config.backgroundSource || 'XPHB',
        originFeat: config.originFeat || '',
        originFeatConfig: config.originFeatConfig || {},
        backgroundSkills: config.backgroundSkills || [],
        backgroundTools: config.backgroundTools || [],
        backgroundAbilityBoosts: config.backgroundAbilityBoosts || {},

        // Class
        className: config.className || '',
        classSource: config.classSource || 'XPHB',
        classFile: config.classFile || '',
        subclassName: config.subclassName || null,
        subclassShortName: config.subclassShortName || null,
        subclassSource: config.subclassSource || null,
        level: config.level || 1,

        // Ability Scores
        abilityMethod: config.abilityMethod || 'standard_array',
        baseAbilities: config.baseAbilities || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },

        // ASI / Feats
        asiChoices: config.asiChoices || {},
        featData: config.featData || {},

        // Level-derived feature choices (fighting style, subclass options, etc.)
        levelChoices: config.levelChoices || {},

        // Legacy: kept for backward compat during migration
        chosenFeatures: config.chosenFeatures || [],
        draconicElement: config.draconicElement || null,

        // Proficiencies
        saveProficiencies: config.saveProficiencies || [],
        skillChoices: config.skillChoices || [],
        skillExpertise: config.skillExpertise || [],
        toolChoices: config.toolChoices || [],
        armorProficiencies: config.armorProficiencies || [],
        weaponProficiencies: config.weaponProficiencies || [],
        languageChoices: config.languageChoices || [],

        // Equipment
        equippedArmor: config.equippedArmor || null,
        hasShield: config.hasShield || false,
        weapons: config.weapons || [],

        // Spells
        knownCantrips: config.knownCantrips || [],
        knownSpells: config.knownSpells || [],
        extraSpells: config.extraSpells || [],
        customSpells: config.customSpells || [],

        // Companion (familiar / primal)
        companionData: config.companionData || { type: null, form: null, name: '', creatureType: null },

        // Display/injection controls
        enabledFeatures: config.enabledFeatures || {},
        enabled: config.enabled !== false,
    };
}

/**
 * Compute all derived stats from a V1 character object.
 * @param {object} char - Stored character object
 * @returns {object} Full computed stats
 */
export function computeCharacterStats(char) {
    if (!char) return null;

    const classKey = char.className.toLowerCase();
    const level = char.level || 1;
    const proficiency = getProficiencyBonus(level);

    // --- Ability Scores ---
    const finalAbilities = { ...char.baseAbilities };

    // Apply background ability boosts
    if (char.backgroundAbilityBoosts) {
        for (const [ab, bonus] of Object.entries(char.backgroundAbilityBoosts)) {
            if (ABILITY_KEYS.includes(ab)) {
                finalAbilities[ab] = (finalAbilities[ab] || 10) + bonus;
            }
        }
    }

    // Apply ASI choices and feat ability bonuses
    for (const [lv, choice] of Object.entries(char.asiChoices || {})) {
        if (parseInt(lv) > level) continue;

        if (choice.type === 'asi' && Array.isArray(choice.abilities)) {
            for (const ab of choice.abilities) {
                if (ABILITY_KEYS.includes(ab)) finalAbilities[ab] += 1;
            }
        } else if (choice.type === 'feat') {
            const bonus = parseFeatAbilityBonus(choice, char.featData);
            for (const [ab, val] of Object.entries(bonus)) {
                if (ABILITY_KEYS.includes(ab)) finalAbilities[ab] += val;
            }
        }
    }

    // Cap at 20
    for (const ab of ABILITY_KEYS) {
        finalAbilities[ab] = Math.min(finalAbilities[ab], 20);
    }

    // Modifiers
    const mods = {};
    for (const ab of ABILITY_KEYS) {
        mods[ab] = getModifier(finalAbilities[ab]);
    }

    // --- Collect Effects ---
    const featEffects = collectFeatEffects(char.asiChoices, char.originFeat, char.originFeatConfig, char.featData);

    // Gather level-choice effects (fighting styles, subclass selections, etc.)
    const levelChoiceEffects = collectLevelChoiceEffects(char.levelChoices, classKey, char.subclassName, level);
    const allChosenFeatures = [
        ...(char.chosenFeatures || []),
        ...levelChoiceEffects.chosenFeatures,
    ];

    // Subclass spells (always-prepared or bonus-known)
    const subclassSpellData = char.subclassName
        ? getSubclassSpells(classKey, char.subclassName, level)
        : { spells: [], isKnown: false, bonusCantrips: [] };

    // Companion (Beast Master primal + Find Familiar + Pact of the Chain)
    let companion = null;
    if (levelChoiceEffects.companion && classKey === 'ranger') {
        companion = computeCompanionStats(
            levelChoiceEffects.companion,
            level,
            proficiency,
            mods.wis || 0
        );
    }

    const extraSpellNames = (char.extraSpells || []).map(e => typeof e === 'string' ? e : e.name);
    const allSpellNames = [
        ...(char.knownSpells || []),
        ...extraSpellNames,
        ...(featEffects.bonusSpells || []).map(s => s.name),
        ...levelChoiceEffects.bonusSpells.map(s => s.name),
    ];
    const hasFindFamiliar = allSpellNames.some(s => s.toLowerCase() === 'find familiar');
    const isPactChain = levelChoiceEffects.pactBoon === 'chain';
    const isBeastMaster = char.subclassName && char.subclassName.includes('Beast Master');
    const hasCompanionAccess = hasFindFamiliar || isPactChain || isBeastMaster;

    let familiarStats = null;
    const cd = char.companionData || {};
    if (hasCompanionAccess && cd.form) {
        if (cd.type === 'familiar' && FAMILIAR_CREATURES[cd.form]) {
            familiarStats = { ...FAMILIAR_CREATURES[cd.form] };
            if (cd.name) familiarStats.customName = cd.name;
            if (cd.creatureType) familiarStats.creatureType = cd.creatureType;
        } else if (cd.type === 'primal' && companion) {
            if (cd.name) companion.customName = cd.name;
        }
    }

    const classEffects = collectClassEffects(
        classKey, char.subclassName, level, allChosenFeatures
    );

    // Override draconic element from level choices if set
    const effectiveDraconicElement = levelChoiceEffects.draconicElement || char.draconicElement;

    // Stats context for effect functions
    const statsCtx = {
        level,
        proficiency,
        mods,
        abilities: finalAbilities,
        hasArmor: !!char.equippedArmor,
        equippedWeaponCount: (char.weapons || []).length,
        draconicElement: effectiveDraconicElement,
        levelChoiceEffects,
    };

    // --- HP ---
    const hitDie = HIT_DICE[classKey] || 8;
    const conMod = mods.con || 0;
    const avgHpPerLevel = Math.ceil(hitDie / 2) + 1; // average rounded up
    let hp = hitDie + conMod; // level 1: max die + CON
    for (let lv = 2; lv <= level; lv++) {
        hp += avgHpPerLevel + conMod;
    }
    // Feat HP bonuses (e.g. Tough)
    for (const fn of featEffects.hpBonus) {
        hp += fn(level, statsCtx);
    }
    // Class HP bonuses (e.g. Draconic Resilience)
    for (const fn of classEffects.hpBonus) {
        hp += fn(level, statsCtx);
    }

    // --- Speed ---
    let speed = char.speciesSpeed || 30;
    for (const fn of classEffects.speedBonus) {
        speed += fn(level, statsCtx);
    }
    for (const fn of featEffects.speedBonus || []) {
        speed += fn(level, statsCtx);
    }

    // --- AC ---
    let unarmoredFormula = null;
    for (const fn of classEffects.acOverrides) {
        const override = fn(statsCtx);
        if (!char.equippedArmor && override.requiresNoArmor) {
            if (override.allowsShield || !char.hasShield) {
                unarmoredFormula = unarmoredFormula
                    ? Math.max(unarmoredFormula, override.formula)
                    : override.formula;
            }
        }
    }

    let defenseBonus = 0;
    for (const fn of classEffects.acBonus) {
        defenseBonus += fn(statsCtx);
    }
    for (const fn of featEffects.acBonus) {
        defenseBonus += fn(statsCtx);
    }

    const ac = computeAC(
        char.equippedArmor,
        char.hasShield,
        mods.dex,
        {
            unarmoredFormula,
            defenseBonus,
            mediumArmorMaster: !!featEffects.meta.mediumArmorMaster,
        }
    );

    // --- Saves ---
    const saves = {};
    const saveProficiencies = new Set(char.saveProficiencies || []);
    for (const s of (featEffects.extraSaves || [])) saveProficiencies.add(s);
    for (const ab of ABILITY_KEYS) {
        const isProficient = saveProficiencies.has(ab);
        saves[ab] = {
            mod: mods[ab] + (isProficient ? proficiency : 0),
            proficient: isProficient,
        };
    }

    // --- Skills ---
    const allSkillProfs = new Set([
        ...(char.skillChoices || []),
        ...(char.backgroundSkills || []),
    ]);
    // Add feat-granted skills
    for (const fn of featEffects.extraSkills) {
        const extra = fn(statsCtx);
        if (Array.isArray(extra)) extra.forEach(s => allSkillProfs.add(s));
    }

    const allExpertise = new Set(char.skillExpertise || []);
    for (const fn of featEffects.extraExpertise || []) {
        const extra = fn(statsCtx);
        if (Array.isArray(extra)) extra.forEach(s => allExpertise.add(s));
    }

    const skills = {};
    for (const [skillKey, abilityKey] of Object.entries(SKILLS)) {
        const isProficient = allSkillProfs.has(skillKey);
        const isExpert = allExpertise.has(skillKey);
        const bonus = mods[abilityKey]
            + (isProficient ? proficiency : 0)
            + (isExpert ? proficiency : 0);
        skills[skillKey] = {
            label: SKILL_LABELS[skillKey],
            ability: abilityKey,
            mod: bonus,
            proficient: isProficient,
            expertise: isExpert,
        };
    }

    // --- Spellcasting ---
    let spellcasting = null;
    const spellAbKey = SPELLCASTING_ABILITY[classKey];
    const casterType = CASTER_TYPE[classKey];

    if (spellAbKey && casterType) {
        // Third-casters need the right subclass
        if (casterType === 'third') {
            const validSubs = SPELLCASTING_SUBCLASSES[classKey] || [];
            if (!char.subclassName || !validSubs.some(s => char.subclassName.includes(s))) {
                // Not a spellcasting subclass
            } else {
                spellcasting = buildSpellcasting(classKey, level, spellAbKey, mods, char);
            }
        } else {
            spellcasting = buildSpellcasting(classKey, level, spellAbKey, mods, char);
        }
    }

    // --- Spell Damage Bonuses ---
    let potentMod = 0;
    let empoweredSchool = null;
    let empoweredMod = 0;
    let healingBonusFn = null;

    for (const fn of classEffects.spellDamageBonus) {
        const bonus = fn(statsCtx);
        if (bonus.filter?.cantripOnly) {
            potentMod = Math.max(potentMod, bonus.flatBonus);
        } else if (bonus.filter?.school) {
            empoweredSchool = bonus.filter.school;
            empoweredMod = bonus.flatBonus;
        } else if (bonus.filter?.damageType) {
            // Element-specific (Draconic Sorcerer) — stored for annotation
            empoweredSchool = null;
            empoweredMod = bonus.flatBonus;
        }
    }

    if (classEffects.healingBonus) {
        healingBonusFn = classEffects.healingBonus;
    }

    // --- Weapons ---
    const overrideAbility = classEffects.overrideWeaponAbility
        ? classEffects.overrideWeaponAbility(statsCtx)
        : null;
    const martialArtsDie = classEffects.meta.martialArtsDie
        ? MARTIAL_ARTS_DIE[level - 1] || 6
        : null;

    const computedWeapons = (char.weapons || []).map(wpn => {
        let atkBonus = 0;
        let dmgBonus = 0;
        for (const fn of classEffects.weaponAttackBonus) {
            atkBonus += fn(statsCtx, wpn);
        }
        for (const fn of classEffects.weaponDamageBonus) {
            dmgBonus += fn(statsCtx, wpn);
        }
        for (const fn of featEffects.weaponAttackBonus) {
            atkBonus += fn(statsCtx, wpn);
        }
        for (const fn of featEffects.weaponDamageBonus) {
            dmgBonus += fn(statsCtx, wpn);
        }

        return computeWeaponStats(wpn, mods, proficiency, {
            attackBonus: atkBonus,
            damageBonus: dmgBonus,
            overrideAbility,
            martialArtsDie,
        });
    });

    // --- Spell Annotations ---
    const spellBonuses = { potentMod, empoweredSchool, empoweredMod, healingBonusFn };

    const annotatedCantrips = (char.knownCantrips || []).map(name => {
        const info = getSpellDamageInfo(name, level, spellBonuses);
        return { name, annotation: buildSpellAnnotation(name, info), info };
    });

    const annotatedSpells = (char.knownSpells || []).map(name => {
        const info = getSpellDamageInfo(name, level, spellBonuses);
        return { name, annotation: buildSpellAnnotation(name, info), info };
    });
    for (const entry of (char.extraSpells || [])) {
        const name = typeof entry === 'string' ? entry : entry.name;
        const source = (typeof entry === 'object' && entry.source) || '';
        const freeCast = (typeof entry === 'object' && entry.freeCast) || '';
        const info = getSpellDamageInfo(name, level, spellBonuses);
        annotatedSpells.push({ name, annotation: buildSpellAnnotation(name, info), info, extraSource: source, extraFreeCast: freeCast });
    }

    const classFeatures = getResolvedClassFeaturesSync(
        char.classFile,
        char.className,
        char.classSource,
        char.subclassName,
        level,
    );
    const cdnFeatureNames = new Set(classFeatures.map(f => f.name.toLowerCase()));

    // Build compact note lookup from class effects for CDN feature annotation
    const compactNoteMap = new Map();
    for (const entry of classEffects.promptNotes) {
        if (entry.name) {
            const note = entry.fn(statsCtx);
            if (note) compactNoteMap.set(entry.name.toLowerCase(), note);
        }
    }

    // Annotate CDN features with compact notes where available
    const annotatedClassFeatures = classFeatures.map(f => ({
        ...f,
        compactNote: compactNoteMap.get(f.name.toLowerCase()) || null,
    }));

    // Combat Notes: class notes without CDN match + all feat notes
    const combatNotes = [];
    for (const entry of classEffects.promptNotes) {
        if (entry.name && cdnFeatureNames.has(entry.name.toLowerCase())) continue;
        const note = entry.fn(statsCtx);
        if (note) combatNotes.push(note);
    }
    for (const fn of featEffects.promptNotes) {
        const note = fn(statsCtx);
        if (note) combatNotes.push(note);
    }

    // --- Languages ---
    const languages = [...new Set([
        ...(char.speciesLanguages || []),
        ...(char.languageChoices || []),
    ])];

    // --- Senses ---
    const senses = [];
    if (char.speciesDarkvision) senses.push(`Darkvision ${char.speciesDarkvision}ft`);

    // --- Class Resources ---
    const classResources = getClassResources(classKey, level, mods);

    // --- Level Choice Details (for prompt output + character sheet) ---
    const resolveOptions = (ids, options) =>
        ids.map(id => options.find(o => o.id === id)).filter(Boolean);

    const pactBoonObj = levelChoiceEffects.pactBoon
        ? PACT_BOON_OPTIONS.find(o => o.id === levelChoiceEffects.pactBoon) || null
        : null;

    const kenseiDef = SUBCLASS_LEVEL_FEATURES['monk|Way of the Kensei']?.find(f => f.id === 'kensei-weapons');
    const kenseiOpts = kenseiDef?.options || [];
    const resolvedKensei = levelChoiceEffects.kenseiWeapons.map(id => {
        const opt = kenseiOpts.find(o => o.id === id);
        return opt?.label || id;
    });

    const levelChoiceDetails = {
        metamagic: resolveOptions(levelChoiceEffects.metamagic, METAMAGIC_OPTIONS),
        invocations: resolveOptions(levelChoiceEffects.invocations, ELDRITCH_INVOCATIONS),
        pactBoon: pactBoonObj,
        maneuvers: resolveOptions(levelChoiceEffects.maneuvers, BATTLE_MASTER_MANEUVERS),
        arcaneShots: resolveOptions(levelChoiceEffects.arcaneShots, ARCANE_SHOT_OPTIONS),
        kenseiWeapons: resolvedKensei,
    };

    return {
        // Identity
        name: char.name,
        speciesName: char.speciesName,
        backgroundName: char.backgroundName,
        className: char.className,
        subclassName: char.subclassName,
        level,

        // Core stats
        abilities: finalAbilities,
        mods,
        proficiency,
        hp,
        ac,
        speed,
        hitDie,

        // Saves and skills
        saves,
        skills,

        // Combat
        computedWeapons,
        combatNotes,
        classFeatures: annotatedClassFeatures,

        // Spellcasting
        spellcasting,
        annotatedCantrips,
        annotatedSpells,
        potentMod,
        empoweredSchool,
        empoweredMod,

        // Species
        speciesTraits: char.speciesTraits || [],
        speciesSize: char.speciesSize,
        speciesCreatureType: char.speciesCreatureType,
        speciesResistances: char.speciesResistances || [],
        senses,
        languages,

        // Equipment
        equippedArmor: char.equippedArmor,
        hasShield: char.hasShield,

        // Feats
        chosenFeats: getChosenFeatNames(char),
        featExtraTools: featEffects.extraTools || [],
        featBonusCantrips: [
            ...(featEffects.bonusCantrips || []),
            ...levelChoiceEffects.bonusCantrips,
            ...subclassSpellData.bonusCantrips.map(name => ({ name, source: `${char.subclassName}` })),
        ],
        featBonusSpells: [
            ...(featEffects.bonusSpells || []),
            ...levelChoiceEffects.bonusSpells,
        ],

        // Subclass spells
        subclassSpells: subclassSpellData.spells,
        subclassSpellsAreKnown: subclassSpellData.isKnown,

        // Class resources (Ki, Sorcery Points, Rage, etc.)
        classResources,

        // Companion
        companion,
        familiarStats,
        hasCompanionAccess,
        hasFindFamiliar,
        companionData: cd,
        isPactChain,

        // Level choice details (metamagic, invocations, maneuvers, etc.)
        levelChoiceDetails,

        // Feature toggles
        enabledFeatures: char.enabledFeatures || {},
        enabled: char.enabled,
    };
}

function buildSpellcasting(classKey, level, spellAbKey, mods, char) {
    const abMod = mods[spellAbKey] || 0;
    const proficiency = getProficiencyBonus(level);
    const slots = getSpellSlots(classKey, level, char.subclassName);
    const maxSpellLv = getMaxSpellLevel(slots);

    const cantripsKnown = CANTRIPS_KNOWN[classKey]?.[level - 1] ?? 0;
    const isPrepared = PREPARED_CASTERS.includes(classKey);
    const spellsKnown = isPrepared
        ? getPreparedCount(classKey, level, abMod)
        : (SPELLS_KNOWN[classKey]?.[level - 1] ?? 0);

    return {
        ability: spellAbKey,
        abilityLabel: ABILITY_LABELS[spellAbKey],
        attackMod: proficiency + abMod,
        saveDC: 8 + proficiency + abMod,
        cantripsKnown,
        spellsKnown,
        isPrepared,
        slots,
        slotsStr: formatSlots(slots),
        maxSpellLevel: maxSpellLv,
        casterType: CASTER_TYPE[classKey],
    };
}

function getChosenFeatNames(char) {
    const names = [];
    if (char.originFeat) names.push(char.originFeat);
    for (const choice of Object.values(char.asiChoices || {})) {
        if (choice?.type === 'feat' && choice.feat) names.push(choice.feat);
    }
    return names;
}
