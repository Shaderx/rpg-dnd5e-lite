/**
 * D&D 5e Lite - Prompt Builder
 * Builds the quest injection prompt and the roll+attributes prompt
 */

import { getContext } from '../../../../../extensions.js';
import { extensionSettings, quests, spellLog } from '../core/state.js';

export function getModifier(score) {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

function buildAttributesString() {
    const a = extensionSettings.attributes;
    return [
        `STR ${a.str}(${getModifier(a.str)})`,
        `DEX ${a.dex}(${getModifier(a.dex)})`,
        `CON ${a.con}(${getModifier(a.con)})`,
        `INT ${a.int}(${getModifier(a.int)})`,
        `WIS ${a.wis}(${getModifier(a.wis)})`,
        `CHA ${a.cha}(${getModifier(a.cha)})`
    ].join(' ');
}

/**
 * Build the quest injection prompt (sent every generation at AN depth).
 * Priority: 3=critical(★★★★★), 2=important(★★★), 1=minor(★), 0=unset.
 * Returns empty string if no quests.
 */
export function buildQuestPrompt() {
    if (!quests || quests.length === 0) return '';

    const active = quests.filter(q => !q.completed);
    const done = quests.filter(q => q.completed);

    if (active.length === 0 && done.length === 0) return '';

    const prioritized = active.filter(q => (q.priority || 0) >= 1);
    const critical = prioritized.filter(q => q.priority === 3);
    const important = prioritized.filter(q => q.priority === 2);
    const minor = prioritized.filter(q => q.priority === 1);

    const lines = [];

    if (critical.length > 0) {
        lines.push('[{{User}} is focused on their ★★★★★ critical quest(s). The number of ★ denotes the importance of the quest to {{User}}. Let this shape the narrative direction — but complications, detours, and organic twists are still allowed.]');
        lines.push('');
    }

    if (prioritized.length > 0) {
        lines.push('Active Quests:');
        for (const q of critical)  lines.push(`★★★★★ ${q.text}`);
        for (const q of important) lines.push(`★★★ ${q.text}`);
        for (const q of minor)     lines.push(`★ ${q.text}`);
    }

    if (done.length > 0) {
        lines.push('Completed:');
        for (const q of done) lines.push(`  ✓ ${q.text}`);
    }

    return lines.join('\n');
}

/**
 * Build the spell log injection prompt (chronological list of spells cast).
 * Returns empty string if no spells logged.
 */
export function buildSpellLogPrompt() {
    if (!spellLog || spellLog.length === 0) return '';

    const casts = spellLog.filter(e => e.type === 'cast');
    if (casts.length === 0) return '';

    const userName = getContext().name1 || 'User';
    const lines = [`Previously ${userName} has cast these spells (chronological order):`];

    for (const entry of spellLog) {
        if (entry.type === 'rest') {
            lines.push(`- ${entry.text}`);
        } else {
            const timePart = entry.time ? ` at ${entry.time}` : '';
            const datePart = entry.date ? `, ${entry.date}` : '';
            lines.push(`- Cast ${entry.spell}${timePart}${datePart}`);
        }
    }

    return lines.join('\n');
}

/**
 * Build the roll+attributes prompt (sent only when a roll is active).
 * Returns empty string if no roll.
 */
export function buildRollPrompt() {
    const roll = extensionSettings.lastDiceRoll;
    if (!roll) return '';

    const userName = getContext().name1 || 'User';
    let prompt = `${userName}'s attributes: ${buildAttributesString()}\n`;
    prompt += `${userName} rolled ${roll.total} (${roll.formula}). The relevant ability modifier is calculated from their attributes above. Add the appropriate modifier to the roll and compare against the DC to determine success or failure.`;
    return prompt;
}
