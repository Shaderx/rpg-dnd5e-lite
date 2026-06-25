/**
 * V2 Tool Calling - Persistence
 * Save/load V2 quest and inventory data to/from chat_metadata.
 */

import { chat_metadata, saveChatDebounced } from '../../../../../../../script.js';
import { setV2Quests, setV2Inventory, setV2Companions } from './state.js';
import { normalizeRarity } from '../../features/inventoryRarity.js';

/**
 * Save V2 quest data to chat metadata.
 * @param {Array} questList
 */
export function saveV2Quests(questList) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_v2_quests = questList;
    chat_metadata.dnd5e_dataVersion = 2;
    saveChatDebounced();
}

/**
 * Load V2 quest data from chat metadata into runtime state.
 */
export function loadV2Quests() {
    const stored = chat_metadata?.dnd5e_v2_quests;
    if (Array.isArray(stored)) {
        for (const q of stored) {
            if (!q.id) q.id = crypto.randomUUID();
            if (!q.title) q.title = '';
            if (!q.description) q.description = '';
            if (q.notes === undefined || q.notes === null) q.notes = '';
            if (!q.status) q.status = 'not_started';
            if (!q.priority || q.priority < 1 || q.priority > 3) q.priority = 1;
            if (!q.giver) q.giver = '';
            if (!q.location) q.location = '';
            if (!Array.isArray(q.objectives)) q.objectives = [];
            if (!q.rewards) q.rewards = { xp: 0, gold: 0, items: [] };
            if (!q.rewards.items) q.rewards.items = [];
        }
        setV2Quests(stored);
    } else {
        setV2Quests([]);
    }
}

/**
 * Save V2 inventory data to chat metadata.
 * @param {Array} itemList
 */
export function saveV2Inventory(itemList) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_v2_inventory = itemList;
    chat_metadata.dnd5e_dataVersion = 2;
    saveChatDebounced();
}

/**
 * Load V2 inventory data from chat metadata into runtime state.
 */
const VALID_ITEM_TYPES = new Set(['none', 'armor', 'shield', 'weapon']);

export function loadV2Inventory() {
    const stored = chat_metadata?.dnd5e_v2_inventory;
    if (Array.isArray(stored)) {
        for (const item of stored) {
            if (!item.id) item.id = crypto.randomUUID();
            if (!item.name) item.name = item.text || '';
            delete item.text;
            if (item.quantity === undefined) item.quantity = 1;
            if (item.rarity === undefined) item.rarity = 0;
            item.rarity = normalizeRarity(item.rarity);
            if (!item.location || !['stored', 'equipped', 'attuned'].includes(item.location)) item.location = 'stored';
            if (item.location === 'attuned' && !item.magic) item.location = 'equipped';
            if (!VALID_ITEM_TYPES.has(item.type)) item.type = 'none';
            if (item.magic === undefined) item.magic = false;
            if (item.magicNotes === undefined) item.magicNotes = '';
            if (item.charges !== undefined && item.charges !== null && typeof item.charges !== 'number') {
                item.charges = null;
            }
            if (item.equipmentData !== undefined && item.equipmentData !== null && typeof item.equipmentData !== 'object') {
                item.equipmentData = null;
            }
        }
        setV2Inventory(stored);
    } else {
        setV2Inventory([]);
    }
}

/**
 * Save V2 companion data to chat metadata.
 * @param {Array} companionList
 */
export function saveV2Companions(companionList) {
    if (!chat_metadata) return;
    chat_metadata.dnd5e_v2_companions = companionList;
    chat_metadata.dnd5e_dataVersion = 2;
    saveChatDebounced();
}

/**
 * Load V2 companion data from chat metadata into runtime state.
 */
const VALID_CATEGORIES = new Set(['familiar', 'primal', 'steed']);

export function loadV2Companions() {
    const stored = chat_metadata?.dnd5e_v2_companions;
    if (Array.isArray(stored)) {
        for (const c of stored) {
            if (!c.id) c.id = crypto.randomUUID();
            if (!VALID_CATEGORIES.has(c.category)) c.category = 'familiar';
            if (!c.name) c.name = '';
            if (!c.creatureName) c.creatureName = '';
            if (c.enabled === undefined) c.enabled = false;
            if (!Array.isArray(c.actions)) c.actions = [];
            if (!Array.isArray(c.traits)) c.traits = [];
        }
        setV2Companions(stored);
    } else {
        setV2Companions([]);
    }
}

/**
 * Get the data version stored in the current chat.
 * @returns {number} 0 if no version marker, otherwise the version number
 */
export function getChatDataVersion() {
    return chat_metadata?.dnd5e_dataVersion || 0;
}
