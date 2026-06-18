/**
 * D&D 5e Lite - Injector
 * Injects all prompts at the configured injection depth
 */

import { extension_prompt_types, extension_prompt_roles, setExtensionPrompt } from '../../../../../../script.js';
import { extensionSettings, spellTrackerDisabled } from '../core/state.js';
import { saveSettings } from '../core/persistence.js';
import { buildQuestPrompt, buildInventoryPrompt, buildRollPrompt, buildSpellLogPrompt, buildSpellInjectPrompt, buildSidekickPrompt, buildRandomEventPrompt } from './promptBuilder.js';
import { refreshHeaderFromChat } from '../features/headerParser.js';
import { refreshSpellLog } from '../features/spellTracker.js';
import { rollRandomEvent, getLastEventRoll } from '../features/randomEvents.js';
import { buildCharacterPrompt } from '../v1/generation/promptBuilder.js';

export function clearExtensionPrompts() {
    setExtensionPrompt('dnd5e-quests', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('dnd5e-inventory', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('dnd5e-roll', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('dnd5e-spelllog', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('dnd5e-spellinfo', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('dnd5e-sidekicks', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('dnd5e-random-event', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('dnd5e-character', '', extension_prompt_types.IN_CHAT, 0, false);
}

/**
 * Called on generation start.
 * All prompts inject at the configured injectionDepth setting.
 * - Roll+attributes auto-clears after one injection.
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

    // Quest prompt
    const questPrompt = buildQuestPrompt();
    if (questPrompt) {
        setExtensionPrompt('dnd5e-quests', questPrompt, extension_prompt_types.IN_CHAT, depth, false, extension_prompt_roles.USER);
    } else {
        setExtensionPrompt('dnd5e-quests', '', extension_prompt_types.IN_CHAT, 0, false);
    }

    // Inventory prompt
    const inventoryPrompt = buildInventoryPrompt();
    if (inventoryPrompt) {
        setExtensionPrompt('dnd5e-inventory', inventoryPrompt, extension_prompt_types.IN_CHAT, depth, false, extension_prompt_roles.USER);
    } else {
        setExtensionPrompt('dnd5e-inventory', '', extension_prompt_types.IN_CHAT, 0, false);
    }

    // Spell log
    if (!spellTrackerDisabled) {
        const spellLogPrompt = buildSpellLogPrompt();
        if (spellLogPrompt) {
            setExtensionPrompt('dnd5e-spelllog', spellLogPrompt, extension_prompt_types.IN_CHAT, depth, false, extension_prompt_roles.USER);
        } else {
            setExtensionPrompt('dnd5e-spelllog', '', extension_prompt_types.IN_CHAT, 0, false);
        }
    } else {
        setExtensionPrompt('dnd5e-spelllog', '', extension_prompt_types.IN_CHAT, 0, false);
    }

    // Roll+attributes+damage (one-shot: auto-clear after injection)
    const rollPrompt = buildRollPrompt();
    if (rollPrompt) {
        setExtensionPrompt('dnd5e-roll', rollPrompt, extension_prompt_types.IN_CHAT, depth, false, extension_prompt_roles.USER);
        extensionSettings.lastDiceRoll = null;
        extensionSettings.lastDamageRoll = null;
        extensionSettings.lastModifierRolls = {};
        saveSettings();
    } else {
        setExtensionPrompt('dnd5e-roll', '', extension_prompt_types.IN_CHAT, 0, false);
    }

    // Spell info injection (when user message has [Spell, ...] brackets)
    const spellInfoPrompt = buildSpellInjectPrompt();
    if (spellInfoPrompt) {
        setExtensionPrompt('dnd5e-spellinfo', spellInfoPrompt, extension_prompt_types.IN_CHAT, depth, false, extension_prompt_roles.USER);
    } else {
        setExtensionPrompt('dnd5e-spellinfo', '', extension_prompt_types.IN_CHAT, 0, false);
    }

    // V1 Character stat block injection (when V1 mode is active)
    if (extensionSettings.v1Enabled) {
        const charPrompt = buildCharacterPrompt();
        if (charPrompt) {
            setExtensionPrompt('dnd5e-character', charPrompt, extension_prompt_types.IN_CHAT, depth, false, extension_prompt_roles.USER);
        } else {
            setExtensionPrompt('dnd5e-character', '', extension_prompt_types.IN_CHAT, 0, false);
        }
    } else {
        setExtensionPrompt('dnd5e-character', '', extension_prompt_types.IN_CHAT, 0, false);
    }

    // Sidekick stats injection (per-NPC enabled flags gate individually)
    const sidekickPrompt = buildSidekickPrompt();
    if (sidekickPrompt) {
        setExtensionPrompt('dnd5e-sidekicks', sidekickPrompt, extension_prompt_types.IN_CHAT, depth, false, extension_prompt_roles.USER);
    } else {
        setExtensionPrompt('dnd5e-sidekicks', '', extension_prompt_types.IN_CHAT, 0, false);
    }

    // Random event injection (always injects <Random_Event> tag when enabled)
    if (extensionSettings.randomEventsEnabled) {
        const isReroll = type === 'swipe' || type === 'regenerate';
        const eventResult = isReroll ? getLastEventRoll() : rollRandomEvent();
        const eventPrompt = buildRandomEventPrompt(eventResult);
        const eventRole = extensionSettings.randomEventRole === 'system'
            ? extension_prompt_roles.SYSTEM
            : extension_prompt_roles.USER;
        setExtensionPrompt('dnd5e-random-event', eventPrompt, extension_prompt_types.IN_CHAT, depth, false, eventRole);
    } else {
        setExtensionPrompt('dnd5e-random-event', '', extension_prompt_types.IN_CHAT, 0, false);
    }

}
