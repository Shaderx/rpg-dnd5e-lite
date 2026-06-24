/**
 * V2 Inline Game Actions Parser
 * Extracts JSON action blocks from LLM response text and routes them
 * to the existing quest/inventory handlers. Snapshots state before
 * applying so changes can be reverted.
 */

import { v2Quests, v2Inventory, setV2Quests, setV2Inventory } from '../core/state.js';
import { saveV2Quests, saveV2Inventory } from '../core/persistence.js';
import { renderV2Quests } from '../rendering/quests.js';
import { renderV2Inventory } from '../rendering/inventory.js';
import { handleQuestAction } from './questTool.js';
import { handleInventoryAction } from './inventoryTool.js';

const GAME_ACTIONS_REGEX = /<details>\s*<summary>game_actions<\/summary>([\s\S]*?)<\/details>/i;

const RARITY_NAME_TO_INT = {
    common: 0, uncommon: 1, rare: 2,
    very_rare: 3, 'very rare': 3,
    legendary: 4, artifact: 5,
};

let _backup = null;

/**
 * Normalize rarity from string or number to integer (0-5).
 * The quest/inventory handlers expect numeric rarity.
 */
function normalizeRarityValue(val) {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'number') return val;
    const lower = String(val).toLowerCase().trim();
    return RARITY_NAME_TO_INT[lower] ?? 0;
}

/**
 * Parse a game_actions JSON block from the LLM's response text
 * and apply each action to the quest/inventory state.
 *
 * @param {string} messageText - Raw message text from the LLM
 * @returns {{ applied: number, errors: string[] }} Summary of results
 */
export function parseAndApplyGameActions(messageText) {
    const result = { applied: 0, errors: [] };
    if (!messageText) return result;

    const match = messageText.match(GAME_ACTIONS_REGEX);
    if (!match) return result;

    const raw = match[1].trim();
    if (!raw) return result;

    let actions;
    try {
        actions = JSON.parse(raw);
    } catch (e) {
        const cleaned = raw.replace(/<[^>]*>/g, '').trim();
        try {
            actions = JSON.parse(cleaned);
        } catch (e2) {
            const msg = `Failed to parse game_actions JSON: ${e2.message}`;
            console.error(`[D&D 5e V2] ${msg}`, raw);
            result.errors.push(msg);
            return result;
        }
    }

    if (!Array.isArray(actions)) {
        actions = [actions];
    }

    // Snapshot current state before applying any changes
    _backup = {
        quests: JSON.parse(JSON.stringify(v2Quests)),
        inventory: JSON.parse(JSON.stringify(v2Inventory)),
    };

    for (const action of actions) {
        if (!action || typeof action !== 'object') continue;

        const { tool, ...args } = action;

        try {
            let response;
            switch (tool) {
                case 'quest':
                    response = handleQuestAction(args);
                    break;
                case 'inventory':
                    if (args.rarity !== undefined) {
                        args.rarity = normalizeRarityValue(args.rarity);
                    }
                    response = handleInventoryAction(args);
                    break;
                default:
                    response = `Unknown tool: ${tool}`;
                    result.errors.push(response);
                    continue;
            }

            console.log(`[D&D 5e V2] Game action (${tool}/${args.action}): ${response}`);
            result.applied++;
        } catch (e) {
            const msg = `Error executing ${tool}/${args.action}: ${e.message}`;
            console.error(`[D&D 5e V2] ${msg}`, e);
            result.errors.push(msg);
        }
    }

    if (result.applied > 0) {
        console.log(`[D&D 5e V2] Applied ${result.applied} game action(s)` +
            (result.errors.length > 0 ? `, ${result.errors.length} error(s)` : ''));
    }

    return result;
}

/**
 * @returns {boolean} Whether a pre-parse backup exists
 */
export function hasGameActionBackup() {
    return _backup !== null;
}

/**
 * Revert quests and inventory to the state captured before
 * the last parseAndApplyGameActions call.
 * @returns {boolean} True if reverted, false if no backup
 */
export function revertGameActions() {
    if (!_backup) return false;

    setV2Quests(_backup.quests);
    setV2Inventory(_backup.inventory);
    saveV2Quests(_backup.quests);
    saveV2Inventory(_backup.inventory);
    renderV2Quests();
    renderV2Inventory();

    console.log('[D&D 5e V2] Reverted to pre-parse backup');
    _backup = null;
    return true;
}
