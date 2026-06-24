/**
 * V2 Tool Calling - Quest Tool Handler
 * Processes LLM tool calls for quest management (add/update/complete/fail/remove).
 */

import { v2Quests, createDefaultQuest } from '../core/state.js';
import { saveV2Quests } from '../core/persistence.js';
import { renderV2Quests } from '../rendering/quests.js';

function persist() {
    saveV2Quests(v2Quests);
    renderV2Quests();
}

/**
 * Handle a quest management tool call from the LLM.
 * @param {object} args - Tool call arguments
 * @returns {string} Confirmation message
 */
export function handleQuestAction(args) {
    const { action } = args;

    switch (action) {
        case 'add': return handleAdd(args);
        case 'update': return handleUpdate(args);
        case 'complete': return handleStatusChange(args, 'completed');
        case 'fail': return handleStatusChange(args, 'failed');
        case 'remove': return handleRemove(args);
        default: return `Unknown quest action: ${action}`;
    }
}

function handleAdd(args) {
    const title = args.title?.trim();
    if (!title) return 'Error: quest title is required for add action';

    const quest = createDefaultQuest({
        title,
        description: args.description?.trim() || '',
        priority: normalizePriority(args.priority),
        status: args.status || 'not_started',
        giver: args.giver?.trim() || '',
        location: args.location?.trim() || '',
    });

    if (Array.isArray(args.objectives)) {
        quest.objectives = args.objectives
            .filter(o => o.text?.trim())
            .map(o => ({ text: o.text.trim(), completed: !!o.completed }));
    }

    if (args.rewards) {
        quest.rewards = {
            xp: Math.max(0, parseInt(args.rewards.xp) || 0),
            gold: Math.max(0, parseInt(args.rewards.gold) || 0),
            items: Array.isArray(args.rewards.items) ? args.rewards.items.filter(Boolean) : [],
        };
    }

    v2Quests.push(quest);
    persist();
    return `Quest added: "${title}"`;
}

function handleUpdate(args) {
    const quest = resolveQuest(args.index);
    if (!quest) return `Error: quest not found at index ${args.index}`;

    if (args.title !== undefined) quest.title = args.title.trim();
    if (args.description !== undefined) quest.description = args.description.trim();
    if (args.priority !== undefined) quest.priority = normalizePriority(args.priority);
    if (args.status !== undefined) quest.status = args.status;
    if (args.giver !== undefined) quest.giver = args.giver.trim();
    if (args.location !== undefined) quest.location = args.location.trim();

    // Replace objectives entirely if provided
    if (Array.isArray(args.objectives)) {
        quest.objectives = args.objectives
            .filter(o => o.text?.trim())
            .map(o => ({ text: o.text.trim(), completed: !!o.completed }));
    }

    // Update individual objective completion by index
    if (Array.isArray(args.objectives_update)) {
        for (const update of args.objectives_update) {
            const objIdx = (update.objective_index || 0) - 1;
            if (objIdx >= 0 && objIdx < quest.objectives.length) {
                quest.objectives[objIdx].completed = !!update.completed;
            }
        }
    }

    if (args.rewards) {
        if (args.rewards.xp !== undefined) quest.rewards.xp = Math.max(0, parseInt(args.rewards.xp) || 0);
        if (args.rewards.gold !== undefined) quest.rewards.gold = Math.max(0, parseInt(args.rewards.gold) || 0);
        if (args.rewards.items !== undefined) quest.rewards.items = Array.isArray(args.rewards.items) ? args.rewards.items.filter(Boolean) : quest.rewards.items;
    }

    persist();
    return `Quest updated: "${quest.title}"`;
}

function handleStatusChange(args, newStatus) {
    const quest = resolveQuest(args.index);
    if (!quest) return `Error: quest not found at index ${args.index}`;

    quest.status = newStatus;

    if (newStatus === 'completed') {
        for (const obj of quest.objectives) {
            obj.completed = true;
        }
    }

    persist();
    return `Quest ${newStatus}: "${quest.title}"`;
}

function handleRemove(args) {
    const idx = resolveIndex(args.index);
    if (idx < 0 || idx >= v2Quests.length) return `Error: quest not found at index ${args.index}`;

    const title = v2Quests[idx].title;
    v2Quests.splice(idx, 1);
    persist();
    return `Quest removed: "${title}"`;
}

function resolveQuest(index) {
    const idx = resolveIndex(index);
    return (idx >= 0 && idx < v2Quests.length) ? v2Quests[idx] : null;
}

function resolveIndex(index) {
    if (typeof index !== 'number' || index < 1) return -1;
    return index - 1; // 1-based prompt numbering -> 0-based array
}

function normalizePriority(p) {
    const val = parseInt(p) || 1;
    return val >= 1 && val <= 3 ? val : 1;
}
