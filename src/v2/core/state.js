/**
 * V2 Tool Calling - State
 * Runtime state for V2 quest and inventory systems.
 */

// V2 quests: per-chat array stored in chat_metadata.dnd5e_v2_quests
export let v2Quests = [];
export function setV2Quests(val) { v2Quests = val; }

// V2 inventory: per-chat array stored in chat_metadata.dnd5e_v2_inventory
export let v2Inventory = [];
export function setV2Inventory(val) { v2Inventory = val; }

export function createDefaultQuest(overrides = {}) {
    return {
        id: crypto.randomUUID(),
        title: '',
        description: '',
        status: 'not_started',
        priority: 1,
        giver: '',
        location: '',
        objectives: [],
        rewards: { xp: 0, gold: 0, items: [] },
        ...overrides,
    };
}

export function createDefaultItem(overrides = {}) {
    return {
        id: crypto.randomUUID(),
        name: '',
        quantity: 1,
        rarity: 0,
        location: 'stored',
        type: 'none',
        magic: false,
        magicNotes: '',
        charges: null,
        equipmentData: null,
        ...overrides,
    };
}
