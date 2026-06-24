/**
 * D&D 5e Lite - Injector
 * Builds and injects a single consolidated <dnd5e_game_state> prompt at the configured depth.
 */

import { extension_prompt_types, extension_prompt_roles, setExtensionPrompt } from '../../../../../../script.js';
import { extensionSettings, spellTrackerDisabled, setLastNonCombatRoll } from '../core/state.js';
import { saveSettings } from '../core/persistence.js';
import { buildQuestSection, buildInventorySection, buildCombatDiceSection, buildNonCombatDiceSection, buildSpellLogSection, buildActiveSpellsSection, buildSidekickSection, buildRandomEventSection } from './promptBuilder.js';
import { refreshHeaderFromChat } from '../features/headerParser.js';
import { refreshSpellLog } from '../features/spellTracker.js';
import { rollRandomEvent, getLastEventRoll } from '../features/randomEvents.js';
import { buildCharacterSection } from '../v1/generation/promptBuilder.js';
import { buildV2QuestSection, buildV2InventorySection, buildToolInstructionsSection } from '../v2/generation/promptBuilder.js';
import { buildV2CharacterSection } from '../v2/generation/characterPrompt.js';

const LEGACY_KEYS = [
    'dnd5e-quests',
    'dnd5e-inventory',
    'dnd5e-roll',
    'dnd5e-noncombat',
    'dnd5e-spelllog',
    'dnd5e-spellinfo',
    'dnd5e-sidekicks',
    'dnd5e-character',
];

export function clearExtensionPrompts() {
    setExtensionPrompt('dnd5e-main', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('dnd5e-random-event', '', extension_prompt_types.IN_CHAT, 0, false);
    for (const key of LEGACY_KEYS) {
        setExtensionPrompt(key, '', extension_prompt_types.IN_CHAT, 0, false);
    }
}

/**
 * Assemble the consolidated game state prompt from all active sections.
 * Sections are ordered from most permanent to most ephemeral.
 * Empty sections are omitted entirely.
 */
function buildConsolidatedPrompt(options) {
    const { combatDice, nonCombatDice, randomEvent, randomEventRole } = options;
    const sections = [];

    // 1. Character (V1 or V2 system)
    if (extensionSettings.mode === 'v2') {
        const charSection = buildV2CharacterSection();
        if (charSection) sections.push(charSection);
    } else if (extensionSettings.v1Enabled) {
        const charSection = buildCharacterSection();
        if (charSection) sections.push(charSection);
    }

    // 2. Sidekicks
    const sidekickSection = buildSidekickSection();
    if (sidekickSection) sections.push(sidekickSection);

    // 3. Inventory (V2 or legacy)
    if (extensionSettings.v2Enabled) {
        const v2Inv = buildV2InventorySection();
        if (v2Inv) sections.push(v2Inv);
    } else {
        const inventorySection = buildInventorySection();
        if (inventorySection) sections.push(inventorySection);
    }

    // 4. Quests (V2 or legacy)
    if (extensionSettings.v2Enabled) {
        const v2Quest = buildV2QuestSection();
        if (v2Quest) sections.push(v2Quest);
    } else {
        const questSection = buildQuestSection();
        if (questSection) sections.push(questSection);
    }

    // 5. Spell Log
    if (!spellTrackerDisabled) {
        const spellLogSection = buildSpellLogSection();
        if (spellLogSection) sections.push(spellLogSection);
    }

    // 6. Active Spells (precalculated)
    const activeSpellsSection = buildActiveSpellsSection();
    if (activeSpellsSection) sections.push(activeSpellsSection);

    // 7. Dice (combat OR non-combat, mutually exclusive)
    if (combatDice) {
        sections.push(combatDice);
    } else if (nonCombatDice) {
        sections.push(nonCombatDice);
    }

    // 8. Random Event (only included here if role is USER; SYSTEM role injects separately)
    if (randomEvent && randomEventRole !== extension_prompt_roles.SYSTEM) {
        sections.push(randomEvent);
    }

    // 9. V2 Tool Instructions (when V2 is enabled, appended after all data sections)
    if (extensionSettings.v2Enabled) {
        sections.push(buildToolInstructionsSection());
    }

    if (sections.length === 0) return '';

    const header = `<dnd5e_game_state>`;
    const footer = '</dnd5e_game_state>';

    return `${header}\n\n${sections.join('\n\n')}\n\n${footer}`;
}

/**
 * Called on generation start.
 * Builds and injects the consolidated game state prompt.
 * @param {string} [type] - Generation type from SillyTavern ('swipe', 'regenerate', etc.)
 */
export function onGenerationStarted(type) {
    if (!extensionSettings.enabled || extensionSettings.softDisabled) {
        clearExtensionPrompts();
        return;
    }

    if (type === 'swipe' || type === 'regenerate') {
        refreshHeaderFromChat({ skipLastAssistant: true });
        if (!spellTrackerDisabled) refreshSpellLog({ skipLastAssistant: true });
    }

    const depth = extensionSettings.injectionDepth ?? 0;

    // Prepare combat dice (one-shot: auto-clear after injection)
    const combatDice = buildCombatDiceSection();
    if (combatDice) {
        extensionSettings.lastDiceRoll = null;
        extensionSettings.lastDamageRoll = null;
        extensionSettings.lastModifierRolls = {};
        saveSettings();
    }

    // Prepare non-combat dice (auto-roll each generation when enabled, skip if combat roll)
    let nonCombatDice = '';
    if (extensionSettings.nonCombatDiceEnabled && !combatDice) {
        const isReroll = type === 'swipe' || type === 'regenerate';
        if (!isReroll) {
            const roll1 = () => Math.floor(Math.random() * 20) + 1;
            setLastNonCombatRoll({ user: { roll1: roll1(), roll2: roll1() }, npc: { roll1: roll1(), roll2: roll1() } });
        }
        nonCombatDice = buildNonCombatDiceSection();
    }

    // Prepare random event
    let randomEvent = '';
    let randomEventRole = extension_prompt_roles.USER;
    if (extensionSettings.randomEventsEnabled) {
        const isReroll = type === 'swipe' || type === 'regenerate';
        const eventResult = isReroll ? getLastEventRoll() : rollRandomEvent();
        randomEvent = buildRandomEventSection(eventResult);
        randomEventRole = extensionSettings.randomEventRole === 'system'
            ? extension_prompt_roles.SYSTEM
            : extension_prompt_roles.USER;
    }

    // Build and inject consolidated prompt
    const mainPrompt = buildConsolidatedPrompt({ combatDice, nonCombatDice, randomEvent, randomEventRole });
    if (mainPrompt) {
        setExtensionPrompt('dnd5e-main', mainPrompt, extension_prompt_types.IN_CHAT, depth, false, extension_prompt_roles.USER);
    } else {
        setExtensionPrompt('dnd5e-main', '', extension_prompt_types.IN_CHAT, 0, false);
    }

    // Random event with SYSTEM role injects separately (different role from main block)
    if (randomEvent && randomEventRole === extension_prompt_roles.SYSTEM) {
        setExtensionPrompt('dnd5e-random-event', randomEvent, extension_prompt_types.IN_CHAT, depth, false, extension_prompt_roles.SYSTEM);
    } else {
        setExtensionPrompt('dnd5e-random-event', '', extension_prompt_types.IN_CHAT, 0, false);
    }

    // Clear any leftover legacy keys from previous version
    for (const key of LEGACY_KEYS) {
        setExtensionPrompt(key, '', extension_prompt_types.IN_CHAT, 0, false);
    }
}
