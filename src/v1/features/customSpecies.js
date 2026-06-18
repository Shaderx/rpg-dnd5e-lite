/**
 * V1 Character System - Custom Species
 * CRUD operations and global storage for user-defined species.
 */

import { extensionSettings } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';

/**
 * Get all custom species.
 * @returns {object[]}
 */
export function listCustomSpecies() {
    if (!Array.isArray(extensionSettings.v1CustomSpecies)) {
        extensionSettings.v1CustomSpecies = [];
    }
    return extensionSettings.v1CustomSpecies;
}

/**
 * Find a custom species by ID.
 */
export function getCustomSpeciesById(id) {
    return listCustomSpecies().find(s => s.id === id) || null;
}

/**
 * Create a new custom species and persist.
 * @param {object} data - Species fields (name, size, speed, etc.)
 * @returns {object} The created species object
 */
export function createCustomSpecies(data) {
    const species = {
        id: `cs_${Date.now()}`,
        name: data.name || 'Custom Species',
        source: 'CUSTOM',
        size: data.size || 'Medium',
        speed: data.speed ?? 30,
        darkvision: data.darkvision ?? 0,
        resistances: Array.isArray(data.resistances) ? [...data.resistances] : [],
        languages: Array.isArray(data.languages) ? [...data.languages] : ['Common'],
        languageChoiceCount: data.languageChoiceCount ?? 0,
        traits: Array.isArray(data.traits) ? data.traits.map(t => ({
            name: t.name || '',
            description: t.description || '',
        })) : [],
        creatureType: data.creatureType || 'Humanoid',
        abilityBoosts: data.abilityBoosts || null,
    };

    listCustomSpecies().push(species);
    saveSettings();
    return species;
}

/**
 * Update an existing custom species by ID.
 * @param {string} id
 * @param {object} data - Fields to update
 * @returns {object|null} Updated species or null if not found
 */
export function updateCustomSpecies(id, data) {
    const list = listCustomSpecies();
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) return null;

    const species = list[idx];
    if (data.name !== undefined) species.name = data.name;
    if (data.size !== undefined) species.size = data.size;
    if (data.speed !== undefined) species.speed = data.speed;
    if (data.darkvision !== undefined) species.darkvision = data.darkvision;
    if (data.resistances !== undefined) species.resistances = [...data.resistances];
    if (data.languages !== undefined) species.languages = [...data.languages];
    if (data.languageChoiceCount !== undefined) species.languageChoiceCount = data.languageChoiceCount;
    if (data.traits !== undefined) {
        species.traits = data.traits.map(t => ({
            name: t.name || '',
            description: t.description || '',
        }));
    }
    if (data.creatureType !== undefined) species.creatureType = data.creatureType;
    if (data.abilityBoosts !== undefined) species.abilityBoosts = data.abilityBoosts;

    saveSettings();
    return species;
}

/**
 * Delete a custom species by ID.
 * @param {string} id
 * @returns {boolean} True if deleted
 */
export function deleteCustomSpecies(id) {
    const list = listCustomSpecies();
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    saveSettings();
    return true;
}

/**
 * Build a blank custom species template for the editor form.
 */
export function blankCustomSpecies() {
    return {
        name: '',
        size: 'Medium',
        speed: 30,
        darkvision: 0,
        resistances: [],
        languages: ['Common'],
        languageChoiceCount: 0,
        traits: [],
        creatureType: 'Humanoid',
        abilityBoosts: null,
    };
}
