/**
 * D&D 5e Lite - Persistence Module
 * Save/load extension settings and per-chat quest data
 */

import { getContext } from '../../../../../extensions.js';
import { saveSettingsDebounced, chat_metadata, saveChatDebounced } from '../../../../../../script.js';
import { extensionName, extensionSettings, setQuests, setSpellLog } from './state.js';

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
 */
export function loadSettings() {
    const context = getContext();
    const ext = context.extension_settings || context.extensionSettings;
    const stored = ext?.[extensionName];
    if (stored) {
        Object.assign(extensionSettings, stored);
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
