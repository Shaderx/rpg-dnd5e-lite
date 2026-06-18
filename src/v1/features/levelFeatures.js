/**
 * V1 Character System - Level-Derived Features
 * Defines per-level choices for each class/subclass that require user selection.
 *
 * Feature types:
 *   'single-select'  - Choose one option from a list
 *   'multi-select'   - Choose N options from a list
 *   'cantrip-pick'   - Choose cantrips from a class list
 *   'asi'            - Ability Score Improvement or Feat (handled by existing ASI picker)
 *
 * Each feature entry:
 *   { level, id, type, label, description?, options?, count?, classSpellList?, grantedSpell? }
 */

import { ASI_LEVELS } from '../core/constants.js';

// Fighting style options shared across martial classes
const FIGHTER_STYLES = [
    { id: 'archery', label: 'Archery', desc: '+2 to ranged weapon attack rolls' },
    { id: 'defense', label: 'Defense', desc: '+1 AC when wearing armor' },
    { id: 'dueling', label: 'Dueling', desc: '+2 melee damage with one-handed, no other weapon' },
    { id: 'great-weapon', label: 'Great Weapon Fighting', desc: 'Reroll 1s/2s on damage dice with 2H/versatile' },
    { id: 'twf', label: 'Two-Weapon Fighting', desc: 'Add ability mod to off-hand attack damage' },
];

const RANGER_STYLES = [
    { id: 'archery', label: 'Archery', desc: '+2 to ranged weapon attack rolls' },
    { id: 'defense', label: 'Defense', desc: '+1 AC when wearing armor' },
    { id: 'dueling', label: 'Dueling', desc: '+2 melee damage with one-handed, no other weapon' },
    { id: 'twf', label: 'Two-Weapon Fighting', desc: 'Add ability mod to off-hand attack damage' },
    { id: 'druidic-warrior', label: 'Druidic Warrior', desc: 'Learn 2 Druid cantrips (WIS-based)', hasCantrips: true, cantripClass: 'druid', cantripCount: 2 },
];

const PALADIN_STYLES = [
    { id: 'defense', label: 'Defense', desc: '+1 AC when wearing armor' },
    { id: 'dueling', label: 'Dueling', desc: '+2 melee damage with one-handed, no other weapon' },
    { id: 'great-weapon', label: 'Great Weapon Fighting', desc: 'Reroll 1s/2s on damage dice with 2H/versatile' },
    { id: 'blessed-warrior', label: 'Blessed Warrior', desc: 'Learn 2 Cleric cantrips (CHA-based)', hasCantrips: true, cantripClass: 'cleric', cantripCount: 2 },
];

const DIVINE_AFFINITIES = [
    { id: 'good', label: 'Good', grantSpell: 'Cure Wounds' },
    { id: 'evil', label: 'Evil', grantSpell: 'Inflict Wounds' },
    { id: 'law', label: 'Law', grantSpell: 'Bless' },
    { id: 'chaos', label: 'Chaos', grantSpell: 'Bane' },
    { id: 'neutrality', label: 'Neutrality', grantSpell: 'Protection from Evil and Good' },
];

const DRACONIC_ELEMENTS = [
    { id: 'acid', label: 'Acid (Black/Copper)' },
    { id: 'cold', label: 'Cold (Silver/White)' },
    { id: 'fire', label: 'Fire (Brass/Gold/Red)' },
    { id: 'lightning', label: 'Lightning (Blue/Bronze)' },
    { id: 'poison', label: 'Poison (Green)' },
];

export const CLASS_LEVEL_FEATURES = {
    fighter: [
        { level: 1, id: 'fighting-style', type: 'single-select', label: 'Fighting Style', options: FIGHTER_STYLES },
    ],
    ranger: [
        { level: 2, id: 'fighting-style', type: 'single-select', label: 'Fighting Style', options: RANGER_STYLES },
    ],
    paladin: [
        { level: 2, id: 'fighting-style', type: 'single-select', label: 'Fighting Style', options: PALADIN_STYLES },
    ],
    // Sorcerer, Warlock, etc. have subclass-only or optional features handled below
};

export const SUBCLASS_LEVEL_FEATURES = {
    'sorcerer|Divine Soul': [
        { level: 1, id: 'divine-affinity', type: 'single-select', label: 'Divine Magic Affinity',
          description: 'Choose an affinity for the source of your divine power. This grants an additional spell always prepared.',
          options: DIVINE_AFFINITIES },
    ],
    'sorcerer|Draconic Bloodline': [
        { level: 1, id: 'draconic-element', type: 'single-select', label: 'Draconic Ancestry Element',
          description: 'Choose the damage type associated with your draconic ancestry.',
          options: DRACONIC_ELEMENTS },
    ],
};

/**
 * Get all level-derived features for a given class/subclass up to the current level,
 * merged with ASI/Feat entries at standard ASI levels.
 */
export function getLevelFeatures(classKey, subclassName, level) {
    const features = [];

    // Class-level features
    const classFeats = CLASS_LEVEL_FEATURES[classKey] || [];
    for (const feat of classFeats) {
        if (feat.level <= level) features.push({ ...feat, source: 'class' });
    }

    // Subclass-level features
    if (subclassName) {
        const subKey = `${classKey}|${subclassName}`;
        const subFeats = SUBCLASS_LEVEL_FEATURES[subKey] || [];
        for (const feat of subFeats) {
            if (feat.level <= level) features.push({ ...feat, source: 'subclass' });
        }
    }

    // ASI/Feat at standard ASI levels
    for (const lv of ASI_LEVELS) {
        if (lv <= level) {
            features.push({ level: lv, id: 'asi', type: 'asi', label: 'Ability Score Improvement / Feat', source: 'class' });
        }
    }

    features.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
    return features;
}

/**
 * Map a fighting style selection to the feature name used by classEffects.js.
 */
export function fightingStyleToFeatureName(styleId) {
    const map = {
        'archery': 'Fighting Style: Archery',
        'defense': 'Fighting Style: Defense',
        'dueling': 'Fighting Style: Dueling',
        'great-weapon': 'Fighting Style: Great Weapon Fighting',
        'twf': 'Fighting Style: Two-Weapon Fighting',
        'druidic-warrior': 'Druidic Warrior',
        'blessed-warrior': 'Blessed Warrior',
    };
    return map[styleId] || null;
}

/**
 * Get the fighting style option definition by its id.
 */
export function getFightingStyleOption(classKey, styleId) {
    const classFeatDef = (CLASS_LEVEL_FEATURES[classKey] || []).find(f => f.id === 'fighting-style');
    if (!classFeatDef) return null;
    return classFeatDef.options.find(o => o.id === styleId) || null;
}

/**
 * Collect all bonus spells/cantrips from level choices.
 * @param {object} levelChoices - { [level]: { [featureId]: { selected, cantrips?, ... } } }
 * @param {string} classKey
 * @param {string|null} subclassName
 * @returns {{ bonusCantrips: object[], bonusSpells: object[], draconicElement: string|null, chosenFeatures: string[] }}
 */
export function collectLevelChoiceEffects(levelChoices, classKey, subclassName) {
    const result = {
        bonusCantrips: [],
        bonusSpells: [],
        draconicElement: null,
        chosenFeatures: [],
    };

    if (!levelChoices) return result;

    for (const [_lv, choices] of Object.entries(levelChoices)) {
        for (const [featureId, data] of Object.entries(choices || {})) {
            if (!data?.selected) continue;

            if (featureId === 'fighting-style') {
                const featureName = fightingStyleToFeatureName(data.selected);
                if (featureName) result.chosenFeatures.push(featureName);

                const styleDef = getFightingStyleOption(classKey, data.selected);
                if (styleDef?.hasCantrips && data.cantrips?.length) {
                    for (const name of data.cantrips) {
                        result.bonusCantrips.push({
                            name,
                            source: `${styleDef.label} (${styleDef.cantripClass})`,
                        });
                    }
                }
            }

            if (featureId === 'divine-affinity') {
                const affinityDef = DIVINE_AFFINITIES.find(a => a.id === data.selected);
                if (affinityDef?.grantSpell) {
                    result.bonusSpells.push({
                        name: affinityDef.grantSpell,
                        source: 'Divine Soul (Affinity)',
                        alwaysPrepared: true,
                    });
                }
            }

            if (featureId === 'draconic-element') {
                result.draconicElement = data.selected;
            }
        }
    }

    return result;
}
