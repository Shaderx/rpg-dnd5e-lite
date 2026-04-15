/**
 * D&D 5e Lite - State Module
 * Central state and default settings
 */

export const extensionName = 'third-party/rpg-dnd5e-lite';
export const extensionFolderPath = `scripts/extensions/${extensionName}`;

export const extensionSettings = {
    enabled: true,
    softDisabled: false,

    // D&D Attributes (player-set, sent only with dice rolls)
    attributes: {
        str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
    },

    // Dice
    lastDiceRoll: null,

    // Strip widgets
    stripWidgetsEnabled: true,

    // Quest injection depth (Author's Note depth)
    questDepth: 4,

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
        snowColor: '#dcecff'
    },

    // Lighting overlay (time-of-day ambient lighting on top of weather)
    lightingOverlay: {
        enabled: true,
        intensity: 1.0,
        blendMode: 'soft-light'
    }
};

// Quests are stored per-chat in chat_metadata, not in extensionSettings.
// This is the runtime copy loaded from chat_metadata.
export let quests = [];
export function setQuests(val) { quests = val; }

// Spell log: per-chat array of cast/rest entries, retained for current day + 1 prior.
export let spellLog = [];
export function setSpellLog(val) { spellLog = val; }

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
    currency: null,     // { gold: 0, silver: 0, copper: 0 }
    extras: []          // [{ emoji: '🏠', text: 'Property: ...' }, ...]
};
export function setHeaderInfo(val) { headerInfo = val; }
