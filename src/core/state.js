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
    lastModifierRolls: {},
    playerCount: 1,
    allyCount: 1,
    enemyCount: 1,

    // Non-combat dice (auto-roll d20s for skill/ability checks each turn)
    nonCombatDiceEnabled: false,

    // Random events
    randomEventsEnabled: false,
    randomEventRole: 'user',
    eventThresholds: null,

    // Strip widgets
    stripWidgetsEnabled: true,

    // Omni widget column spans in secondary grid (min character counts; fullWide 0 = disabled)
    omniWidgetSizes: null,

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
    },

    // System mode: 'legacy' | 'v1' | 'v2'
    // legacy = legacy char + legacy inventory
    // v1 = V1 charsheet + legacy inventory
    // v2 = V2 charsheet + V2 inventory + game actions
    mode: 'legacy',

    // Derived flags (kept in sync with mode for backward compatibility)
    v1Enabled: false,
    v2Enabled: false,

    // Milestone XP: when true, XP rewards are hidden from quests and LLM instructions
    milestoneXP: false,

    // Custom species stored globally (persist across chats)
    v1CustomSpecies: [],
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

// Per-chat flag: when true, date changes in assistant headers auto-insert long rest entries.
export let autoLongRestEnabled = true;
export function setAutoLongRestEnabled(val) { autoLongRestEnabled = val; }

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

// Sidekicks: per-chat array of sidekick NPC configs.
export let sidekicks = [];
export function setSidekicks(val) { sidekicks = val; }

// In-memory cache of 5e.tools bestiary data (sourceKey -> monster array).
export const bestiaryCache = new Map();

// In-memory cache of equipment items from items-base.json (name lowercase -> item object).
// Includes weapons, armor, and shields.
export let equipmentItemCache = null;
export function setEquipmentItemCache(val) { equipmentItemCache = val; }

export let pendingDiceRoll = null;
export function setPendingDiceRoll(val) { pendingDiceRoll = val; }

// Random event state: per-chat cooldown, last roll result, and event history.
export let eventCooldown = 0;
export function setEventCooldown(val) { eventCooldown = val; }

export let lastEventRoll = null;
export function setLastEventRoll(val) { lastEventRoll = val; }

// Non-combat dice: last rolled pairs for user + ally + NPC
export let lastNonCombatRoll = null;
export function setLastNonCombatRoll(val) { lastNonCombatRoll = val; }

export let eventLog = [];
export function setEventLog(val) { eventLog = val; }

// Auto background switching: per-chat config { enabled, entries: [{ name, day, night }] }
export let autoBackgrounds = null;
export function setAutoBackgrounds(val) { autoBackgrounds = val; }

// Header info parsed from LLM messages
export let headerInfo = {
    time: null,         // "7:02 PM"
    date: null,         // "Friday, Day 16 of Spring, 1247 AE"
    location: null,     // "Spire of Reddington Steele - Second Floor Barracks"
    weather: null,      // "Clear Night, 50°F"
    weatherEmoji: null, // "🌙" - the raw emoji from the header
    spellSlots: null,   // [{ level: 1, current: 4, max: 4 }, ...] or legacy { current, max }
    sorceryPoints: null, // { current: 12, max: 12 } — ⚡ Sorcery Points
    secondaryResource: null, // { current: 2, max: 2 } — 🔥 Innate Sorcery, Rage, etc.
    currency: null,     // { gold: 0, silver: 0, copper: 0 }
    extras: []
};
export function setHeaderInfo(val) { headerInfo = val; }

/**
 * Sync v1Enabled/v2Enabled flags from the mode setting.
 * Call after loading settings or changing mode.
 */
export function syncModeFlags() {
    extensionSettings.v1Enabled = extensionSettings.mode === 'v1';
    extensionSettings.v2Enabled = extensionSettings.mode === 'v2';
}

/**
 * Migrate old v1Enabled/v2Enabled settings to the new mode field.
 * Call once after loading extension settings.
 */
export function migrateSettingsToMode() {
    if (extensionSettings.mode && extensionSettings.mode !== 'legacy') return;
    if (extensionSettings.v2Enabled) {
        extensionSettings.mode = 'v2';
    } else if (extensionSettings.v1Enabled) {
        extensionSettings.mode = 'v1';
    } else {
        extensionSettings.mode = 'legacy';
    }
    syncModeFlags();
}
