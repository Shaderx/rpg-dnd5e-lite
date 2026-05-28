/**
 * D&D 5e Lite - State Module
 * Central state and default settings
 */

export const extensionName = 'third-party/rpg-dnd5e-lite';
export const extensionFolderPath = `scripts/extensions/${extensionName}`;

export const defaultAttributeSchema = [
    { key: 'str', label: 'STR' },
    { key: 'dex', label: 'DEX' },
    { key: 'con', label: 'CON' },
    { key: 'int', label: 'INT' },
    { key: 'wis', label: 'WIS' },
    { key: 'cha', label: 'CHA' },
];

export function buildDefaultAttributes(schema) {
    const attrs = {};
    for (const s of schema) attrs[s.key] = 10;
    return attrs;
}

export const defaultAttributes = buildDefaultAttributes(defaultAttributeSchema);

export const extensionSettings = {
    enabled: true,
    softDisabled: false,

    // Dice
    lastDiceRoll: null,
    lastDamageRoll: null,
    lastFavoredRoll: null,

    // Strip widgets
    stripWidgetsEnabled: true,

    // Injection depth for all prompts (0 = right before user message)
    injectionDepth: 0,

    // UI
    panelPosition: 'right',

    // Weather visuals (background overlays driven by header data)
    weatherVisuals: {
        enabled: true,
        particleCount: 200,
        clearOpacity: 0,
        clearColor: '#ffffff',
        fogOpacity: 0.18,
        fogColor: '#8791a0',
        rainOpacity: 0.14,
        rainColor: '#465a78',
        snowOpacity: 0.10,
        snowColor: '#dcecff',
        windOpacity: 0,
        windColor: '#d4c9a8',
        sandstormOpacity: 0.16,
        sandstormColor: '#c4a35a',
        ashOpacity: 0.12,
        ashColor: '#5a4a4a',
        magicalOpacity: 0.08,
        magicalColor: '#7b5ea7'
    },

    // Lighting overlay (time-of-day ambient lighting on top of weather)
    lightingOverlay: {
        enabled: true,
        intensity: 1.0,
        blendMode: 'soft-light'
    }
};

// Per-chat attribute schema and values (stored in chat_metadata)
export let chatAttributeSchema = [...defaultAttributeSchema];
export function setChatAttributeSchema(val) { chatAttributeSchema = val; }

export let chatAttributes = { ...defaultAttributes };
export function setChatAttributes(val) { chatAttributes = val; }

// Quests are stored per-chat in chat_metadata, not in extensionSettings.
// This is the runtime copy loaded from chat_metadata.
export let quests = [];
export function setQuests(val) { quests = val; }

// Inventory: per-chat array of { text, quantity, rarity, location } items.
export let inventory = [];
export function setInventory(val) { inventory = val; }

// Spell log: per-chat array of cast/rest entries, retained for current day + 1 prior.
export let spellLog = [];
export function setSpellLog(val) { spellLog = val; }

// Per-chat flag: when true, spell tracker + injection is disabled for this chat.
export let spellTrackerDisabled = false;
export function setSpellTrackerDisabled(val) { spellTrackerDisabled = val; }

// Per-chat flag: when true, attributes are included in the dice roll prompt.
export let sendAttributesOnRoll = true;
export function setSendAttributesOnRoll(val) { sendAttributesOnRoll = val; }

// Per-chat flag: when true, [Spell, Lv] references in user messages inject spell details into context.
export let spellInjectEnabled = false;
export function setSpellInjectEnabled(val) { spellInjectEnabled = val; }

// Spellbook: per-chat imported spell list from 5e.tools sublist JSON.
// Stores { name, items: [{h}], sources: [] } from the imported file.
export let spellbook = null;
export function setSpellbook(val) { spellbook = val; }

// In-memory cache of resolved spell data from 5e.tools API (hash -> spell object).
// Not persisted — refetched on demand.
export const spellDataCache = new Map();

// Character: per-chat class/subclass/level config.
export let character = null;
export function setCharacter(val) { character = val; }

// In-memory cache of 5e.tools class data files (filename -> parsed JSON).
export const classDataCache = new Map();

export let pendingDiceRoll = null;
export function setPendingDiceRoll(val) { pendingDiceRoll = val; }

// Header info parsed from LLM messages
export let headerInfo = {
    time: null,         // "7:02 PM"
    date: null,         // "Friday, Day 16 of Spring, 1247 AE"
    location: null,     // "Spire of Reddington Steele - Second Floor Barracks"
    weather: null,      // "Clear Night, 50°F"
    weatherEmoji: null, // "🌙" - the raw emoji from the header
    spellSlots: null,   // [{ level: 1, current: 4, max: 4 }, ...] or legacy { current, max }
    sorceryPoints: null, // { current: 12, max: 12 } — ⚡ Sorcery Points
    currency: null,     // { gold: 0, silver: 0, copper: 0 }
    extras: []
};
export function setHeaderInfo(val) { headerInfo = val; }
