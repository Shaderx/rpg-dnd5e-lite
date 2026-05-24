/**
 * D&D 5e Lite - Persistence Module
 * Save/load extension settings and per-chat quest data
 */

import { getContext } from '../../../../../extensions.js';
import { saveSettingsDebounced, chat_metadata, saveChatDebounced } from '../../../../../../script.js';
import { extensionName, extensionSettings, defaultAttributes, defaultAttributeSchema, buildDefaultAttributes, setChatAttributes, setChatAttributeSchema, setQuests, setInventory, setSpellLog, setSpellTrackerDisabled } from './state.js';

/**
 * Save extension settings to SillyTavern storage.
 */
export function saveSettings() {
    const context = getContext();
    const ext = context.extension_settings || context.extensionSettings;
    if (!ext) return;
    ext[extensionName] = extensionSettings;
    saveSettingsDebounced();
}

/**
 * Load extension settings from SillyTavern storage.
 * Migrates legacy global attributes into the current chat if present.
 */
export function loadSettings() {
    const context = getContext();
    const ext = context.extension_settings || context.extensionSettings;
    const stored = ext?.[extensionName];
    if (stored) {
        // Migrate legacy global attributes → current chat, then remove from global
        if (stored.attributes) {
            if (chat_metadata && !chat_metadata.dnd5e_attributes) {
                chat_metadata.dnd5e_attributes = { ...stored.attributes };
                saveChatDebounced();
            }
            delete stored.attributes;
            Object.assign(extensionSettings, stored);
            saveSettings();
        } else {
            Object.assign(extensionSettings, stored);
        }
    }
    loadAttributes();
}

/**
 * Save per-chat attribute schema and values to chat metadata.
 * @param {Array} schema - Array of { key, label } objects
 * @param {Object} attrs - The attributes object keyed by schema keys
 */
export function saveAttributes(schema, attrs) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_attribute_schema = schema;
    chat_metadata.dnd5e_attributes = attrs;
    saveChatDebounced();
}

/**
 * Load per-chat attribute schema and values from chat metadata into runtime state.
 * Migrates legacy chats that only have fixed D&D attributes (no schema).
 */
export function loadAttributes() {
    const storedSchema = chat_metadata?.dnd5e_attribute_schema;
    const storedAttrs = chat_metadata?.dnd5e_attributes;

    let schema;
    if (Array.isArray(storedSchema) && storedSchema.length > 0) {
        schema = storedSchema;
    } else if (storedAttrs && typeof storedAttrs === 'object') {
        // Legacy migration: derive schema from existing attribute keys
        const legacyLabels = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
        schema = Object.keys(storedAttrs).map(k => ({
            key: k,
            label: legacyLabels[k] || k.toUpperCase(),
        }));
    } else {
        schema = [...defaultAttributeSchema];
    }

    setChatAttributeSchema(schema);

    const defaults = buildDefaultAttributes(schema);
    if (storedAttrs && typeof storedAttrs === 'object') {
        setChatAttributes({ ...defaults, ...storedAttrs });
    } else {
        setChatAttributes({ ...defaults });
    }
}

/**
 * Save quest data to chat metadata.
 * @param {Array} questList - The quests array to persist
 */
export function saveQuests(questList) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_quests = questList;
    saveChatDebounced();
}

/**
 * Load quest data from chat metadata into runtime state.
 * Migrates legacy isMain boolean to numeric priority.
 * Priority: 0=unset, 1=minor(★), 2=important(★★★), 3=critical(★★★★★).
 */
export function loadQuests() {
    const stored = chat_metadata?.dnd5e_quests;
    if (Array.isArray(stored)) {
        for (const q of stored) {
            if (q.priority === undefined) {
                q.priority = q.isMain ? 3 : 0;
            }
            delete q.isMain;
        }
        setQuests(stored);
    } else {
        setQuests([]);
    }
}

/**
 * Save inventory data to chat metadata.
 * @param {Array} itemList - The inventory array to persist
 */
export function saveInventory(itemList) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_inventory = itemList;
    saveChatDebounced();
}

/**
 * Load inventory data from chat metadata into runtime state.
 * Ensures each item has all expected fields with sensible defaults.
 */
export function loadInventory() {
    const stored = chat_metadata?.dnd5e_inventory;
    if (Array.isArray(stored)) {
        for (const item of stored) {
            if (item.quantity === undefined) item.quantity = 1;
            if (item.rarity === undefined) item.rarity = 0;
            if (!item.location) item.location = 'stored';
        }
        setInventory(stored);
    } else {
        setInventory([]);
    }
}

/**
 * Save spell log data to chat metadata.
 * @param {Array} logList - The spell log array to persist
 */
export function saveSpellLog(logList) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_spellLog = logList;
    saveChatDebounced();
}

/**
 * Load spell log data from chat metadata into runtime state.
 */
export function loadSpellLog() {
    const stored = chat_metadata?.dnd5e_spellLog;
    if (Array.isArray(stored)) {
        setSpellLog(stored);
    } else {
        setSpellLog([]);
    }
}

/**
 * Save the per-chat spell tracker disabled flag.
 * @param {boolean} disabled
 */
export function saveSpellTrackerDisabled(disabled) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_spellTrackerDisabled = !!disabled;
    saveChatDebounced();
}

/**
 * Load the per-chat spell tracker disabled flag into runtime state.
 */
export function loadSpellTrackerDisabled() {
    const val = chat_metadata?.dnd5e_spellTrackerDisabled;
    setSpellTrackerDisabled(!!val);
}
