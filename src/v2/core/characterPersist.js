/**
 * V2 Character System - Persistence
 * Save/load V2 character to/from chat_metadata.
 * Equipment is NOT stored on the character — it lives in V2 inventory.
 */

import { chat_metadata, saveChatDebounced } from '../../../../../../../script.js';
import { setCharacterV2 } from './characterState.js';

/**
 * Save the V2 character object to chat metadata.
 * @param {object|null} data - V2 character object, or null to clear
 */
export function saveCharacterV2(data) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_v2_character = data;
    saveChatDebounced();
}

/**
 * Load V2 character from chat metadata into runtime state.
 */
export function loadCharacterV2() {
    const stored = chat_metadata?.dnd5e_v2_character;
    if (stored && typeof stored === 'object' && stored.id) {
        migrateCharacterV2(stored);
        setCharacterV2(stored);
    } else {
        setCharacterV2(null);
    }
}

/**
 * Apply schema migrations to older saved V2 characters.
 */
function migrateCharacterV2(char) {
    if (!char.enabledFeatures) char.enabledFeatures = {};
    if (char.enabled === undefined) char.enabled = true;
    if (!Array.isArray(char.extraSpells)) char.extraSpells = [];
    if (char.extraSpells.length && typeof char.extraSpells[0] === 'string') {
        char.extraSpells = char.extraSpells.map(name => ({ name, source: '', freeCast: '' }));
    }
    if (!Array.isArray(char.customSpells)) char.customSpells = [];
    if (!Array.isArray(char.knownCantrips)) char.knownCantrips = [];
    if (!Array.isArray(char.knownSpells)) char.knownSpells = [];
    if (!Array.isArray(char.skillChoices)) char.skillChoices = [];
    if (!Array.isArray(char.skillExpertise)) char.skillExpertise = [];
    if (!Array.isArray(char.toolChoices)) char.toolChoices = [];
    if (!Array.isArray(char.languageChoices)) char.languageChoices = [];
    if (char.speciesLanguageChoiceCount === undefined) char.speciesLanguageChoiceCount = 0;
    if (!char.asiChoices) char.asiChoices = {};
    if (!char.featData) char.featData = {};
    if (!char.levelChoices) char.levelChoices = {};
    if (!Array.isArray(char.chosenFeatures)) char.chosenFeatures = [];
    if (!Array.isArray(char.preparedReactions)) char.preparedReactions = [];
    if (!char.baseAbilities) {
        char.baseAbilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    }
    // V2: equipment fields removed — clean up any legacy ones
    delete char.equippedArmor;
    delete char.hasShield;
    delete char.weapons;
}
