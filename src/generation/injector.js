/**
 * D&D 5e Lite - Injector
 * Injects quest prompt at AN depth and roll+attributes at depth 0
 */

import { extension_prompt_types, extension_prompt_roles, setExtensionPrompt } from '../../../../../../script.js';
import { extensionSettings, spellTrackerDisabled } from '../core/state.js';
import { saveSettings } from '../core/persistence.js';
import { buildQuestPrompt, buildInventoryPrompt, buildRollPrompt, buildSpellLogPrompt } from './promptBuilder.js';
import { refreshHeaderFromChat } from '../features/headerParser.js';
import { refreshSpellLog } from '../features/spellTracker.js';

export function clearExtensionPrompts() {
    setExtensionPrompt('dnd5e-quests', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('dnd5e-inventory', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('dnd5e-roll', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('dnd5e-spelllog', '', extension_prompt_types.IN_CHAT, 0, false);
}

/**
 * Called on generation start.
 * - Quest prompt at AN depth (every generation)
 * - Spell log at depth 1 (every generation)
 * - Roll+attributes at depth 0 (only when a roll exists, then auto-clears)
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

    const anDepth = extensionSettings.questDepth ?? 4;

    // Quest prompt at AN depth as SYSTEM
    const questPrompt = buildQuestPrompt();
    if (questPrompt) {
        setExtensionPrompt('dnd5e-quests', questPrompt, extension_prompt_types.IN_CHAT, anDepth, false, extension_prompt_roles.SYSTEM);
    } else {
        setExtensionPrompt('dnd5e-quests', '', extension_prompt_types.IN_CHAT, 0, false);
    }

    // Inventory prompt at AN depth + 1 as SYSTEM
    const inventoryPrompt = buildInventoryPrompt();
    if (inventoryPrompt) {
        setExtensionPrompt('dnd5e-inventory', inventoryPrompt, extension_prompt_types.IN_CHAT, anDepth + 1, false, extension_prompt_roles.SYSTEM);
    } else {
        setExtensionPrompt('dnd5e-inventory', '', extension_prompt_types.IN_CHAT, 0, false);
    }

    // Spell log at depth 1 as SYSTEM (skip if tracker disabled for this chat)
    if (!spellTrackerDisabled) {
        const spellLogPrompt = buildSpellLogPrompt();
        if (spellLogPrompt) {
            setExtensionPrompt('dnd5e-spelllog', spellLogPrompt, extension_prompt_types.IN_CHAT, 1, false, extension_prompt_roles.SYSTEM);
        } else {
            setExtensionPrompt('dnd5e-spelllog', '', extension_prompt_types.IN_CHAT, 0, false);
        }
    } else {
        setExtensionPrompt('dnd5e-spelllog', '', extension_prompt_types.IN_CHAT, 0, false);
    }

    // Roll+attributes at depth 0 as USER (one-shot: auto-clear after injection)
    const rollPrompt = buildRollPrompt();
    if (rollPrompt) {
        setExtensionPrompt('dnd5e-roll', rollPrompt, extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.USER);
        extensionSettings.lastDiceRoll = null;
        saveSettings();
    } else {
        setExtensionPrompt('dnd5e-roll', '', extension_prompt_types.IN_CHAT, 0, false);
    }

}
