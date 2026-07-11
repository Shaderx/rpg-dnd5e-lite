/**
 * V2 Tool Calling - Migration
 * Migrate V1/legacy quest and inventory data to V2 format.
 * Also migrates V1 character equipment into V2 inventory items.
 */

import { chat_metadata } from '../../../../../../../script.js';
import { setV2Quests, setV2Inventory, createDefaultQuest, createDefaultItem } from './state.js';
import { getChatDataVersion, saveV2Quests, saveV2Inventory } from './persistence.js';

/**
 * Check if current chat has V1/legacy data that can be migrated.
 * @returns {boolean}
 */
export function hasV1DataToMigrate() {
    const hasV1Quests = Array.isArray(chat_metadata?.dnd5e_quests) && chat_metadata.dnd5e_quests.length > 0;
    const hasV1Inventory = Array.isArray(chat_metadata?.dnd5e_inventory) && chat_metadata.dnd5e_inventory.length > 0;
    const hasV2Data = Array.isArray(chat_metadata?.dnd5e_v2_quests) || Array.isArray(chat_metadata?.dnd5e_v2_inventory);
    return (hasV1Quests || hasV1Inventory) && !hasV2Data;
}

/**
 * Check if current chat is using V2 data format.
 * @returns {boolean}
 */
export function isChatV2() {
    return getChatDataVersion() >= 2;
}

/**
 * Migrate V1/legacy quest data to V2 format.
 * @param {Array} v1Quests - V1 quest array
 * @returns {Array} V2 quest array
 */
export function migrateQuests(v1Quests) {
    if (!Array.isArray(v1Quests)) return [];
    return v1Quests.map(q => createDefaultQuest({
        title: q.text || '',
        priority: (q.priority >= 1 && q.priority <= 3) ? q.priority : 1,
        status: q.completed ? 'completed' : 'not_started',
    }));
}

/**
 * Migrate V1/legacy inventory data to V2 format.
 * @param {Array} v1Inventory - V1 inventory array
 * @returns {Array} V2 inventory array
 */
export function migrateInventory(v1Inventory) {
    if (!Array.isArray(v1Inventory)) return [];
    return v1Inventory.map(item => createDefaultItem({
        name: item.text || '',
        quantity: item.quantity || 1,
        rarity: item.rarity || 0,
        location: item.location || 'stored',
    }));
}

/**
 * Execute the full migration from V1 to V2.
 * Non-destructive: V1 data keys are NOT deleted.
 * @param {object|null} v1Character - Optional V1 character object for equipment migration
 */
export function executeV2Migration(v1Character = null) {
    const v1Quests = chat_metadata?.dnd5e_quests || [];
    const v1Inventory = chat_metadata?.dnd5e_inventory || [];

    const v2Quests = migrateQuests(v1Quests);
    const v2Inventory = migrateInventory(v1Inventory);

    const equipmentItems = migrateV1Equipment(v1Character);
    v2Inventory.push(...equipmentItems);

    setV2Quests(v2Quests);
    setV2Inventory(v2Inventory);

    saveV2Quests(v2Quests);
    saveV2Inventory(v2Inventory);
}

/**
 * Migrate V1 character equipment (armor/shield/weapons) to V2 inventory items.
 * @param {object|null} v1Character - V1 character object (or falls back to chat_metadata)
 * @returns {Array} V2 inventory items for the character's equipment
 */
export function migrateV1Equipment(v1Character = null) {
    const char = v1Character || chat_metadata?.dnd5e_v1_character;
    if (!char) return [];

    const items = [];

    if (char.equippedArmor) {
        const a = char.equippedArmor;
        items.push(createDefaultItem({
            name: a.name || 'Unknown Armor',
            type: 'armor',
            magic: !!a._magic,
            location: 'equipped',
            equipmentData: {
                name: a.name,
                type: a.type || 'LA',
                ac: a.ac || 10,
                dexCap: a.type === 'MA' ? 2 : (a.type === 'HA' ? 0 : null),
                strReq: a.strReq || 0,
                stealthDis: !!a.stealthDis,
                bonusAc: a.bonusAc || 0,
                _magic: !!a._magic,
            },
        }));
    }

    if (char.hasShield) {
        items.push(createDefaultItem({
            name: 'Shield',
            type: 'shield',
            location: 'equipped',
            equipmentData: { name: 'Shield', ac: 2 },
        }));
    }

    if (Array.isArray(char.weapons)) {
        for (const wpn of char.weapons) {
            items.push(createDefaultItem({
                name: wpn.name || 'Unknown Weapon',
                type: 'weapon',
                magic: !!wpn._magic,
                location: 'equipped',
                equipmentData: {
                    name: wpn.name,
                    damageDice: wpn.damageDice || '1d6',
                    damageType: wpn.damageType || 'slashing',
                    properties: wpn.properties || [],
                    isRanged: !!wpn.isRanged,
                    bonus: wpn.bonus || 0,
                    _magic: !!wpn._magic,
                },
            }));
        }
    }

    return items;
}
