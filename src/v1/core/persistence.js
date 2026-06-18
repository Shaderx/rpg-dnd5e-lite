/**
 * V1 Character System - Persistence
 * Save/load the V1 character to/from chat_metadata.
 */

import { chat_metadata, saveChatDebounced } from '../../../../../../../script.js';
import { setCharacterV1 } from './state.js';

/**
 * Save the V1 character object to chat metadata.
 * @param {object|null} data - Full V1 character object, or null to clear
 */
export function saveCharacterV1(data) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_v1_character = data;
    saveChatDebounced();
}

/**
 * Load V1 character from chat metadata into runtime state.
 */
export function loadCharacterV1() {
    const stored = chat_metadata?.dnd5e_v1_character;
    if (stored && typeof stored === 'object' && stored.id) {
        migrateCharacterV1(stored);
        setCharacterV1(stored);
    } else {
        setCharacterV1(null);
    }
}

/**
 * Apply any schema migrations to older saved characters.
 * @param {object} char - The stored character object (mutated in place)
 */
function migrateCharacterV1(char) {
    if (!char.enabledFeatures) char.enabledFeatures = {};
    if (char.enabled === undefined) char.enabled = true;
    if (!Array.isArray(char.extraSpells)) char.extraSpells = [];
    if (!Array.isArray(char.items)) char.items = [];
    if (!Array.isArray(char.weapons)) char.weapons = [];
    if (!Array.isArray(char.knownCantrips)) char.knownCantrips = [];
    if (!Array.isArray(char.knownSpells)) char.knownSpells = [];
    if (!Array.isArray(char.skillChoices)) char.skillChoices = [];
    if (!Array.isArray(char.skillExpertise)) char.skillExpertise = [];
    if (!Array.isArray(char.toolChoices)) char.toolChoices = [];
    if (!Array.isArray(char.languageChoices)) char.languageChoices = [];
    if (!char.asiChoices) char.asiChoices = {};
    if (!char.featData) char.featData = {};
    if (!char.levelChoices) char.levelChoices = {};
    if (!Array.isArray(char.chosenFeatures)) char.chosenFeatures = [];
    if (!char.baseAbilities) {
        char.baseAbilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    }
}
