/**
 * D&D 5e Lite - Injector
 * Injects all prompts at the configured injection depth
 */

import { extension_prompt_types, extension_prompt_roles, setExtensionPrompt } from '../../../../../../script.js';
import { extensionSettings, spellTrackerDisabled } from '../core/state.js';
import { saveSettings } from '../core/persistence.js';
import { buildQuestPrompt, buildInventoryPrompt, buildRollPrompt, buildSpellLogPrompt, buildSpellInjectPrompt } from './promptBuilder.js';
import { refreshHeaderFromChat } from '../features/headerParser.js';
import { refreshSpellLog } from '../features/spellTracker.js';

export function clearExtensionPrompts() {
    setExtensionPrompt('dnd5e-quests', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('dnd5e-inventory', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('dnd5e-roll', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('dnd5e-spelllog', '', extension_prompt_types.IN_CHAT, 0, false);
    setExtensionPrompt('dnd5e-spellinfo', '', extension_prompt_types.IN_CHAT, 0, false);
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

    // Quest prompt as SYSTEM
    const questPrompt = buildQuestPrompt();
    if (questPrompt) {
        setExtensionPrompt('dnd5e-quests', questPrompt, extension_prompt_types.IN_CHAT, depth, false, extension_prompt_roles.SYSTEM);
    } else {
        setExtensionPrompt('dnd5e-quests', '', extension_prompt_types.IN_CHAT, 0, false);
    }

    // Inventory prompt as SYSTEM
    const inventoryPrompt = buildInventoryPrompt();
    if (inventoryPrompt) {
        setExtensionPrompt('dnd5e-inventory', inventoryPrompt, extension_prompt_types.IN_CHAT, depth + 1, false, extension_prompt_roles.SYSTEM);
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

    // Roll+attributes+damage (one-shot: auto-clear after injection)
    const rollPrompt = buildRollPrompt();
    if (rollPrompt) {
        setExtensionPrompt('dnd5e-roll', rollPrompt, extension_prompt_types.IN_CHAT, depth, false, extension_prompt_roles.USER);
        extensionSettings.lastDiceRoll = null;
        extensionSettings.lastDamageRoll = null;
        extensionSettings.lastFavoredRoll = null;
        saveSettings();
    } else {
        setExtensionPrompt('dnd5e-roll', '', extension_prompt_types.IN_CHAT, 0, false);
    }

    // Spell info injection as SYSTEM (when user message has [Spell, ...] brackets)
    const spellInfoPrompt = buildSpellInjectPrompt();
    if (spellInfoPrompt) {
        setExtensionPrompt('dnd5e-spellinfo', spellInfoPrompt, extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
    } else {
        setExtensionPrompt('dnd5e-spellinfo', '', extension_prompt_types.IN_CHAT, 0, false);
    }

}
