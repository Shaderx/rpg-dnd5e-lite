/**
 * V1 Character System - Background
 * Fetch and parse background data from CDN (PHB'24 / XPHB).
 */

import { fetchBackgrounds } from '../data/sources.js';

/**
 * Get all available backgrounds filtered to XPHB source.
 * @returns {Promise<object[]>} Parsed background objects
 */
export async function getAvailableBackgrounds() {
    const data = await fetchBackgrounds();
    if (!data?.background) return [];
    return data.background
        .filter(b => b.source === 'XPHB')
        .map(parseBackground);
}

/**
 * Find a background by name and source.
 */
export async function findBackground(name, source) {
    const all = await getAvailableBackgrounds();
    return all.find(b => b.name === name && b.source === (source || 'XPHB')) || null;
}

/**
 * Parse a raw 5e.tools background entry into our format.
 */
function parseBackground(bg) {
    const skills = [];
    const tools = [];
    let originFeat = null;
    const languages = [];

    // Skill proficiencies
    if (bg.skillProficiencies) {
        for (const sp of bg.skillProficiencies) {
            for (const [key, val] of Object.entries(sp)) {
                if (val === true) skills.push(normalizeSkillKey(key));
            }
        }
    }

    // Tool proficiencies
    if (bg.toolProficiencies) {
        for (const tp of bg.toolProficiencies) {
            for (const [key, val] of Object.entries(tp)) {
                if (val === true && key !== 'anyArtisansTool') {
                    tools.push(key);
                } else if (key === 'anyArtisansTool') {
                    tools.push('any artisan\'s tools');
                }
            }
        }
    }

    // Language proficiencies
    if (bg.languageProficiencies) {
        for (const lp of bg.languageProficiencies) {
            for (const [key, val] of Object.entries(lp)) {
                if (val === true) languages.push(key.charAt(0).toUpperCase() + key.slice(1));
            }
        }
    }

    // Origin feat — PHB'24 backgrounds each grant one via feats array.
    // Keys are formatted as "FeatName|source" or "feat; class|source"
    if (bg.feats) {
        for (const featRef of bg.feats) {
            for (const [rawKey] of Object.entries(featRef)) {
                originFeat = cleanFeatName(rawKey);
                break;
            }
            if (originFeat) break;
        }
    }

    // Ability score increases: PHB'24 backgrounds give +2/+1 or +1/+1/+1
    const abilityBoostOptions = parseAbilityBoosts(bg);

    return {
        name: bg.name,
        source: bg.source,
        skills,
        tools,
        languages,
        originFeat,
        abilityBoostOptions,
        _raw: bg,
    };
}

/**
 * Parse ability boost options from a background entry.
 * PHB'24 backgrounds use { choose: { weighted: { from: [...], weights: [...] } } }
 * First group is the +2/+1 option, second is the +1/+1/+1 option.
 * Both restrict choices to specific abilities.
 */
function parseAbilityBoosts(bg) {
    if (!bg.ability) return { mode: 'free', from: ['str', 'dex', 'con', 'int', 'wis', 'cha'] };

    // PHB'24 format: array of groups with choose.weighted
    const options = [];
    for (const group of bg.ability) {
        if (group.choose?.weighted) {
            const w = group.choose.weighted;
            options.push({
                from: w.from || [],
                weights: w.weights || [],
            });
        } else if (group.choose?.from) {
            options.push({
                from: group.choose.from || [],
                weights: [1],
            });
        }
    }

    if (options.length >= 2) {
        return {
            mode: 'weighted',
            from: options[0].from,
            twoOne: options[0],
            threeWay: options[1],
        };
    } else if (options.length === 1) {
        return { mode: 'weighted', from: options[0].from, twoOne: options[0], threeWay: null };
    }

    return { mode: 'free', from: ['str', 'dex', 'con', 'int', 'wis', 'cha'] };
}

/**
 * Clean 5e.tools feat reference key to a display name.
 * "Skilled|xphb" -> "Skilled"
 * "magic initiate; cleric|xphb" -> "Magic Initiate: Cleric"
 */
function cleanFeatName(rawKey) {
    // Strip source suffix ("|xphb")
    let name = rawKey.split('|')[0].trim();
    // "magic initiate; cleric" -> "Magic Initiate: Cleric"
    if (name.includes(';')) {
        const parts = name.split(';').map(p => p.trim());
        name = parts.map(p => p.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')).join(': ');
    } else {
        name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    return name;
}

/**
 * Normalize a skill key from 5e.tools format to our kebab-case format.
 */
function normalizeSkillKey(key) {
    const map = {
        'acrobatics': 'acrobatics',
        'animal handling': 'animal-handling',
        'animalhandling': 'animal-handling',
        'arcana': 'arcana',
        'athletics': 'athletics',
        'deception': 'deception',
        'history': 'history',
        'insight': 'insight',
        'intimidation': 'intimidation',
        'investigation': 'investigation',
        'medicine': 'medicine',
        'nature': 'nature',
        'perception': 'perception',
        'performance': 'performance',
        'persuasion': 'persuasion',
        'religion': 'religion',
        'sleight of hand': 'sleight-of-hand',
        'sleightofhand': 'sleight-of-hand',
        'stealth': 'stealth',
        'survival': 'survival',
    };
    return map[key.toLowerCase().replace(/\s+/g, '')] || key.toLowerCase().replace(/\s+/g, '-');
}
