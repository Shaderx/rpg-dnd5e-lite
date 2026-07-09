/**
 * V2 State
 * Runtime state for V2 quest, inventory, and companion systems.
 */

// V2 quests: per-chat array stored in chat_metadata.dnd5e_v2_quests
export let v2Quests = [];
export function setV2Quests(val) { v2Quests = val; }

// V2 inventory: per-chat array stored in chat_metadata.dnd5e_v2_inventory
export let v2Inventory = [];
export function setV2Inventory(val) { v2Inventory = val; }

export const MAX_ATTUNEMENT = 3;

/** An item counts as "equipped" if its location is 'equipped' OR 'attuned'. */
export function isItemEquipped(item) {
    return item?.location === 'equipped' || item?.location === 'attuned';
}

// V2 companions: per-chat array stored in chat_metadata.dnd5e_v2_companions
export let v2Companions = [];
export function setV2Companions(val) { v2Companions = val; }

export function createDefaultQuest(overrides = {}) {
    return {
        id: crypto.randomUUID(),
        title: '',
        description: '',
        notes: '',
        status: 'not_started',
        priority: 1,
        giver: '',
        location: '',
        dateCreated: '',
        duration: '',
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

export function createDefaultCompanion(overrides = {}) {
    return {
        id: crypto.randomUUID(),
        category: 'familiar',
        name: '',
        creatureName: '',
        creatureSource: null,
        creatureType: 'fey',
        description: '',
        hp: { average: 1, formula: '' },
        ac: 10,
        speed: '30 ft',
        str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
        size: 'Tiny',
        senses: '',
        languages: '',
        skills: '',
        actions: [],
        traits: [],
        scalingLevel: null,
        enabled: false,
        owner: null,
        ...overrides,
    };
}
