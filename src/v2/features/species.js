/**
 * V1 Character System - Species
 * Fetch and parse species (race) data from CDN, merge with custom species.
 */

import { fetchRaces } from '../data/sources.js';
import { extensionSettings } from '../../core/state.js';

/**
 * Parse a CDN species entry into our normalized format.
 * @param {object} race - Raw 5e.tools race object
 * @returns {object} Normalized species object
 */
function parseCdnSpecies(race) {
    const traits = [];
    const resistances = [];
    let darkvision = 0;
    let speed = 30;
    let size = 'Medium';
    const languages = [];
    let languageChoiceCount = 0;
    let creatureType = 'Humanoid';

    if (race.speed) {
        if (typeof race.speed === 'number') speed = race.speed;
        else if (race.speed.walk) speed = race.speed.walk;
    }

    if (race.size) {
        const sizeMap = { S: 'Small', M: 'Medium', L: 'Large' };
        const s = Array.isArray(race.size) ? race.size[0] : race.size;
        size = sizeMap[s] || 'Medium';
    }

    if (race.darkvision) darkvision = race.darkvision;

    if (race.resist) {
        for (const r of race.resist) {
            if (typeof r === 'string') resistances.push(r);
            else if (r.resist) resistances.push(...r.resist);
        }
    }

    if (race.languageProficiencies) {
        for (const lp of race.languageProficiencies) {
            for (const [key, val] of Object.entries(lp)) {
                if (key === 'anyStandard') languageChoiceCount += val;
                else if (val === true) languages.push(key.charAt(0).toUpperCase() + key.slice(1));
            }
        }
    }

    if (race.creatureTypes) {
        const ct = Array.isArray(race.creatureTypes) ? race.creatureTypes[0] : race.creatureTypes;
        if (typeof ct === 'string') creatureType = ct.charAt(0).toUpperCase() + ct.slice(1);
        else if (ct?.choose) creatureType = 'Humanoid';
    }

    // Extract trait entries
    if (race.entries) {
        for (const entry of race.entries) {
            if (typeof entry === 'object' && entry.name && entry.entries) {
                const desc = flattenEntries(entry.entries);
                if (desc) traits.push({ name: entry.name, description: desc });
            }
        }
    }

    return {
        id: `cdn_${race.name}_${race.source}`,
        name: race.name,
        source: race.source,
        size,
        speed,
        darkvision,
        resistances,
        languages,
        languageChoiceCount,
        traits,
        creatureType,
        abilityBoosts: null,
        _raw: race,
    };
}

/**
 * Flatten 5e.tools entry arrays to a plain text description.
 */
function flattenEntries(entries) {
    if (!entries) return '';
    const parts = [];
    for (const e of entries) {
        if (typeof e === 'string') {
            parts.push(stripTags(e));
        } else if (typeof e === 'object') {
            if (e.type === 'list' && e.items) {
                for (const item of e.items) {
                    if (typeof item === 'string') parts.push('- ' + stripTags(item));
                    else if (item.entries) parts.push('- ' + flattenEntries(item.entries));
                }
            } else if (e.entries) {
                parts.push(flattenEntries(e.entries));
            }
        }
    }
    return parts.join(' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Strip 5e.tools {@tag ...} markup to plain text.
 */
function stripTags(str) {
    if (!str) return '';
    return str
        .replace(/\{@\w+\s+([^|}]+?)(?:\|[^}]*)?\}/g, '$1')
        .replace(/\{@\w+\s+([^}]+)\}/g, '$1');
}

/**
 * Get all available species: CDN (XPHB) + custom species.
 * @returns {Promise<object[]>} Normalized species array
 */
export async function getAvailableSpecies() {
    const cdnSpecies = await getCdnSpecies();
    const custom = getCustomSpecies();
    return [...cdnSpecies, ...custom];
}

/**
 * Get CDN species filtered to XPHB source.
 */
async function getCdnSpecies() {
    const data = await fetchRaces();
    if (!data?.race) return [];
    return data.race
        .filter(r => r.source === 'XPHB' && !r._copy)
        .map(parseCdnSpecies);
}

/**
 * Get custom species from global settings (already in normalized format).
 */
function getCustomSpecies() {
    const list = extensionSettings.v1CustomSpecies;
    if (!Array.isArray(list)) return [];
    return list.map(cs => ({
        ...cs,
        source: 'CUSTOM',
        _raw: null,
    }));
}

/**
 * Lookup a species by name and source.
 */
export async function findSpecies(name, source) {
    const all = await getAvailableSpecies();
    return all.find(s => s.name === name && s.source === source) || null;
}

/**
 * Extract the mechanical summary of a species for prompt injection.
 */
export function buildSpeciesTraitsSummary(species) {
    if (!species) return '';
    const parts = [];
    if (species.darkvision) parts.push(`Darkvision ${species.darkvision}ft`);
    if (species.resistances?.length) parts.push(`Resist: ${species.resistances.join(', ')}`);
    if (species.creatureType && species.creatureType !== 'Humanoid') {
        parts.push(`Type: ${species.creatureType}`);
    }
    for (const trait of (species.traits || [])) {
        const desc = trait.description.length > 120
            ? trait.description.substring(0, 117) + '...'
            : trait.description;
        parts.push(`${trait.name}: ${desc}`);
    }
    return parts.join('; ');
}
