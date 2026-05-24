/**
 * D&D 5e Lite - Prompt Builder
 * Builds the quest injection prompt and the roll+attributes prompt
 */

import { getContext } from '../../../../../extensions.js';
import { extensionSettings, chatAttributes, chatAttributeSchema, quests, inventory, spellLog, headerInfo } from '../core/state.js';

export function getModifier(score) {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

function buildAttributesString() {
    const a = chatAttributes;
    return chatAttributeSchema.map(s => {
        const val = a[s.key] ?? 10;
        return `${s.label} ${val}(${getModifier(val)})`;
    }).join(' ');
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

const RARITY_TAGS = ['common', 'uncommon', 'rare', 'legendary'];

/**
 * Build the inventory injection prompt (sent every generation at AN depth).
 * Lists equipped and stored items with quantity and rarity.
 * Returns empty string if no items.
 */
export function buildInventoryPrompt() {
    if (!inventory || inventory.length === 0) return '';

    const equipped = inventory.filter(item => item.location === 'equipped');
    const stored = inventory.filter(item => item.location !== 'equipped');

    if (equipped.length === 0 && stored.length === 0) return '';

    const userName = getContext().name1 || '{{User}}';
    const lines = [`[${userName}'s inventory:]`];

    if (equipped.length > 0) {
        lines.push('');
        lines.push('Equipped:');
        for (const item of equipped) {
            const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
            const rarity = item.rarity >= 1 ? ` (${RARITY_TAGS[item.rarity]})` : '';
            lines.push(`  ⚔ ${item.text}${qty}${rarity}`);
        }
    }

    if (stored.length > 0) {
        lines.push('');
        lines.push('Stored:');
        for (const item of stored) {
            const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
            const rarity = item.rarity >= 1 ? ` (${RARITY_TAGS[item.rarity]})` : '';
            lines.push(`  📦 ${item.text}${qty}${rarity}`);
        }
    }

    return lines.join('\n');
}

const KEYCAP = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

function buildSpellSlotsString() {
    const slots = headerInfo?.spellSlots;
    const sp = headerInfo?.sorceryPoints;
    let str = '';
    if (slots && Array.isArray(slots) && slots.length > 0) {
        str = slots.map(s => {
            const label = s.level > 0 ? KEYCAP[s.level] : '🪄';
            return `${label}${s.current}/${s.max}`;
        }).join(' ');
    }
    if (sp) {
        const spStr = `⚡${sp.current}/${sp.max}`;
        str = str ? `${str} ${spStr}` : spStr;
    }
    return str;
}

/**
 * Find the index of the last user message in the chat.
 */
function getLastUserMsgIndex() {
    const chat = getContext().chat;
    if (!chat) return -1;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i].is_user) return i;
    }
    return -1;
}

/**
 * Build the spell log injection prompt (chronological list of already-cast spells).
 * Excludes spells from the last user message — the LLM is about to process those,
 * and the spell slots don't yet reflect their cost.
 * Appends current spell slot state so the LLM knows remaining resources.
 * Returns empty string if no spells logged.
 */
export function buildSpellLogPrompt() {
    if (!spellLog || spellLog.length === 0) return '';

    const lastUserIdx = getLastUserMsgIndex();

    // Filter out entries from the current (last) user message
    const prior = spellLog.filter(e =>
        e.type === 'rest' || e.type === 'short-rest' || e.msgIndex === null || e.msgIndex !== lastUserIdx
    );

    const casts = prior.filter(e => e.type === 'cast');
    if (casts.length === 0) return '';

    const userName = getContext().name1 || 'User';
    const lines = [`[${userName} has already casted these spells — only track ${userName}, use this list as the correct authority for the tracker. This tracker does not take the next user message into account. Listed in chronological order:]`];

    for (const entry of prior) {
        if (entry.type === 'rest' || entry.type === 'short-rest') {
            lines.push(`- ${entry.text}`);
        } else {
            const timePart = entry.time ? ` at ${entry.time}` : '';
            const datePart = entry.date ? `, ${entry.date}` : '';
            lines.push(`- Casted ${entry.spell}${timePart}${datePart}`);
        }
    }

    const slotsStr = buildSpellSlotsString();
    if (slotsStr) {
        lines.push('');
        lines.push(`[Current spell slots remaining: ${slotsStr}]`);
    }

    return lines.join('\n');
}

/**
 * Build the roll+attributes prompt (sent only when a roll is active).
 * Four d20 rolls are provided: 2 for the player and 2 for NPCs, each pair
 * supporting advantage/disadvantage rules independently.
 * Returns empty string if no roll.
 */
export function buildRollPrompt() {
    const roll = extensionSettings.lastDiceRoll;
    if (!roll) return '';

    const userName = getContext().name1 || 'User';
    let prompt = `${userName}'s attributes: ${buildAttributesString()}\n`;
    prompt += `${userName} rolled two d20 dice — 1st roll: ${roll.roll1}, 2nd roll: ${roll.roll2}.\n`;
    prompt += `If the situation grants advantage, use the higher roll. If it imposes disadvantage, use the lower roll. Otherwise use the 1st roll.\n`;
    prompt += `The relevant ability modifier is calculated from their attributes above. Add the appropriate modifier to the chosen roll and compare against the DC to determine success or failure.\n\n`;
    if (roll.npcRoll1 != null && roll.npcRoll2 != null) {
        prompt += `This two additional roll is used only if you need to roll for the npc. Otherwise ignore the roll. — 1st roll: ${roll.npcRoll1}, 2nd roll: ${roll.npcRoll2}.\n`;
        prompt += `Apply the same advantage/disadvantage logic for the NPC: use the higher if advantage, the lower if disadvantage, otherwise the 1st roll.\n`;
        prompt += `Use these NPC rolls for any opposing checks, saves, attacks, or contested rolls the NPC must make this turn.`;
    }
    return prompt;
}
