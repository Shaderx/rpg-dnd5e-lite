/**
 * D&D 5e Lite - Persistence Module
 * Save/load extension settings and per-chat quest data
 */

import { getContext } from '../../../../../extensions.js';
import { saveSettingsDebounced, chat_metadata, saveChatDebounced } from '../../../../../../script.js';
import { extensionName, extensionSettings, defaultAttributeSchema, buildDefaultAttributes, setChatAttributes, setChatAttributeSchema, setQuests, setInventory, setSpellLog, setSpellTrackerDisabled, setSendAttributesOnRoll, setSpellInjectEnabled, setSidekickSlotsEnabled, setAutoLongRestEnabled, setSpellbook, setCharacter, setSidekicks, eventCooldown, lastEventRoll, eventLog, setEventCooldown, setLastEventRoll, setEventLog, setAutoBackgrounds } from './state.js';
import { migrateInventoryRarity, INVENTORY_RARITY_VERSION, normalizeRarity } from '../features/inventoryRarity.js';

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
        }

        // Migrate legacy questDepth → injectionDepth
        if ('questDepth' in stored && !('injectionDepth' in stored)) {
            stored.injectionDepth = stored.questDepth;
        }
        delete stored.questDepth;

        Object.assign(extensionSettings, stored);
        saveSettings();
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
 * Migrates legacy isMain boolean and unset priority to quest types.
 * Types: 1=Reminder(📌), 2=Side Errand(🛡️), 3=Main Quest(👑).
 */
export function loadQuests() {
    const stored = chat_metadata?.dnd5e_quests;
    if (Array.isArray(stored)) {
        for (const q of stored) {
            if (q.priority === undefined) {
                q.priority = q.isMain ? 3 : 1;
            }
            if (q.priority === 0) {
                q.priority = 1;
            }
            if (q.priority < 1 || q.priority > 3) {
                q.priority = 1;
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
        if ((chat_metadata.dnd5e_inventoryRarityVer || 0) < INVENTORY_RARITY_VERSION) {
            migrateInventoryRarity(stored);
            chat_metadata.dnd5e_inventoryRarityVer = INVENTORY_RARITY_VERSION;
        }
        for (const item of stored) {
            if (item.quantity === undefined) item.quantity = 1;
            if (item.rarity === undefined) item.rarity = 0;
            item.rarity = normalizeRarity(item.rarity);
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

/**
 * Save the per-chat "send attributes on roll" flag.
 * @param {boolean} enabled
 */
export function saveSendAttributesOnRoll(enabled) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_sendAttributesOnRoll = enabled !== false;
    saveChatDebounced();
}

/**
 * Load the per-chat "send attributes on roll" flag into runtime state.
 */
export function loadSendAttributesOnRoll() {
    const val = chat_metadata?.dnd5e_sendAttributesOnRoll;
    setSendAttributesOnRoll(val !== false);
}

/**
 * Save the per-chat "inject spell info" flag.
 */
export function saveSpellInjectEnabled(enabled) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_spellInjectEnabled = !!enabled;
    saveChatDebounced();
}

/**
 * Load the per-chat "inject spell info" flag into runtime state.
 */
export function loadSpellInjectEnabled() {
    const val = chat_metadata?.dnd5e_spellInjectEnabled;
    setSpellInjectEnabled(!!val);
}

/**
 * Save the per-chat "sidekick spell slots injected" flag.
 * When enabled, sidekick stat blocks include slot info and the prompt
 * reminds the LLM to track them. When disabled, no slots are injected
 * and casting is treated as at-will.
 */
export function saveSidekickSlotsEnabled(enabled) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_sidekickSlotsEnabled = enabled !== false;
    saveChatDebounced();
}

/**
 * Load the per-chat "sidekick spell slots injected" flag into runtime state.
 */
export function loadSidekickSlotsEnabled() {
    const val = chat_metadata?.dnd5e_sidekickSlotsEnabled;
    // Default to true for backwards compatibility (existing chats).
    setSidekickSlotsEnabled(val !== false);
}

/**
 * Save the per-chat "auto long rest detection" flag.
 * @param {boolean} enabled
 */
export function saveAutoLongRest(enabled) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_autoLongRestEnabled = enabled !== false;
    saveChatDebounced();
}

/**
 * Load the per-chat "auto long rest detection" flag into runtime state.
 */
export function loadAutoLongRest() {
    const val = chat_metadata?.dnd5e_autoLongRestEnabled;
    setAutoLongRestEnabled(val !== false);
}

/**
 * Save spellbook data to chat metadata.
 * @param {object|null} data - The spellbook object { name, items, sources } or null to clear
 */
export function saveSpellbook(data) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_spellbook = data;
    saveChatDebounced();
}

/**
 * Load spellbook data from chat metadata into runtime state.
 */
export function loadSpellbook() {
    const stored = chat_metadata?.dnd5e_spellbook;
    setSpellbook(stored || null);
}

/**
 * Save character config to chat metadata.
 * @param {object|null} data - { className, classSource, classFile, subclassName, subclassShortName, subclassSource, level }
 */
export function saveCharacter(data) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_character = data;
    saveChatDebounced();
}

/**
 * Load character config from chat metadata into runtime state.
 */
export function loadCharacter() {
    const stored = chat_metadata?.dnd5e_character;
    setCharacter(stored || null);
}

/**
 * Save sidekick data to chat metadata.
 * @param {Array} list - The sidekicks array to persist
 */
export function saveSidekicks(list) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_sidekicks = list;
    saveChatDebounced();
}

/**
 * Load sidekick data from chat metadata into runtime state.
 */
export function loadSidekicks() {
    const stored = chat_metadata?.dnd5e_sidekicks;
    if (Array.isArray(stored)) {
        setSidekicks(stored);
    } else {
        setSidekicks([]);
    }
}

/**
 * Save random event state to chat metadata (cooldown, last roll, event log).
 */
export function saveRandomEventState() {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_eventCooldown = eventCooldown;
    chat_metadata.dnd5e_lastEventRoll = lastEventRoll;
    chat_metadata.dnd5e_eventLog = eventLog;
    saveChatDebounced();
}

/**
 * Load random event state from chat metadata into runtime state.
 */
export function loadRandomEventState() {
    setEventCooldown(chat_metadata?.dnd5e_eventCooldown ?? 0);
    setLastEventRoll(chat_metadata?.dnd5e_lastEventRoll ?? null);
    const storedLog = chat_metadata?.dnd5e_eventLog;
    setEventLog(Array.isArray(storedLog) ? storedLog : []);
}

/**
 * Save auto-background switching config to chat metadata.
 * @param {object|null} data - { enabled, entries: [{ name, day, night }] }
 */
export function saveAutoBackgrounds(data) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_autoBackgrounds = data;
    saveChatDebounced();
}

/**
 * Load auto-background switching config from chat metadata into runtime state.
 */
export function loadAutoBackgrounds() {
    const stored = chat_metadata?.dnd5e_autoBackgrounds;
    setAutoBackgrounds(stored || null);
}
